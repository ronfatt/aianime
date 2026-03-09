"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { InfoTip } from "@/components/info-tip";
import { RulesPanel } from "@/components/rules-panel";
import { SceneCard } from "@/components/scene-card";
import {
  COLOR_GRADE_PRESETS,
  DEFAULT_REFERENCE_TAG,
  FILM_STYLES,
  SCENE_COUNTS,
} from "@/lib/constants";
import { fullOutputCopy, toFilmPackMarkdown, toFilmPackText } from "@/lib/formatters";
import {
  buildRenderProviderPayload,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_VIDEO_PROVIDER,
  getProviderDefinition,
  getProvidersByKind,
  getVideoProviderAdapter,
  type RenderProviderId,
} from "@/lib/render-providers";
import { toSeriesMarkdown, toSeriesText } from "@/lib/series-export";
import {
  buildDefaultEpisodes,
  buildEpisodeScript,
  buildMasterStylePrompt,
  mergeGeneratedEpisode,
  mergeGeneratedEpisodes,
  mergeGeneratedScenes,
  createStoryboardShot,
  defaultCharacter,
  defaultProject,
  defaultSeries,
  defaultWorld,
} from "@/lib/studio-template";
import type {
  BeatItem,
  ColorGradePreset,
  CompanionShot,
  FilmPack,
  FilmTone,
  SceneCountInput,
  SceneItem,
} from "@/types/film-pack";
import type {
  EpisodeStatus,
  RenderTask,
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
  StudioSeries,
  StudioWorld,
} from "@/types/studio";

interface GenerateResponse {
  filmPack: FilmPack;
}

interface GenerateBeatSheetResponse {
  beatSheet: BeatItem[];
  sceneCount: number;
}

interface GenerateCompanionShotPayload {
  shot?: CompanionShot;
  error?: string;
}

interface GenerateSeriesResponse {
  seriesTitle: string;
  premise: string;
  seasonLabel: string;
  seasonArc: string;
  hookFormula: string;
  episodes: Array<{
    episodeNumber: number;
    title: string;
    summary: string;
    hook: string;
    conflict: string;
    action: string;
    climax: string;
    ending: string;
    cliffhanger: string;
    durationSeconds: number;
  }>;
}

interface RegenerateEpisodeResponse {
  episode: {
    episodeNumber: number;
    title: string;
    summary: string;
    hook: string;
    conflict: string;
    action: string;
    climax: string;
    ending: string;
    cliffhanger: string;
    durationSeconds: number;
  };
}

interface GenerateStoryResponse {
  seriesTitle: string;
  premise: string;
  seasonLabel: string;
  seasonArc: string;
  hookFormula: string;
  project: {
    title: string;
    genre: string;
    tone: string;
    animationStyle: string;
  };
  world: {
    setting: string;
    environment: string;
    weather: string;
    architecture: string;
    palette: string;
  };
  character: {
    name: string;
    role: string;
    age: string;
    appearance: string;
    outfit: string;
    poseLanguage: string;
    power: string;
  };
}

interface GenerateEpisodeScenesResponse {
  scenes: Array<{
    title: string;
    purpose: string;
    beat: string;
  }>;
}

interface SavedFilmPackRecord {
  id: string;
  title: string;
  style: FilmTone;
  sceneCount: number;
  createdAt: string;
  filmPack: FilmPack;
}

interface WorkspaceSnapshot {
  series: StudioSeries;
  project: StudioProject;
  world: StudioWorld;
  character: StudioCharacter;
  episodes: StudioEpisode[];
  selectedEpisodeId: string;
  referenceTag: string;
  sceneCount: SceneCountInput;
  style: FilmTone;
  colorGradePreset: ColorGradePreset;
  strictMode: boolean;
  storyIdea: string;
  lockedVoiceOver: string;
  masterReferenceUrls: string;
  renderQueue: RenderTask[];
  imageProvider?: RenderProviderId;
  videoProvider?: RenderProviderId;
}

const STORAGE_KEY = "anime-pack-studio:saved-packs";
const WORKSPACE_STORAGE_KEY = "anime-pack-studio:workspace";
const STUDIO_STEPS = [
  {
    step: "Step 1",
    title: "Story Lab",
    description: "Start with one idea, then generate the series title, premise, season arc, and episode list.",
  },
  {
    step: "Step 2",
    title: "World Setup",
    description: "Define the project look, world rules, and main character so all later scenes stay consistent.",
  },
  {
    step: "Step 3",
    title: "Series Map",
    description: "Review the season overview, pick an episode, and track cliffhangers across the series.",
  },
  {
    step: "Step 4",
    title: "Episode Build",
    description: "Generate scenes, storyboard beats, prompts, and the episode pack for one selected episode.",
  },
  {
    step: "Step 5",
    title: "Assets and Video",
    description: "Queue scene images first, then send each scene into video generation and monitor task status.",
  },
] as const;

