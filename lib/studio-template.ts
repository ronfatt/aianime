import type {
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
  StudioSeries,
  StudioShot,
  StudioWorld,
} from "@/types/studio";

export const defaultSeries: StudioSeries = {
  seriesTitle: "Ocean Guardian",
  premise: "A young boy from a coastal village discovers he can control the ocean and must grow into the protector of his people.",
  seasonLabel: "Season 1",
  targetEpisodes: 30,
  seasonArc: "The village guardian awakens, trains, discovers the truth behind the dark tide, and defeats the ocean-born threat.",
  hookFormula: "End each episode with a visual reveal or emotional threat that makes the next episode feel necessary.",
};

export const defaultProject: StudioProject = {
  title: "Guardian of the Tidal Village",
  durationSeconds: 90,
  format: "Vertical 9:16",
  genre: "fantasy action, hero awakening, southeast asian mythology",
  tone: "epic, emotional, cinematic",
  animationStyle: "stylized CG animation, DreamWorks / Disney inspired, Unreal Engine cinematic lighting",
};

export const defaultWorld: StudioWorld = {
  setting: "Southeast Asian coastal village",
  environment: "tropical island shoreline, storm surge, dramatic waves, sacred ocean atmosphere",
  weather: "stormfront, ocean spray, dark clouds opening to blue spirit light",
  architecture: "traditional wooden stilt houses, carved docks, shrine markers, woven fishing gear",
  palette: "storm blue, seafoam cyan, wet wood brown, spirit glow azure",
};

export const defaultCharacter: StudioCharacter = {
  name: "Arin",
  role: "young guardian",
  age: "18",
  appearance: "athletic Southeast Asian warrior, wet hair, blue headband, barefoot",
  outfit: "simple coastal warrior clothes with wrapped forearms and weathered sash",
  poseLanguage: "martial arts stance, grounded center of gravity, determined upward gaze",
  power: "water energy manipulation, ocean spirit power, blue glowing currents",
};

function createShot(overrides: Partial<StudioShot>): StudioShot {
  return {
    shotType: "character close-up",
    camera: "slow push",
    emotion: "resolve",
    lighting: "storm blue with ocean rim light",
    durationSeconds: 7,
    imagePrompt: "",
    videoPrompt: "",
    ...overrides,
  };
}

export const defaultScenes: StudioScene[] = [
  {
    id: "scene-1",
    title: "Storm Arrival",
    purpose: "Open with scale, danger, and mythic atmosphere.",
    beat: "The tidal village braces as the ocean turns violent under a darkening sky.",
    shot: createShot({ shotType: "environment", camera: "descending crane", emotion: "dread", lighting: "storm blue flashes" }),
  },
  {
    id: "scene-2",
    title: "Hero Introduction",
    purpose: "Introduce the young guardian as the emotional anchor.",
    beat: "The hero stands barefoot on wet timber, watching the sea with fear and discipline.",
    shot: createShot({ shotType: "character close-up", camera: "slow push", emotion: "focus" }),
  },
  {
    id: "scene-3",
    title: "Villagers Panic",
    purpose: "Show the cost of the threat without losing visual clarity.",
    beat: "Families retreat through narrow walkways as prayer flags whip in the wind.",
    shot: createShot({ shotType: "over-shoulder shot", camera: "lateral tracking", emotion: "panic" }),
  },
  {
    id: "scene-4",
    title: "Hero Decision",
    purpose: "Mark the internal turn from fear to action.",
    beat: "The hero tightens the headband and commits to facing the wave.",
    shot: createShot({ shotType: "behavior shot", camera: "tight handheld drift", emotion: "determination" }),
  },
  {
    id: "scene-5",
    title: "Giant Wave",
    purpose: "Escalate the threat into an impossible force.",
    beat: "A mountain of water rises beyond the stilt houses and swallows the horizon.",
    shot: createShot({ shotType: "environment", camera: "tilt up reveal", emotion: "awe" }),
  },
  {
    id: "scene-6",
    title: "Leap",
    purpose: "Show courage through a bold, iconic vertical action beat.",
    beat: "The hero launches upward toward the wave as spray explodes around the frame.",
    shot: createShot({ shotType: "behavior shot", camera: "slow motion tracking rise", emotion: "courage", durationSeconds: 6 }),
  },
  {
    id: "scene-7",
    title: "Power Awakening",
    purpose: "Reveal the supernatural inheritance.",
    beat: "Blue currents ignite around the hero's arms and spiral through the rain.",
    shot: createShot({ shotType: "character close-up", camera: "orbital push", emotion: "awakening" }),
  },
  {
    id: "scene-8",
    title: "Energy Control",
    purpose: "Translate raw power into deliberate control.",
    beat: "The hero stabilizes the current with martial precision and breath control.",
    shot: createShot({ shotType: "behavior shot", camera: "circular tracking", emotion: "mastery" }),
  },
  {
    id: "scene-9",
    title: "Ocean Strike",
    purpose: "Deliver the mythic clash.",
    beat: "A blue spirit force surges forward and collides with the tidal wall.",
    shot: createShot({ shotType: "POV shot", camera: "forward charge", emotion: "impact" }),
  },
  {
    id: "scene-10",
    title: "Wave Split",
    purpose: "Create the signature hero shot.",
    beat: "The giant wave parts into two towering walls around the guardian.",
    shot: createShot({ shotType: "environment", camera: "heroic pullback", emotion: "triumph" }),
  },
  {
    id: "scene-11",
    title: "Calm Ocean",
    purpose: "Release tension and show the world restored.",
    beat: "Rain softens as the ocean settles and reflections return to the waterline.",
    shot: createShot({ shotType: "atmospheric insert", camera: "slow drift", emotion: "relief" }),
  },
  {
    id: "scene-12",
    title: "Hero Ending",
    purpose: "Land the final emotional image for short-form retention.",
    beat: "The hero stands above the quiet village as the last spirit light fades into dawn.",
    shot: createShot({ shotType: "character close-up", camera: "slow rise", emotion: "earned calm" }),
  },
];

