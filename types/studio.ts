export interface StudioProject {
  title: string;
  durationSeconds: number;
  format: "Vertical 9:16";
  genre: string;
  tone: string;
  animationStyle: string;
}

export interface StudioWorld {
  setting: string;
  environment: string;
  weather: string;
  architecture: string;
  palette: string;
}

export interface StudioCharacter {
  name: string;
  role: string;
  age: string;
  appearance: string;
  outfit: string;
  poseLanguage: string;
  power: string;
}

export interface StudioShot {
  shotType: string;
  camera: string;
  emotion: string;
  lighting: string;
  durationSeconds: number;
  imagePrompt: string;
  videoPrompt: string;
}

export interface StudioScene {
  id: string;
  title: string;
  purpose: string;
  beat: string;
  shot: StudioShot;
}

export type EpisodeStatus = "draft" | "scenes" | "storyboard" | "generated" | "exported";
export type RenderTaskKind = "image" | "video";
export type RenderTaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface RenderTask {
  id: string;
  episodeId: string;
  episodeNumber: number;
  sceneId: string;
  sceneTitle: string;
  kind: RenderTaskKind;
  provider: string;
  status: RenderTaskStatus;
  prompt: string;
  payload: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
}

export interface StudioEpisode {
  id: string;
  episodeNumber: number;
  status: EpisodeStatus;
  title: string;
  summary: string;
  hook: string;
  conflict: string;
  action: string;
  climax: string;
  ending: string;
  cliffhanger: string;
  durationSeconds: number;
  scenes: StudioScene[];
}

export interface StudioSeries {
  seriesTitle: string;
  premise: string;
  seasonLabel: string;
  targetEpisodes: number;
  seasonArc: string;
  hookFormula: string;
}