function getColorGradeLock(preset: ColorGradePreset, style: FilmTone): string {
  switch (preset) {
    case "neon twilight":
      return "electric twilight palette, violet-blue ambience, neon rim accents, preserve clean skin and costume separation";
    case "pastel dreamlight":
      return "soft pastel glow, airy highlights, gentle bloom, maintain dreamy but readable contrast";
    case "inked dramatic contrast":
      return "high-contrast inked shadows, bold value separation, restrained accent colors, keep silhouette clarity";
    case "vibrant cel-shaded":
    default:
      if (style === "fantasy drama") {
        return "hero palette with luminous cel shading, stable accent lighting, controlled magical glow without washing out the frame";
      }
      return "vibrant cel-shaded palette, crisp anime values, stable saturation, no random palette swings between scenes";
  }
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function resizeImageFile(file: File, maxWidth = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image for resize."));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function sumDuration(scenes: StudioScene[]) {
  return scenes.reduce((total, scene) => total + (scene.shot.durationSeconds || 0), 0);
}

function updateSceneById(
  scenes: StudioScene[],
  id: string,
  updater: (scene: StudioScene) => StudioScene
): StudioScene[] {
  return scenes.map((scene) => (scene.id === id ? updater(scene) : scene));
}

function updateEpisodeById(
  episodes: StudioEpisode[],
  id: string,
  updater: (episode: StudioEpisode) => StudioEpisode
): StudioEpisode[] {
  return episodes.map((episode) => (episode.id === id ? updater(episode) : episode));
}

function buildCarryoverHook(cliffhanger: string, episodeTitle?: string): string {
  const cleaned = cliffhanger.trim();
  if (!cleaned) {
    return episodeTitle
      ? `Open the episode by paying off the previous ending and launching ${episodeTitle}.`
      : "Open by paying off the previous cliffhanger.";
  }

  if (episodeTitle) {
    return `Resolve the previous cliffhanger: ${cleaned} Then launch ${episodeTitle}.`;
  }

  return `Resolve the previous cliffhanger: ${cleaned}`;
}

function propagateNextEpisodeHook(
  episodes: StudioEpisode[],
  sourceEpisodeNumber: number,
  nextTitle?: string
): StudioEpisode[] {
  return episodes.map((episode) => {
    if (episode.episodeNumber !== sourceEpisodeNumber + 1) {
      return episode;
    }

    const previous = episodes.find((item) => item.episodeNumber === sourceEpisodeNumber);
    return {
      ...episode,
      hook: buildCarryoverHook(previous?.cliffhanger || "", nextTitle || episode.title),
    };
  });
}

function promoteEpisodeStatus(current: EpisodeStatus, next: EpisodeStatus): EpisodeStatus {
  const order: EpisodeStatus[] = ["draft", "scenes", "storyboard", "generated", "exported"];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function statusTone(status: EpisodeStatus): string {
  switch (status) {
    case "scenes":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
    case "storyboard":
      return "border-sky-300/20 bg-sky-400/10 text-sky-200";
    case "generated":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-200";
    case "exported":
      return "border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-200";
    case "draft":
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-400";
  }
}

function renderTaskTone(status: RenderTask["status"]): string {
  switch (status) {
    case "submitted":
      return "border-sky-300/20 bg-sky-400/10 text-sky-200";
    case "processing":
      return "border-amber-300/20 bg-amber-400/10 text-amber-200";
    case "completed":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
    case "failed":
      return "border-rose-300/20 bg-rose-400/10 text-rose-200";
    case "cancelled":
      return "border-zinc-300/15 bg-zinc-400/10 text-zinc-300";
    case "queued":
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-400";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeRenderTask(task: RenderTask): RenderTask {
  const legacyStatus = task.status as RenderTask["status"] | "running";
  const status = legacyStatus === "running" ? "processing" : legacyStatus;

  return {
    ...task,
    status,
    attempts: task.attempts || 0,
  };
}

export function FilmPackStudio() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [series, setSeries] = useState<StudioSeries>(defaultSeries);
  const [project, setProject] = useState<StudioProject>(defaultProject);
  const [world, setWorld] = useState<StudioWorld>(defaultWorld);
  const [character, setCharacter] = useState<StudioCharacter>(defaultCharacter);
  const [episodes, setEpisodes] = useState<StudioEpisode[]>(() => buildDefaultEpisodes(defaultSeries.targetEpisodes));
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("episode-1");
  const [referenceTag, setReferenceTag] = useState(DEFAULT_REFERENCE_TAG);
  const [sceneCount, setSceneCount] = useState<SceneCountInput>("auto");
  const [style, setStyle] = useState<FilmTone>("cinematic anime");
  const [colorGradePreset, setColorGradePreset] = useState<ColorGradePreset>("vibrant cel-shaded");
  const [strictMode, setStrictMode] = useState(true);
  const [storyIdea, setStoryIdea] = useState(defaultSeries.premise);
  const [storyLoading, setStoryLoading] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [lockedVoiceOver, setLockedVoiceOver] = useState("");
  const [masterReferenceImages, setMasterReferenceImages] = useState<string[]>([]);
  const [masterReferenceUrls, setMasterReferenceUrls] = useState("");
  const [officialMasterReference, setOfficialMasterReference] = useState<string | null>(null);
  const [beatSheet, setBeatSheet] = useState<BeatItem[]>([]);
  const [beatSceneCount, setBeatSceneCount] = useState<number | null>(null);
  const [beatLoading, setBeatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FilmPack | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [companionImages, setCompanionImages] = useState<Record<string, string>>({});
  const [sceneImageLoading, setSceneImageLoading] = useState<Record<number, boolean>>({});
  const [companionImageLoading, setCompanionImageLoading] = useState<Record<string, boolean>>({});
  const [sceneImageErrors, setSceneImageErrors] = useState<Record<number, string>>({});
  const [companionImageErrors, setCompanionImageErrors] = useState<Record<string, string>>({});
  const [companionLoading, setCompanionLoading] = useState<Record<number, "broll" | "transition" | null>>({});
  const [savedPacks, setSavedPacks] = useState<SavedFilmPackRecord[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [renderQueue, setRenderQueue] = useState<RenderTask[]>([]);
  const [queueKindFilter, setQueueKindFilter] = useState<RenderTask["kind"] | "all">("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState<RenderTask["status"] | "all">("all");
  const [imageProvider, setImageProvider] = useState<RenderProviderId>(DEFAULT_IMAGE_PROVIDER);
  const [videoProvider, setVideoProvider] = useState<RenderProviderId>(DEFAULT_VIDEO_PROVIDER);

  const selectedEpisode = useMemo(
    () => episodes.find((episode) => episode.id === selectedEpisodeId) || episodes[0],
    [episodes, selectedEpisodeId]
  );
  const currentScenes = useMemo(() => selectedEpisode?.scenes ?? [], [selectedEpisode]);
  const previousEpisode = useMemo(
    () => episodes.find((episode) => episode.episodeNumber === (selectedEpisode?.episodeNumber || 0) - 1) || null,
    [episodes, selectedEpisode]
  );
  const nextEpisode = useMemo(
    () => episodes.find((episode) => episode.episodeNumber === (selectedEpisode?.episodeNumber || 0) + 1) || null,
    [episodes, selectedEpisode]
  );
  const masterStylePrompt = useMemo(
    () => buildMasterStylePrompt(project, world, character),
    [character, project, world]
  );
  const originalScript = useMemo(
    () =>
      selectedEpisode
        ? buildEpisodeScript(series, project, world, character, selectedEpisode)
        : "",
    [character, project, selectedEpisode, series, world]
  );
  const projectColorGradeLock = useMemo(() => {
    const leadSceneLighting = result?.scenes?.[0]?.lightingColor?.trim() || currentScenes[0]?.shot.lighting;
    if (leadSceneLighting) {
      return `${getColorGradeLock(colorGradePreset, style)}; anchor to lead scene lighting: ${leadSceneLighting}`;
    }
    return getColorGradeLock(colorGradePreset, style);
  }, [colorGradePreset, currentScenes, result, style]);
  const fullCopy = useMemo(() => (result ? fullOutputCopy(result) : ""), [result]);
  const referenceSceneCount = useMemo(
    () => (result ? result.scenes.filter((scene) => scene.useReferenceImage).length : 0),
    [result]
  );
  const storyboardRuntime = useMemo(() => sumDuration(currentScenes), [currentScenes]);
  const episodesWithScenes = useMemo(
    () => episodes.filter((episode) => episode.scenes.length > 0).length,
    [episodes]
  );
  const episodesWithCliffhangers = useMemo(
    () => episodes.filter((episode) => episode.cliffhanger.trim().length > 0).length,
    [episodes]
  );
  const currentEpisodeRenderTasks = useMemo(
    () => renderQueue.filter((task) => task.episodeId === selectedEpisode?.id),
    [renderQueue, selectedEpisode]
  );
  const filteredEpisodeRenderTasks = useMemo(
    () =>
      currentEpisodeRenderTasks.filter((task) => {
        if (queueKindFilter !== "all" && task.kind !== queueKindFilter) {
          return false;
        }

        if (queueStatusFilter !== "all" && task.status !== queueStatusFilter) {
          return false;
        }

        return true;
      }),
    [currentEpisodeRenderTasks, queueKindFilter, queueStatusFilter]
  );

  useEffect(() => {
    setEpisodes((current) =>
      current.map((episode) => ({
        ...episode,
        scenes: episode.scenes.map((scene) => ({
          ...scene,
          shot:
            scene.shot.imagePrompt && scene.shot.videoPrompt
              ? scene.shot
              : createStoryboardShot(scene, masterStylePrompt, character),
        })),
      }))
    );
  }, [character, masterStylePrompt]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedFilmPackRecord[];
      if (Array.isArray(parsed)) {
        setSavedPacks(parsed);
      }
    } catch {
      setSavedPacks([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) {
        setWorkspaceReady(true);
        return;
      }

      const snapshot = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
      if (snapshot.series) setSeries(snapshot.series as StudioSeries);
      if (snapshot.project) setProject(snapshot.project as StudioProject);
      if (snapshot.world) setWorld(snapshot.world as StudioWorld);
      if (snapshot.character) setCharacter(snapshot.character as StudioCharacter);
      if (Array.isArray(snapshot.episodes) && snapshot.episodes.length > 0) {
        setEpisodes(snapshot.episodes as StudioEpisode[]);
      }
      if (typeof snapshot.selectedEpisodeId === "string") setSelectedEpisodeId(snapshot.selectedEpisodeId);
      if (typeof snapshot.referenceTag === "string") setReferenceTag(snapshot.referenceTag);
      if (snapshot.sceneCount) setSceneCount(snapshot.sceneCount as SceneCountInput);
      if (snapshot.style) setStyle(snapshot.style as FilmTone);
      if (snapshot.colorGradePreset) setColorGradePreset(snapshot.colorGradePreset as ColorGradePreset);
      if (typeof snapshot.strictMode === "boolean") setStrictMode(snapshot.strictMode);
      if (typeof snapshot.storyIdea === "string") setStoryIdea(snapshot.storyIdea);
      if (typeof snapshot.lockedVoiceOver === "string") setLockedVoiceOver(snapshot.lockedVoiceOver);
      if (typeof snapshot.masterReferenceUrls === "string") setMasterReferenceUrls(snapshot.masterReferenceUrls);
      if (Array.isArray(snapshot.renderQueue)) {
        setRenderQueue((snapshot.renderQueue as RenderTask[]).map(normalizeRenderTask));
      }
      if (snapshot.imageProvider) setImageProvider(snapshot.imageProvider);
      if (snapshot.videoProvider) setVideoProvider(snapshot.videoProvider);
    } catch {
      // Ignore malformed persisted workspace and continue with defaults.
    } finally {
      setWorkspaceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;

    const snapshot: WorkspaceSnapshot = {
      series,
      project,
      world,
      character,
      episodes,
      selectedEpisodeId,
      referenceTag,
      sceneCount,
      style,
      colorGradePreset,
      strictMode,
      storyIdea,
      lockedVoiceOver,
      masterReferenceUrls,
      renderQueue,
      imageProvider,
      videoProvider,
    };

    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    character,
    colorGradePreset,
    episodes,
    lockedVoiceOver,
    masterReferenceUrls,
    project,
    referenceTag,
    sceneCount,
    selectedEpisodeId,
    series,
    storyIdea,
    strictMode,
    style,
    world,
    renderQueue,
    imageProvider,
    videoProvider,
    workspaceReady,
  ]);

  const parsedMasterUrls = useMemo(
    () =>
      masterReferenceUrls
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^https?:\/\//i.test(line)),
    [masterReferenceUrls]
  );

  const referenceCandidates = useMemo(
    () => [...masterReferenceImages, ...parsedMasterUrls],
    [masterReferenceImages, parsedMasterUrls]
  );

  const effectiveMasterReferences = useMemo(() => {
    if (officialMasterReference) {
      return [officialMasterReference];
    }
    return referenceCandidates;
  }, [officialMasterReference, referenceCandidates]);

  useEffect(() => {
    if (!referenceCandidates.length) {
      setOfficialMasterReference(null);
      return;
    }

    if (!officialMasterReference || !referenceCandidates.includes(officialMasterReference)) {
      setOfficialMasterReference(referenceCandidates[0]);
    }
  }, [officialMasterReference, referenceCandidates]);

  const persistSavedPacks = (records: SavedFilmPackRecord[]) => {
    setSavedPacks(records);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  };

  const saveCurrentPack = () => {
    if (!result) return;
    const record: SavedFilmPackRecord = {
      id: crypto.randomUUID(),
      title: result.title,
      style: result.style,
      sceneCount: result.scenes.length,
      createdAt: new Date().toISOString(),
      filmPack: result,
    };
    persistSavedPacks([record, ...savedPacks].slice(0, 50));
  };

  const openSavedPack = (id: string) => {
    const target = savedPacks.find((record) => record.id === id);
    if (!target) return;

    setResult(target.filmPack);
    if (target.filmPack.colorGradePreset) {
      setColorGradePreset(target.filmPack.colorGradePreset);
    }
    setBeatSheet(target.filmPack.beatSheet || []);
    setBeatSceneCount(target.filmPack.beatSheet?.length || target.filmPack.scenes.length);
    setSceneImages({});
    setCompanionImages({});
    setSceneImageLoading({});
    setCompanionImageLoading({});
    setSceneImageErrors({});
    setCompanionImageErrors({});
    setCompanionLoading({});
  };

  const deleteSavedPack = (id: string) => {
    persistSavedPacks(savedPacks.filter((record) => record.id !== id));
  };

  const onUploadMasterRefs = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 4);
    const dataUrls = await Promise.all(files.map((file) => resizeImageFile(file)));
    setMasterReferenceImages(dataUrls.filter(Boolean));
  };

  const updateSeries = (field: keyof StudioSeries, value: string | number) => {
    setSeries((current) => ({ ...current, [field]: value }));
    if (field === "targetEpisodes") {
      const episodeCount = Number(value) || 30;
      setEpisodes(buildDefaultEpisodes(episodeCount));
      setSelectedEpisodeId("episode-1");
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
      setRenderQueue([]);
    }
  };

  const updateProject = (field: keyof StudioProject, value: string | number) => {
    setProject((current) => ({ ...current, [field]: value }));
  };

  const updateWorld = (field: keyof StudioWorld, value: string) => {
    setWorld((current) => ({ ...current, [field]: value }));
  };

  const updateEpisodeField = (field: keyof StudioEpisode, value: string | number) => {
    if (!selectedEpisode) return;
    setEpisodes((current) => {
      const updated = updateEpisodeById(current, selectedEpisode.id, (episode) => ({
        ...episode,
        [field]: value,
      }));

      if (field === "cliffhanger") {
        return propagateNextEpisodeHook(
          updated,
          selectedEpisode.episodeNumber,
          current.find((episode) => episode.episodeNumber === selectedEpisode.episodeNumber + 1)?.title
        );
      }

      return updated;
    });
  };

  const updateScene = (id: string, field: keyof StudioScene, value: string) => {
    if (!selectedEpisode) return;
    setEpisodes((current) =>
      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
        ...episode,
        scenes: updateSceneById(episode.scenes, id, (scene) => ({ ...scene, [field]: value })),
      }))
    );
  };

  const updateShotField = (id: string, field: keyof StudioScene["shot"], value: string | number) => {
    if (!selectedEpisode) return;
    setEpisodes((current) =>
      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
        ...episode,
        scenes: updateSceneById(episode.scenes, id, (scene) => ({
          ...scene,
          shot: {
            ...scene.shot,
            [field]: value,
          },
        })),
      }))
    );
  };

  const autoStoryboardAll = () => {
    if (!selectedEpisode) return;
    setEpisodes((current) =>
      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
        ...episode,
        status: promoteEpisodeStatus(episode.status, "storyboard"),
        scenes: episode.scenes.map((scene) => ({
          ...scene,
          shot: createStoryboardShot(scene, masterStylePrompt, character),
        })),
      }))
    );
  };

  const onGenerateSeries = async () => {
    setSeriesLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: storyIdea,
          episodeCount: series.targetEpisodes,
          style,
          durationSeconds: project.durationSeconds,
          tone: project.tone,
          genre: project.genre,
          format: project.format,
        }),
      });

      const payload = (await response.json().catch(() => null)) as (GenerateSeriesResponse & { error?: string }) | null;
      if (!response.ok || !payload?.episodes) {
        throw new Error(payload?.error || "Series generation failed.");
      }

      setSeries((current) => ({
        ...current,
        seriesTitle: payload.seriesTitle,
        premise: payload.premise,
        seasonLabel: payload.seasonLabel,
        seasonArc: payload.seasonArc,
        hookFormula: payload.hookFormula,
        targetEpisodes: payload.episodes.length,
      }));
      setProject((current) => ({
        ...current,
        title: payload.seriesTitle,
      }));
      setEpisodes(mergeGeneratedEpisodes(payload.episodes));
      setSelectedEpisodeId("episode-1");
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
      setRenderQueue([]);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Series generation failed.";
      setError(message);
    } finally {
      setSeriesLoading(false);
    }
  };

  const onGenerateStory = async () => {
    setStoryLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: storyIdea,
          style,
          durationSeconds: project.durationSeconds,
          episodeCount: series.targetEpisodes,
          format: project.format,
        }),
      });

      const payload = (await response.json().catch(() => null)) as (GenerateStoryResponse & { error?: string }) | null;
      if (!response.ok || !payload?.project || !payload?.world || !payload?.character) {
        throw new Error(payload?.error || "Story generation failed.");
      }

      setSeries((current) => ({
        ...current,
        seriesTitle: payload.seriesTitle,
        premise: payload.premise,
        seasonLabel: payload.seasonLabel,
        seasonArc: payload.seasonArc,
        hookFormula: payload.hookFormula,
      }));
      setProject((current) => ({
        ...current,
        title: payload.project.title,
        genre: payload.project.genre,
        tone: payload.project.tone,
        animationStyle: payload.project.animationStyle,
      }));
      setWorld(payload.world);
      setCharacter(payload.character);
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
      setRenderQueue([]);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Story generation failed.";
      setError(message);
    } finally {
      setStoryLoading(false);
    }
  };

  const onRegenerateEpisode = async () => {
    if (!selectedEpisode) return;

    setEpisodeLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/regenerate-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: storyIdea,
          style,
          durationSeconds: project.durationSeconds,
          tone: project.tone,
          genre: project.genre,
          format: project.format,
          seriesTitle: series.seriesTitle,
          premise: series.premise,
          seasonLabel: series.seasonLabel,
          seasonArc: series.seasonArc,
          hookFormula: series.hookFormula,
          episodeCount: episodes.length,
          targetEpisodeNumber: selectedEpisode.episodeNumber,
          previousCliffhanger: previousEpisode?.cliffhanger || "",
          nextEpisodeTitle: nextEpisode?.title || "",
        }),
      });

      const payload = (await response.json().catch(() => null)) as (RegenerateEpisodeResponse & { error?: string }) | null;
      if (!response.ok || !payload?.episode) {
        throw new Error(payload?.error || "Episode regeneration failed.");
      }

      setEpisodes((current) =>
        {
          const updated = updateEpisodeById(current, selectedEpisode.id, (episode) =>
            mergeGeneratedEpisode(payload.episode, episode)
          );
          return propagateNextEpisodeHook(
            updated,
            selectedEpisode.episodeNumber,
            current.find((episode) => episode.episodeNumber === selectedEpisode.episodeNumber + 1)?.title
          );
        }
      );
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Episode regeneration failed.";
      setError(message);
    } finally {
      setEpisodeLoading(false);
    }
  };

  const onGenerateEpisodeScenes = async () => {
    if (!selectedEpisode) return;

    setSceneLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-episode-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesTitle: series.seriesTitle,
          premise: series.premise,
          seasonArc: series.seasonArc,
          style,
          genre: project.genre,
          tone: project.tone,
          world: `${world.setting}; ${world.environment}; ${world.weather}; ${world.architecture}; palette ${world.palette}`,
          character: `${character.name}; ${character.role}; ${character.appearance}; ${character.outfit}; ${character.power}`,
          episodeNumber: selectedEpisode.episodeNumber,
          episodeTitle: selectedEpisode.title,
          summary: selectedEpisode.summary,
          hook: selectedEpisode.hook,
          conflict: selectedEpisode.conflict,
          action: selectedEpisode.action,
          climax: selectedEpisode.climax,
          ending: selectedEpisode.ending,
          cliffhanger: selectedEpisode.cliffhanger,
          sceneCount: 10,
        }),
      });

      const payload = (await response.json().catch(() => null)) as (GenerateEpisodeScenesResponse & { error?: string }) | null;
      if (!response.ok || !payload?.scenes) {
        throw new Error(payload?.error || "Episode scene generation failed.");
      }

      setEpisodes((current) =>
        updateEpisodeById(current, selectedEpisode.id, (episode) => ({
          ...episode,
          status: promoteEpisodeStatus(episode.status, "scenes"),
          scenes: mergeGeneratedScenes(payload.scenes, episode.scenes),
        }))
      );
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Episode scene generation failed.";
      setError(message);
    } finally {
      setSceneLoading(false);
    }
  };

  const generateBeatSheet = async (): Promise<GenerateBeatSheetResponse> => {
    if (!selectedEpisode) {
      throw new Error("No episode selected.");
    }

    setBeatLoading(true);
    try {
      const response = await fetch("/api/generate-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            title: `${series.seriesTitle} - EP${selectedEpisode.episodeNumber} ${selectedEpisode.title}`,
            originalScript,
            lockedVoiceOver,
            referenceTag,
            sceneCount,
            style,
            colorGradePreset,
            strictMode,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as GenerateBeatSheetResponse & { error?: string } | null;
      if (!response.ok || !payload?.beatSheet) {
        throw new Error(payload?.error || "Beat sheet generation failed.");
      }

      setBeatSheet(payload.beatSheet);
      setBeatSceneCount(payload.sceneCount);
      return { beatSheet: payload.beatSheet, sceneCount: payload.sceneCount };
    } finally {
      setBeatLoading(false);
    }
  };

  const generateSceneImage = async (scene: SceneItem | CompanionShot) => {
    if (!result || !selectedEpisode) return;
    const isCompanion = "id" in scene;
    const loadingKey = isCompanion ? scene.id : scene.sceneNumber;

    if (isCompanion) {
      setCompanionImageLoading((prev) => ({ ...prev, [loadingKey]: true }));
      setCompanionImageErrors((prev) => ({ ...prev, [loadingKey]: "" }));
    } else {
      setSceneImageLoading((prev) => ({ ...prev, [loadingKey]: true }));
      setSceneImageErrors((prev) => ({ ...prev, [loadingKey]: "" }));
    }

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: scene.imagePrompt,
          sceneNumber: isCompanion ? scene.parentSceneNumber : scene.sceneNumber,
          useReferenceImage: scene.useReferenceImage,
          referenceTag,
          style,
          colorGradePreset,
          lightingColor: scene.lightingColor,
          projectColorGradeLock,
          strictMode,
          continuitySeed: `${series.seriesTitle}|EP${selectedEpisode.episodeNumber}|${referenceTag || "NO_REF"}`,
          masterReferenceImages: effectiveMasterReferences,
        }),
      });

      const raw = await response.text();
      let payload: { imageDataUrl?: string; error?: string } = {};
      try {
        payload = JSON.parse(raw) as { imageDataUrl?: string; error?: string };
      } catch {
        payload = {
          error: raw.includes("Request Entity Too Large")
            ? "Request too large. Use fewer or smaller master reference images."
            : raw || "Image generation failed (non-JSON response).",
        };
      }

      if (!response.ok || !payload.imageDataUrl) {
        throw new Error(payload.error || "Image generation failed.");
      }

      if (isCompanion) {
        setCompanionImages((prev) => ({ ...prev, [loadingKey]: payload.imageDataUrl as string }));
      } else {
        setSceneImages((prev) => ({ ...prev, [loadingKey]: payload.imageDataUrl as string }));
      }
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Image generation failed.";
      if (isCompanion) {
        setCompanionImageErrors((prev) => ({ ...prev, [loadingKey]: message }));
      } else {
        setSceneImageErrors((prev) => ({ ...prev, [loadingKey]: message }));
      }
    } finally {
      if (isCompanion) {
        setCompanionImageLoading((prev) => ({ ...prev, [loadingKey]: false }));
      } else {
        setSceneImageLoading((prev) => ({ ...prev, [loadingKey]: false }));
      }
    }
  };

  const generateCompanionShot = async (scene: SceneItem, kind: "broll" | "transition") => {
    if (!result) return;

    setCompanionLoading((prev) => ({ ...prev, [scene.sceneNumber]: kind }));
    setCompanionImageErrors((prev) => ({
      ...prev,
      [`scene-${scene.sceneNumber}-broll`]: "",
      [`scene-${scene.sceneNumber}-transition`]: "",
    }));

    try {
      const response = await fetch("/api/generate-companion-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: result.title,
          style: result.style,
          colorGradePreset,
          settingNote: result.settingNote,
          characterReferenceGuidance: result.characterReferenceGuidance,
          referenceTag,
          projectColorGradeLock,
          strictMode,
          scene,
        }),
      });

      const raw = await response.text();
      let payload: GenerateCompanionShotPayload | null = null;
      try {
        payload = JSON.parse(raw) as GenerateCompanionShotPayload;
      } catch {
        payload = { error: raw || "Failed to generate companion shot." };
      }

      if (!response.ok || !payload?.shot) {
        throw new Error(payload?.error || "Failed to generate companion shot.");
      }

      const createdShot = payload.shot;
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((item) =>
            item.sceneNumber === scene.sceneNumber
              ? {
                  ...item,
                  companionShots: [...(item.companionShots || []), createdShot],
                }
              : item
          ),
        };
      });

      await generateSceneImage(createdShot);
    } catch (generationError) {
      const message =
        generationError instanceof Error ? generationError.message : "Failed to generate companion shot.";
      setCompanionImageErrors((prev) => ({ ...prev, [`scene-${scene.sceneNumber}-${kind}`]: message }));
    } finally {
      setCompanionLoading((prev) => ({ ...prev, [scene.sceneNumber]: null }));
    }
  };

  const onGenerate = async () => {
    if (!selectedEpisode) return;

    setLoading(true);
    setError(null);

    try {
      const beatResponse = await generateBeatSheet();
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            title: `${series.seriesTitle} - EP${selectedEpisode.episodeNumber} ${selectedEpisode.title}`,
            originalScript,
            lockedVoiceOver,
            referenceTag,
            sceneCount,
            style,
            colorGradePreset,
            strictMode,
          },
          beatSheet: beatResponse.beatSheet,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Anime pack generation failed.");
      }

      const payload = (await response.json()) as GenerateResponse;
      setResult(payload.filmPack);
      setEpisodes((current) =>
        updateEpisodeById(current, selectedEpisode.id, (episode) => ({
          ...episode,
          status: promoteEpisodeStatus(episode.status, "generated"),
        }))
      );
      setBeatSheet(payload.filmPack.beatSheet || beatResponse.beatSheet);
      setBeatSceneCount(payload.filmPack.beatSheet?.length || beatResponse.sceneCount);
      setSceneImages({});
      setCompanionImages({});
      setSceneImageLoading({});
      setCompanionImageLoading({});
      setSceneImageErrors({});
      setCompanionImageErrors({});
      setCompanionLoading({});
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Anime pack generation failed.";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const bulkExportPayload = {
    series,
    project,
    world,
    character,
    episodes,
  };

  const queueCurrentEpisodeTasks = (kind: RenderTask["kind"]) => {
    const provider = kind === "image" ? imageProvider : videoProvider;

    setRenderQueue((current) => {
      const freshTasks = current.filter(
        (task) => !(task.episodeId === selectedEpisode.id && task.kind === kind && task.status === "queued")
      );

      const additions = currentScenes.map((scene) => {
        const completedImageTask = current
          .slice()
          .reverse()
          .find(
            (task) =>
              task.episodeId === selectedEpisode.id &&
              task.sceneId === scene.id &&
              task.kind === "image" &&
              task.status === "completed" &&
              typeof task.outputUrl === "string"
          );
        const inputImageUrl =
          kind === "video" ? completedImageTask?.outputUrl || officialMasterReference || effectiveMasterReferences[0] : undefined;

        return {
          id: crypto.randomUUID(),
          episodeId: selectedEpisode.id,
          episodeNumber: selectedEpisode.episodeNumber,
          sceneId: scene.id,
          sceneTitle: scene.title,
          kind,
          provider,
          status: "queued" as const,
          prompt: kind === "image" ? scene.shot.imagePrompt : scene.shot.videoPrompt,
          inputImageUrl,
          payload: buildRenderProviderPayload({
            providerId: provider,
            episodeNumber: selectedEpisode.episodeNumber,
            sceneTitle: scene.title,
            prompt: kind === "image" ? scene.shot.imagePrompt : scene.shot.videoPrompt,
            promptImage: inputImageUrl,
            durationSeconds: scene.shot.durationSeconds,
            camera: scene.shot.camera,
            lighting: scene.shot.lighting,
            aspectRatio: "9:16",
          }),
          attempts: 0,
          createdAt: new Date().toISOString(),
        };
      });

      return [...freshTasks, ...additions];
    });
  };

  const retryRenderTask = (taskId: string) => {
    setRenderQueue((current) =>
      current.map((task) =>
        task.id === taskId && (task.status === "failed" || task.status === "cancelled")
          ? {
              ...task,
              status: "queued",
              error: "",
              outputUrl: undefined,
              providerJobId: undefined,
              submittedAt: undefined,
              processingAt: undefined,
              completedAt: undefined,
              failedAt: undefined,
              cancelledAt: undefined,
            }
          : task
      )
    );
  };

  const cancelRenderTask = (taskId: string) => {
    setRenderQueue((current) =>
      current.map((task) =>
        task.id === taskId &&
        (task.status === "queued" || task.status === "submitted" || task.status === "processing")
          ? { ...task, status: "cancelled", error: task.error || "", cancelledAt: new Date().toISOString() }
          : task
      )
    );
  };

  const retryFailedEpisodeTasks = () => {
    setRenderQueue((current) =>
      current.map((task) =>
        task.episodeId === selectedEpisode.id && (task.status === "failed" || task.status === "cancelled")
          ? {
              ...task,
              status: "queued",
              error: "",
              outputUrl: undefined,
              providerJobId: undefined,
              submittedAt: undefined,
              processingAt: undefined,
              completedAt: undefined,
              failedAt: undefined,
              cancelledAt: undefined,
            }
          : task
      )
    );
  };

  const cancelActiveEpisodeTasks = () => {
    setRenderQueue((current) =>
      current.map((task) =>
        task.episodeId === selectedEpisode.id &&
        (task.status === "queued" || task.status === "submitted" || task.status === "processing")
          ? { ...task, status: "cancelled", error: task.error || "", cancelledAt: new Date().toISOString() }
          : task
      )
    );
  };

  const clearCompletedEpisodeTasks = () => {
    setRenderQueue((current) =>
      current.filter((task) => !(task.episodeId === selectedEpisode.id && task.status === "completed"))
    );
  };

  useEffect(() => {
    const nextTask = renderQueue.find((task) => task.status === "queued" && task.kind === "image");
    if (!nextTask) return;

    let cancelled = false;

    const run = async () => {
      const submittedAt = new Date().toISOString();
      const providerJobId = `${nextTask.provider}-${crypto.randomUUID()}`;

      setRenderQueue((current) =>
        current.map((task) =>
          task.id === nextTask.id && task.status === "queued"
            ? {
                ...task,
                status: "submitted",
                providerJobId,
                attempts: (task.attempts || 0) + 1,
                submittedAt,
                processingAt: undefined,
                completedAt: undefined,
                failedAt: undefined,
                cancelledAt: undefined,
                error: "",
              }
            : task
        )
      );

      await sleep(150);
      if (cancelled) return;

      const processingAt = new Date().toISOString();
      setRenderQueue((current) =>
        current.map((task) =>
          task.id === nextTask.id && task.status === "submitted"
            ? { ...task, status: "processing", processingAt }
            : task
        )
      );

      try {
        const targetEpisode = episodes.find((episode) => episode.id === nextTask.episodeId);
        const targetScene = targetEpisode?.scenes.find((scene) => scene.id === nextTask.sceneId);
        if (!targetEpisode || !targetScene) {
          throw new Error("Scene not found for queued render task.");
        }

        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagePrompt: targetScene.shot.imagePrompt,
            sceneNumber: Number(targetScene.id.replace("scene-", "")) || 1,
            useReferenceImage: true,
            referenceTag,
            style,
            colorGradePreset,
            lightingColor: targetScene.shot.lighting,
            projectColorGradeLock,
            strictMode,
            continuitySeed: `${series.seriesTitle}|EP${targetEpisode.episodeNumber}|${referenceTag || "NO_REF"}`,
            masterReferenceImages: effectiveMasterReferences,
          }),
        });

        const raw = await response.text();
        let payload: { imageDataUrl?: string; error?: string } = {};
        try {
          payload = JSON.parse(raw) as { imageDataUrl?: string; error?: string };
        } catch {
          payload = { error: raw || "Image generation failed." };
        }

        if (!response.ok || !payload.imageDataUrl) {
          throw new Error(payload.error || "Image generation failed.");
        }

        if (cancelled) return;

        setRenderQueue((current) =>
          current.map((task) =>
            task.id === nextTask.id
              ? task.status === "cancelled"
                ? task
                : {
                    ...task,
                    status: "completed",
                    outputUrl: payload.imageDataUrl,
                    error: "",
                    completedAt: new Date().toISOString(),
                  }
              : task
          )
        );
      } catch (error) {
        if (cancelled) return;
        setRenderQueue((current) =>
          current.map((task) =>
            task.id === nextTask.id
              ? task.status === "cancelled"
                ? task
                : {
                    ...task,
                    status: "failed",
                    error: error instanceof Error ? error.message : "Render task failed.",
                    failedAt: new Date().toISOString(),
                  }
              : task
          )
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    colorGradePreset,
    effectiveMasterReferences,
    episodes,
    projectColorGradeLock,
    referenceTag,
    renderQueue,
    series.seriesTitle,
    strictMode,
    style,
  ]);

  useEffect(() => {
    const queuedVideos = renderQueue.filter((task) => task.status === "queued" && task.kind === "video");
    if (queuedVideos.length === 0) return;

    let cancelled = false;

    const run = async () => {
      const firstVideo = queuedVideos[0];
      const adapter = getVideoProviderAdapter(firstVideo.provider as RenderProviderId);

      try {
        const submission = await adapter.submitJob({
          providerId: firstVideo.provider as RenderProviderId,
          episodeNumber: firstVideo.episodeNumber,
          sceneTitle: firstVideo.sceneTitle,
          prompt: firstVideo.prompt,
          promptImage: firstVideo.inputImageUrl || officialMasterReference || effectiveMasterReferences[0] || "",
          durationSeconds:
            episodes
              .find((episode) => episode.id === firstVideo.episodeId)
              ?.scenes.find((scene) => scene.id === firstVideo.sceneId)?.shot.durationSeconds || 5,
          camera:
            episodes
              .find((episode) => episode.id === firstVideo.episodeId)
              ?.scenes.find((scene) => scene.id === firstVideo.sceneId)?.shot.camera || "cinematic vertical tracking",
          lighting:
            episodes
              .find((episode) => episode.id === firstVideo.episodeId)
              ?.scenes.find((scene) => scene.id === firstVideo.sceneId)?.shot.lighting || "stylized dramatic lighting",
          aspectRatio: "9:16",
        });

        setRenderQueue((current) =>
          current.map((task) =>
            task.id === firstVideo.id && task.status === "queued"
              ? {
                  ...task,
                  status: submission.status,
                  providerJobId: submission.providerJobId,
                  attempts: (task.attempts || 0) + 1,
                  submittedAt: submission.acceptedAt,
                  processingAt: undefined,
                  completedAt: undefined,
                  failedAt: undefined,
                  cancelledAt: undefined,
                  error: "",
                }
              : task
          )
        );

        while (!cancelled) {
          await sleep(250);
          const snapshot = await adapter.getJobStatus(submission.providerJobId);
          if (cancelled) return;

          if (snapshot.status === "submitted") {
            setRenderQueue((current) =>
              current.map((task) =>
                task.id === firstVideo.id && task.status !== "cancelled"
                  ? { ...task, status: "submitted" }
                  : task
              )
            );
            continue;
          }

          if (snapshot.status === "processing") {
            setRenderQueue((current) =>
              current.map((task) =>
                task.id === firstVideo.id && task.status !== "cancelled"
                  ? {
                      ...task,
                      status: "processing",
                      processingAt: task.processingAt || new Date().toISOString(),
                    }
                  : task
              )
            );
            continue;
          }

          if (snapshot.status === "completed") {
            setRenderQueue((current) =>
              current.map((task) =>
                task.id === firstVideo.id
                  ? task.status === "cancelled"
                    ? task
                    : {
                        ...task,
                        status: "completed",
                        outputUrl: snapshot.outputUrl,
                        completedAt: new Date().toISOString(),
                      }
                  : task
              )
            );
            return;
          }

          setRenderQueue((current) =>
            current.map((task) =>
              task.id === firstVideo.id
                ? task.status === "cancelled"
                  ? task
                  : {
                      ...task,
                      status: "failed",
                      error: snapshot.error || "Provider job failed.",
                      failedAt: new Date().toISOString(),
                    }
                : task
            )
          );
          return;
        }
      } catch (error) {
        if (cancelled) return;
        setRenderQueue((current) =>
          current.map((task) =>
            task.id === firstVideo.id
              ? task.status === "cancelled"
                ? task
                : {
                    ...task,
                    status: "failed",
                    error: error instanceof Error ? error.message : "Provider job failed.",
                    failedAt: new Date().toISOString(),
                  }
              : task
          )
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [effectiveMasterReferences, episodes, officialMasterReference, renderQueue]);

  if (!selectedEpisode) {
    return null;
  }

  const exportWorkspaceJson = () => {
    const snapshot: WorkspaceSnapshot = {
      series,
      project,
      world,
      character,
      episodes,
      selectedEpisodeId,
      referenceTag,
      sceneCount,
      style,
      colorGradePreset,
      strictMode,
      storyIdea,
      lockedVoiceOver,
      masterReferenceUrls,
      renderQueue,
      imageProvider,
      videoProvider,
    };

    downloadFile(
      JSON.stringify(snapshot, null, 2),
      `${series.seriesTitle}-workspace.json`,
      "application/json"
    );
  };

  const onImportWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
      setSeries(snapshot.series);
      setProject(snapshot.project);
      setWorld(snapshot.world);
      setCharacter(snapshot.character);
      setEpisodes(snapshot.episodes);
      setSelectedEpisodeId(snapshot.selectedEpisodeId || "episode-1");
      setReferenceTag(snapshot.referenceTag || DEFAULT_REFERENCE_TAG);
      setSceneCount(snapshot.sceneCount || "auto");
      setStyle(snapshot.style || "cinematic anime");
      setColorGradePreset(snapshot.colorGradePreset || "vibrant cel-shaded");
      setStrictMode(snapshot.strictMode ?? true);
      setStoryIdea(snapshot.storyIdea || snapshot.series?.premise || "");
      setLockedVoiceOver(snapshot.lockedVoiceOver || "");
      setMasterReferenceUrls(snapshot.masterReferenceUrls || "");
      setRenderQueue((snapshot.renderQueue || []).map(normalizeRenderTask));
      setImageProvider(snapshot.imageProvider || DEFAULT_IMAGE_PROVIDER);
      setVideoProvider(snapshot.videoProvider || DEFAULT_VIDEO_PROVIDER);
      setResult(null);
      setBeatSheet([]);
      setBeatSceneCount(null);
      setError(null);
    } catch {
      setError("Failed to import workspace JSON.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 xl:px-8">
      <section className="mb-6 rounded-[28px] border border-white/15 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-4xl">
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-300">AI Animation Series Studio</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">One Idea to a Full Animated Series</h1>
            <p className="mt-3 text-sm text-zinc-300 sm:text-base">
              Build a series bible, generate an episode list, then enter a dedicated episode workspace for storyboard,
              prompts, and video-ready output.
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-3 text-xs text-zinc-300 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-zinc-500">Series</p>
              <p className="mt-1 font-semibold text-zinc-100">{series.seriesTitle}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-zinc-500">Episodes</p>
              <p className="mt-1 font-semibold text-zinc-100">{episodes.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-zinc-500">Current Episode</p>
              <p className="mt-1 font-semibold text-zinc-100">EP{selectedEpisode.episodeNumber}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-zinc-500">Runtime</p>
              <p className="mt-1 font-semibold text-zinc-100">{storyboardRuntime}s</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-[28px] border border-white/10 bg-zinc-950/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">How To Use This Studio</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">Follow the workflow from story to scene assets</h2>
          </div>
          <p className="max-w-xl text-right text-xs text-zinc-400">
            This studio does not output one finished episode file yet. It builds the story, scenes, prompts, images,
            and per-scene video tasks in production order.
          </p>
        </div>
        <div className="grid gap-3 xl:grid-cols-5">
          {STUDIO_STEPS.map((item) => (
            <div key={item.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">{item.step}</p>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{item.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Story Lab</p>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              Step 1. Use this panel to turn one idea into a series bible, then rebuild the season structure whenever
              you want a new direction.
            </p>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Idea</span>
                <textarea
                  value={storyIdea}
                  onChange={(event) => setStoryIdea(event.target.value)}
                  className="min-h-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Series Title</span>
                <input
                  value={series.seriesTitle}
                  onChange={(event) => updateSeries("seriesTitle", event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Premise</span>
                <textarea
                  value={series.premise}
                  onChange={(event) => updateSeries("premise", event.target.value)}
                  className="min-h-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Season Label</span>
                <input
                  value={series.seasonLabel}
                  onChange={(event) => updateSeries("seasonLabel", event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Episode Count</span>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={series.targetEpisodes}
                  onChange={(event) => updateSeries("targetEpisodes", Number(event.target.value) || 30)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGenerateStory}
                  disabled={storyLoading}
                  className="flex-1 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-60"
                >
                  {storyLoading ? "Generating Story..." : "Generate Story"}
                </button>
                <InfoTip text="Creates the story foundation: series title, premise, season arc, world, and main character setup." />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGenerateSeries}
                  disabled={seriesLoading}
                  className="flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {seriesLoading ? "Generating Series..." : "Generate Series"}
                </button>
                <InfoTip text="Expands the story into a season map with episode titles, hooks, summaries, and cliffhangers." />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={exportWorkspaceJson}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]"
                >
                  Import JSON
                </button>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={onImportWorkspace}
                className="hidden"
              />
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Season Arc</span>
                <textarea
                  value={series.seasonArc}
                  onChange={(event) => updateSeries("seasonArc", event.target.value)}
                  className="min-h-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Cliffhanger Formula</span>
                <textarea
                  value={series.hookFormula}
                  onChange={(event) => updateSeries("hookFormula", event.target.value)}
                  className="min-h-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Project / World / Character</p>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              Step 2. This block defines the show bible: project identity, world rules, and the hero details that every
              scene should inherit.
            </p>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Project Title</span>
                <input
                  value={project.title}
                  onChange={(event) => updateProject("title", event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Genre</span>
                <textarea
                  value={project.genre}
                  onChange={(event) => updateProject("genre", event.target.value)}
                  className="min-h-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Tone</span>
                <textarea
                  value={project.tone}
                  onChange={(event) => updateProject("tone", event.target.value)}
                  className="min-h-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">World</span>
                <textarea
                  value={world.setting}
                  onChange={(event) => updateWorld("setting", event.target.value)}
                  className="min-h-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Character</span>
                <textarea
                  value={`${character.name}, ${character.role}, ${character.power}`}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCharacter((current) => ({ ...current, power: value }));
                  }}
                  className="min-h-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Episodes</p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                {episodes.length} total
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              Step 3. Pick the episode you want to develop. The selected episode drives the middle workspace and the
              right-side render queue.
            </p>
            <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
              {episodes.map((episode) => {
                const active = episode.id === selectedEpisodeId;
                return (
                  <button
                    key={episode.id}
                    type="button"
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-cyan-300/50 bg-cyan-400/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">EP{episode.episodeNumber}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(episode.status)}`}>
                        {episode.status}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-zinc-100">{episode.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{episode.cliffhanger}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Series Overview Board</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-100">{series.seasonLabel} Episode Map</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Step 3. Review the whole season, compare hooks and cliffhangers, and jump into any episode card to
                  continue production.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {episodes.length} episodes
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {episodesWithScenes} with scenes
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {episodesWithCliffhangers} with cliffhangers
                </span>
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(toSeriesMarkdown(bulkExportPayload), `${series.seriesTitle}-season.md`, "text/markdown");
                    setEpisodes((current) =>
                      current.map((episode) => ({
                        ...episode,
                        status: promoteEpisodeStatus(episode.status, "exported"),
                      }))
                    );
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  Bulk Export MD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(toSeriesText(bulkExportPayload), `${series.seriesTitle}-season.txt`, "text/plain");
                    setEpisodes((current) =>
                      current.map((episode) => ({
                        ...episode,
                        status: promoteEpisodeStatus(episode.status, "exported"),
                      }))
                    );
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  Bulk Export TXT
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {episodes.map((episode) => {
                const active = episode.id === selectedEpisodeId;
                const hasGeneratedScenes = episode.scenes.length > 0;

                return (
                  <button
                    key={`board-${episode.id}`}
                    type="button"
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-cyan-300/50 bg-cyan-400/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        EP{episode.episodeNumber}
                      </span>
                      <div className="flex gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(episode.status)}`}>
                          {episode.status}
                        </span>
                        {hasGeneratedScenes ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            {episode.scenes.length} scenes
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-base font-medium text-zinc-100">{episode.title}</p>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">{episode.summary}</p>
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Hook</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{episode.hook}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Cliffhanger</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{episode.cliffhanger}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Episode Workspace</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-100">
                  EP{selectedEpisode.episodeNumber} {selectedEpisode.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Step 4. Build one episode at a time: shape the outline, generate scenes, storyboard shots, then
                  create the episode pack.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={masterStylePrompt} label="Copy master style" />
                <button
                  type="button"
                  onClick={onRegenerateEpisode}
                  disabled={episodeLoading}
                  className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-60"
                >
                  {episodeLoading ? "Regenerating Episode..." : "Regenerate Episode"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onGenerateEpisodeScenes}
                    disabled={sceneLoading}
                    className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-60"
                  >
                    {sceneLoading ? "Generating Scenes..." : "Generate Episode Scenes"}
                  </button>
                  <InfoTip text="Breaks the selected episode into scene titles, purposes, and story beats." />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autoStoryboardAll}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Auto Storyboard
                  </button>
                  <InfoTip text="Generates shot type, camera, emotion, lighting, and prompts for all scenes in this episode." />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(["summary", "hook", "conflict", "action", "climax", "ending", "cliffhanger"] as const).map((field) => (
                <label key={field} className="grid gap-1.5 text-sm">
                  <span className="capitalize text-zinc-300">{field}</span>
                  <textarea
                    value={String(selectedEpisode[field])}
                    onChange={(event) => updateEpisodeField(field, event.target.value)}
                    className={`rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring ${
                      field === "summary" ? "min-h-24 lg:col-span-2" : "min-h-20"
                    }`}
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Previous</p>
                {previousEpisode ? (
                  <>
                    <p className="mt-1 text-sm font-medium text-zinc-100">
                      EP{previousEpisode.episodeNumber} {previousEpisode.title}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">{previousEpisode.cliffhanger}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-zinc-400">No previous episode.</p>
                )}
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Current Continuity</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">Hook: {selectedEpisode.hook}</p>
                <p className="mt-2 text-xs text-zinc-400">Cliffhanger: {selectedEpisode.cliffhanger}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Next</p>
                {nextEpisode ? (
                  <>
                    <p className="mt-1 text-sm font-medium text-zinc-100">
                      EP{nextEpisode.episodeNumber} {nextEpisode.title}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">{nextEpisode.hook}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-zinc-400">No next episode.</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">Master Style Prompt</p>
                <CopyButton text={masterStylePrompt} label="Copy" />
              </div>
              <p className="text-sm leading-relaxed text-zinc-300 [overflow-wrap:anywhere]">{masterStylePrompt}</p>
            </div>
          </div>

          <div className="grid gap-4">
            {currentScenes.map((scene, index) => (
              <article key={scene.id} className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Scene {index + 1}</p>
                    <input
                      value={scene.title}
                      onChange={(event) => updateScene(scene.id, "title", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-0 py-0 text-xl font-semibold text-zinc-100 outline-none"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300">
                    {scene.shot.durationSeconds}s • {scene.shot.shotType}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-3">
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-zinc-300">Purpose</span>
                      <textarea
                        value={scene.purpose}
                        onChange={(event) => updateScene(scene.id, "purpose", event.target.value)}
                        className="min-h-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-zinc-300">Beat</span>
                      <textarea
                        value={scene.beat}
                        onChange={(event) => updateScene(scene.id, "beat", event.target.value)}
                        className="min-h-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Image Prompt</span>
                        <textarea
                          value={scene.shot.imagePrompt}
                          onChange={(event) => updateShotField(scene.id, "imagePrompt", event.target.value)}
                          className="min-h-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Video Prompt</span>
                        <textarea
                          value={scene.shot.videoPrompt}
                          onChange={(event) => updateShotField(scene.id, "videoPrompt", event.target.value)}
                          className="min-h-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Shot Type</span>
                        <input
                          value={scene.shot.shotType}
                          onChange={(event) => updateShotField(scene.id, "shotType", event.target.value)}
                          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Camera</span>
                        <input
                          value={scene.shot.camera}
                          onChange={(event) => updateShotField(scene.id, "camera", event.target.value)}
                          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Emotion</span>
                        <input
                          value={scene.shot.emotion}
                          onChange={(event) => updateShotField(scene.id, "emotion", event.target.value)}
                          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-zinc-300">Lighting</span>
                        <input
                          value={scene.shot.lighting}
                          onChange={(event) => updateShotField(scene.id, "lighting", event.target.value)}
                          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-zinc-300">Duration</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={scene.shot.durationSeconds}
                        onChange={(event) => updateShotField(scene.id, "durationSeconds", Number(event.target.value) || 1)}
                        className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEpisodes((current) =>
                          updateEpisodeById(current, selectedEpisode.id, (episode) => ({
                            ...episode,
                            status: promoteEpisodeStatus(episode.status, "storyboard"),
                            scenes: updateSceneById(episode.scenes, scene.id, (item) => ({
                              ...item,
                              shot: createStoryboardShot(item, masterStylePrompt, character),
                            })),
                          }))
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]"
                    >
                      Refresh Shot Prompt
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Generation Panel</p>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Reference Tag</span>
                <input
                  value={referenceTag}
                  onChange={(event) => setReferenceTag(event.target.value)}
                  placeholder="[AKI_REF]"
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Scene Count</span>
                <select
                  value={sceneCount}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSceneCount(value === "auto" ? "auto" : (Number(value) as SceneCountInput));
                  }}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                >
                  {SCENE_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count === "auto" ? "Auto" : `${count} scenes`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Anime Style</span>
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value as FilmTone)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                >
                  {FILM_STYLES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Color Grade Preset</span>
                <select
                  value={colorGradePreset}
                  onChange={(event) => setColorGradePreset(event.target.value as ColorGradePreset)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                >
                  {COLOR_GRADE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Locked VO</span>
                <textarea
                  value={lockedVoiceOver}
                  onChange={(event) => setLockedVoiceOver(event.target.value)}
                  placeholder="Optional final narration"
                  className="min-h-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div>
                <span className="text-sm font-medium text-zinc-100">Strict Mode</span>
                <p className="text-xs text-zinc-400">Cleaner continuity and tighter output.</p>
              </div>
              <button
                type="button"
                onClick={() => setStrictMode((value) => !value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  strictMode
                    ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-200"
                    : "border-white/20 bg-black/40 text-zinc-300"
                }`}
              >
                {strictMode ? "ON" : "OFF"}
              </button>
            </label>
            <div className="mt-4 grid gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={loading || beatLoading}
                  className="flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {loading ? "Generating Episode..." : beatLoading ? "Generating Beat Sheet..." : "Generate Episode Pack"}
                </button>
                <InfoTip text="Produces the structured episode package with beat sheet, prompts, and export-ready planning output." />
              </div>
              <CopyButton text={originalScript} label="Copy episode script" />
            </div>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Character References</p>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Upload 1-4 master images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onUploadMasterRefs}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-200"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-300">Master image URLs</span>
                <textarea
                  value={masterReferenceUrls}
                  onChange={(event) => setMasterReferenceUrls(event.target.value)}
                  className="min-h-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 outline-none ring-cyan-300/40 focus:ring"
                />
              </label>
              {referenceCandidates.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {referenceCandidates.map((src, index) => {
                    const isOfficial = officialMasterReference === src;
                    return (
                      <div key={`${src.slice(0, 40)}-${index}`} className={`overflow-hidden rounded-xl border ${isOfficial ? "border-cyan-300/70" : "border-white/10"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Master ref ${index + 1}`} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setOfficialMasterReference(src)}
                          className={`w-full border-t px-2 py-1 text-[11px] font-medium ${
                            isOfficial
                              ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-200"
                              : "border-white/10 bg-black/30 text-zinc-300"
                          }`}
                        >
                          {isOfficial ? "Official ref" : "Set official"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Episode Summary</p>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              This panel is your quick episode brief. It summarizes what the current episode is trying to do before you
              render any assets.
            </p>
            <div className="space-y-2 text-sm text-zinc-300">
              <p><span className="font-semibold text-zinc-100">Series:</span> {series.seriesTitle}</p>
              <p><span className="font-semibold text-zinc-100">Episode:</span> EP{selectedEpisode.episodeNumber} {selectedEpisode.title}</p>
              <p><span className="font-semibold text-zinc-100">Status:</span> {selectedEpisode.status}</p>
              <p><span className="font-semibold text-zinc-100">Cliffhanger:</span> {selectedEpisode.cliffhanger}</p>
              <p><span className="font-semibold text-zinc-100">Master Prompt:</span> {masterStylePrompt}</p>
              <p><span className="font-semibold text-zinc-100">Color Lock:</span> {projectColorGradeLock}</p>
              {beatSheet.length > 0 ? (
                <p><span className="font-semibold text-zinc-100">Beat Sheet:</span> {beatSceneCount || beatSheet.length} beats</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Render Queue</p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => queueCurrentEpisodeTasks("image")}
                    className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    Queue Images
                  </button>
                  <InfoTip text="Adds one image render task for each scene in the current episode." />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => queueCurrentEpisodeTasks("video")}
                    className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-medium text-sky-200 transition hover:bg-sky-400/20"
                  >
                    Queue Videos
                  </button>
                  <InfoTip text="Adds one video job per scene, usually using the generated scene image as the starting frame." />
                </div>
                <button
                  type="button"
                  onClick={retryFailedEpisodeTasks}
                  disabled={!currentEpisodeRenderTasks.some((task) => task.status === "failed" || task.status === "cancelled")}
                  className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
                >
                  Retry Failed
                </button>
                <button
                  type="button"
                  onClick={cancelActiveEpisodeTasks}
                  disabled={
                    !currentEpisodeRenderTasks.some(
                      (task) =>
                        task.status === "queued" || task.status === "submitted" || task.status === "processing"
                    )
                  }
                  className="rounded-full border border-zinc-300/15 bg-zinc-400/10 px-3 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-400/20 disabled:opacity-40"
                >
                  Cancel Active
                </button>
                <button
                  type="button"
                  onClick={clearCompletedEpisodeTasks}
                  disabled={!currentEpisodeRenderTasks.some((task) => task.status === "completed")}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                >
                  Clear Completed
                </button>
              </div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              Step 5. Queue scene images first, then queue scene videos. Each task here represents one scene asset, not
              a full finished episode file.
            </p>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-[11px] text-zinc-400">
                <span>Image Provider</span>
                <select
                  value={imageProvider}
                  onChange={(event) => setImageProvider(event.target.value as RenderProviderId)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none ring-cyan-300/40 focus:ring"
                >
                  {getProvidersByKind("image").map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] text-zinc-400">
                <span>Video Provider</span>
                <select
                  value={videoProvider}
                  onChange={(event) => setVideoProvider(event.target.value as RenderProviderId)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none ring-cyan-300/40 focus:ring"
                >
                  {getProvidersByKind("video").map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-[11px] text-zinc-400">
                <span>Kind Filter</span>
                <select
                  value={queueKindFilter}
                  onChange={(event) => setQueueKindFilter(event.target.value as RenderTask["kind"] | "all")}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none ring-cyan-300/40 focus:ring"
                >
                  <option value="all">All kinds</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="grid gap-1 text-[11px] text-zinc-400">
                <span>Status Filter</span>
                <select
                  value={queueStatusFilter}
                  onChange={(event) => setQueueStatusFilter(event.target.value as RenderTask["status"] | "all")}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none ring-cyan-300/40 focus:ring"
                >
                  <option value="all">All statuses</option>
                  <option value="queued">Queued</option>
                  <option value="submitted">Submitted</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                total {currentEpisodeRenderTasks.length}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                queued {currentEpisodeRenderTasks.filter((task) => task.status === "queued").length}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                submitted {currentEpisodeRenderTasks.filter((task) => task.status === "submitted").length}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                processing {currentEpisodeRenderTasks.filter((task) => task.status === "processing").length}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                done {currentEpisodeRenderTasks.filter((task) => task.status === "completed").length}
              </span>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {currentEpisodeRenderTasks.length === 0 ? (
                <p className="text-sm text-zinc-500">No render tasks yet.</p>
              ) : filteredEpisodeRenderTasks.length === 0 ? (
                <p className="text-sm text-zinc-500">No tasks match the current filters.</p>
              ) : (
                filteredEpisodeRenderTasks
                  .slice()
                  .reverse()
                  .map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{task.sceneTitle}</p>
                          <p className="text-[11px] text-zinc-500">
                            {task.kind} via {getProviderDefinition(task.provider as RenderProviderId).label}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${renderTaskTone(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{task.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(task.status === "failed" || task.status === "cancelled") ? (
                          <button
                            type="button"
                            onClick={() => retryRenderTask(task.id)}
                            className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                          >
                            Retry
                          </button>
                        ) : null}
                        {(task.status === "queued" || task.status === "submitted" || task.status === "processing") ? (
                          <button
                            type="button"
                            onClick={() => cancelRenderTask(task.id)}
                            className="rounded-full border border-zinc-300/15 bg-zinc-400/10 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-400/20"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                      {task.outputUrl && /^https?:|^data:/.test(task.outputUrl) ? (
                        <a
                          href={task.outputUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          Open output
                        </a>
                      ) : task.outputUrl ? (
                        <p className="mt-2 text-xs text-cyan-300">Provider returned output: {task.outputUrl}</p>
                      ) : null}
                      <div className="mt-2 grid gap-1 text-[11px] text-zinc-500">
                        <p>Attempts: {task.attempts}</p>
                        {task.providerJobId ? <p>Job ID: {task.providerJobId}</p> : null}
                        {task.submittedAt ? <p>Submitted: {task.submittedAt}</p> : null}
                        {task.processingAt ? <p>Processing: {task.processingAt}</p> : null}
                        {task.completedAt ? <p>Completed: {task.completedAt}</p> : null}
                        {task.failedAt ? <p>Failed: {task.failedAt}</p> : null}
                        {task.cancelledAt ? <p>Cancelled: {task.cancelledAt}</p> : null}
                      </div>
                      {task.kind === "video" ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-zinc-400">Provider payload</summary>
                          <pre className="mt-2 overflow-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-zinc-300">
                            {task.payload}
                          </pre>
                        </details>
                      ) : null}
                      {task.error ? <p className="mt-2 text-xs text-rose-300">{task.error}</p> : null}
                    </div>
                  ))
              )}
            </div>
          </div>

          <RulesPanel />
        </aside>
      </section>

      {result ? (
        <section className="mt-8 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-100">{result.title}</h2>
                <p className="text-sm text-zinc-300">{result.style}</p>
                <p className="text-xs text-zinc-400">{colorGradePreset}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={fullCopy} label="Copy full output" />
                <button
                  type="button"
                  onClick={() => {
                    saveCurrentPack();
                    setEpisodes((current) =>
                      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
                        ...episode,
                        status: promoteEpisodeStatus(episode.status, "exported"),
                      }))
                    );
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15"
                >
                  Save Archive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(toFilmPackText(result), "episode-pack.txt", "text/plain");
                    setEpisodes((current) =>
                      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
                        ...episode,
                        status: promoteEpisodeStatus(episode.status, "exported"),
                      }))
                    );
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15"
                >
                  Download TXT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(toFilmPackMarkdown(result), "episode-pack.md", "text/markdown");
                    setEpisodes((current) =>
                      updateEpisodeById(current, selectedEpisode.id, (episode) => ({
                        ...episode,
                        status: promoteEpisodeStatus(episode.status, "exported"),
                      }))
                    );
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15"
                >
                  Download Markdown
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-xs text-zinc-300">
              <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1">{result.scenes.length} scenes</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1">{referenceSceneCount} reference-tag scenes</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1">strict mode: {strictMode ? "on" : "off"}</span>
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <p><span className="font-semibold text-zinc-100">World note:</span> {result.settingNote}</p>
              <p><span className="font-semibold text-zinc-100">Preserved VO:</span> {result.preservedVoiceOverScript}</p>
              <p><span className="font-semibold text-zinc-100">Character Reference Guidance:</span> {result.characterReferenceGuidance}</p>
              <p><span className="font-semibold text-zinc-100">Episode cliffhanger:</span> {selectedEpisode.cliffhanger}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {result.scenes.map((scene) => (
              <SceneCard
                key={`${scene.sceneNumber}-${scene.voLine.slice(0, 20)}`}
                scene={scene}
                generatedImageUrl={sceneImages[scene.sceneNumber]}
                generatingImage={sceneImageLoading[scene.sceneNumber]}
                imageError={sceneImageErrors[scene.sceneNumber]}
                companionImageUrls={companionImages}
                companionImageLoading={companionImageLoading}
                companionImageErrors={companionImageErrors}
                generatingCompanionKind={companionLoading[scene.sceneNumber] || null}
                companionActionError={
                  companionImageErrors[`scene-${scene.sceneNumber}-broll`] ||
                  companionImageErrors[`scene-${scene.sceneNumber}-transition`]
                }
                onGenerateImage={generateSceneImage}
                onGenerateCompanion={generateCompanionShot}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Saved Archives</h3>
        {savedPacks.length === 0 ? (
          <p className="text-sm text-zinc-400">No saved episode packs yet.</p>
        ) : (
          <div className="space-y-2">
            {savedPacks.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="text-sm text-zinc-300">
                  <p className="font-medium text-zinc-100">{record.title}</p>
                  <p className="text-xs text-zinc-400">
                    {record.style} · {record.sceneCount} scenes · {new Date(record.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openSavedPack(record.id)}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedPack(record.id)}
                    className="rounded-md border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