function cloneScenes(): StudioScene[] {
  return defaultScenes.map((scene) => ({
    ...scene,
    shot: { ...scene.shot },
  }));
}

function createEpisode(index: number, previousCliffhanger?: string): StudioEpisode {
  const episodeNumber = index + 1;
  const baseTitle = [
    "The Storm",
    "The Strange Power",
    "The First Training",
    "The Hidden Enemy",
    "The Rising Waves",
    "The Village Attack",
    "The Ocean Spirit",
    "The Lost Temple",
    "The Power Awakens",
    "The First Battle",
    "The Dark Tide",
    "The Sea Monster",
    "The Broken Pier",
    "The Ancient Warrior",
    "The Training",
    "The New Strength",
    "The Ocean Trial",
    "The Hidden Truth",
    "The Enemy Appears",
    "The Village Defense",
    "The Storm Returns",
    "The Great Wave",
    "The Power of the Sea",
    "The Final Training",
    "The Dark Ocean",
    "The Rising Monster",
    "The Battle Begins",
    "The Ocean Awakens",
    "The Final Strike",
    "Guardian of the Village",
  ][index] || `Episode ${episodeNumber}`;

  const openingHook = previousCliffhanger
    ? `Resolve the previous cliffhanger: ${previousCliffhanger}`
    : "Open with an escalating visual hook tied to the ocean threat.";

  return {
    id: `episode-${episodeNumber}`,
    episodeNumber,
    status: "draft",
    title: baseTitle,
    summary: `Episode ${episodeNumber} expands the Ocean Guardian arc with a new turning point, stronger emotional stakes, and a clear cliffhanger ending.`,
    hook: openingHook,
    conflict: "The village faces an immediate threat while the hero is still unprepared.",
    action: "The hero attempts a risky move that reveals or develops ocean power.",
    climax: "The threat reaches a cinematic peak that forces decisive action.",
    ending: "The immediate danger shifts, but the deeper conflict grows more visible.",
    cliffhanger: "But the ocean was not finished with him yet.",
    durationSeconds: 75,
    scenes: cloneScenes(),
  };
}

export function buildDefaultEpisodes(targetEpisodes = 30): StudioEpisode[] {
  const episodes: StudioEpisode[] = [];

  for (let index = 0; index < targetEpisodes; index += 1) {
    const previousCliffhanger = index > 0 ? episodes[index - 1]?.cliffhanger : undefined;
    episodes.push(createEpisode(index, previousCliffhanger));
  }

  return episodes;
}

export function mergeGeneratedEpisodes(
  generatedEpisodes: Array<
    Pick<
      StudioEpisode,
      | "episodeNumber"
      | "title"
      | "summary"
      | "hook"
      | "conflict"
      | "action"
      | "climax"
      | "ending"
      | "cliffhanger"
      | "durationSeconds"
    >
  >
): StudioEpisode[] {
  return generatedEpisodes.map((episode, index) => {
    const base = buildDefaultEpisodes(index + 1)[index];

    return {
      ...base,
      ...episode,
      id: `episode-${episode.episodeNumber}`,
      status: base.status,
      scenes: base.scenes.map((scene) => ({
        ...scene,
        shot: { ...scene.shot },
      })),
    };
  });
}

export function mergeGeneratedEpisode(
  episode: Pick<
    StudioEpisode,
    | "episodeNumber"
    | "title"
    | "summary"
    | "hook"
    | "conflict"
    | "action"
    | "climax"
    | "ending"
    | "cliffhanger"
    | "durationSeconds"
  >,
  existing?: StudioEpisode
): StudioEpisode {
  const fallback = buildDefaultEpisodes(episode.episodeNumber)[episode.episodeNumber - 1];
  const base = existing || fallback;

  return {
    ...base,
    ...episode,
    id: `episode-${episode.episodeNumber}`,
    status: base.status,
    scenes: (base.scenes || fallback.scenes).map((scene) => ({
      ...scene,
      shot: { ...scene.shot },
    })),
  };
}

export function mergeGeneratedScenes(
  scenes: Array<Pick<StudioScene, "title" | "purpose" | "beat">>,
  existing?: StudioScene[]
): StudioScene[] {
  const fallback = buildDefaultEpisodes(Math.max(scenes.length, 1))[0].scenes;
  const source = existing && existing.length > 0 ? existing : fallback;

  return scenes.map((scene, index) => {
    const base = source[index] || fallback[index] || fallback[fallback.length - 1];
    return {
      ...base,
      id: `scene-${index + 1}`,
      title: scene.title,
      purpose: scene.purpose,
      beat: scene.beat,
      shot: {
        ...base.shot,
      },
    };
  });
}

export function buildMasterStylePrompt(project: StudioProject, world: StudioWorld, character: StudioCharacter): string {
  return [
    "stylized cinematic CG animation",
    project.animationStyle,
    world.setting,
    world.environment,
    world.weather,
    world.architecture,
    `palette: ${world.palette}`,
    `${character.name}, ${character.appearance}`,
    character.outfit,
    character.poseLanguage,
    character.power,
    project.tone,
    "cinematic composition",
    "vertical 9:16",
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildEpisodeScript(
  series: StudioSeries,
  project: StudioProject,
  world: StudioWorld,
  character: StudioCharacter,
  episode: StudioEpisode
): string {
  const header = `${series.seasonLabel} of ${series.seriesTitle}. Series premise: ${series.premise}. Season arc: ${series.seasonArc}.`;
  const episodeLine = `Episode ${episode.episodeNumber}: ${episode.title}. Summary: ${episode.summary}. Hook: ${episode.hook}. Conflict: ${episode.conflict}. Action: ${episode.action}. Climax: ${episode.climax}. Ending: ${episode.ending}. Cliffhanger: ${episode.cliffhanger}.`;
  const projectLine = `${project.title} is a ${episode.durationSeconds}-second ${project.genre} story in ${project.format} format. Tone: ${project.tone}. Animation style: ${project.animationStyle}.`;
  const worldLine = `World: ${world.setting}; ${world.environment}; ${world.weather}; ${world.architecture}; palette ${world.palette}.`;
  const characterLine = `Main character: ${character.name}, ${character.role}, age ${character.age}, ${character.appearance}, ${character.outfit}, ${character.poseLanguage}, power: ${character.power}.`;
  const sceneLines = episode.scenes
    .map(
      (scene, index) =>
        `Scene ${index + 1} - ${scene.title}: purpose ${scene.purpose} Beat: ${scene.beat} Shot guidance: ${scene.shot.shotType}, camera ${scene.shot.camera}, emotion ${scene.shot.emotion}, lighting ${scene.shot.lighting}, duration ${scene.shot.durationSeconds}s.`
    )
    .join(" ");

  return [header, episodeLine, projectLine, worldLine, characterLine, sceneLines].join(" ");
}

export function createStoryboardShot(scene: StudioScene, masterStylePrompt: string, character: StudioCharacter): StudioShot {
  const subject = `${character.name}, ${character.appearance}, ${character.outfit}`;
  const sceneCore = `${scene.title}, ${scene.beat}, ${scene.purpose}`;

  return {
    ...scene.shot,
    imagePrompt: `${subject}, ${sceneCore}, ${scene.shot.shotType}, ${scene.shot.lighting}, ${scene.shot.emotion}, ${masterStylePrompt}`,
    videoPrompt: `${sceneCore}, ${scene.shot.camera}, ${scene.shot.emotion}, ${scene.shot.lighting}, subtle stylized motion, layered particles, vertical anime short`,
  };
}
