export type SceneCount = 20 | 22 | 25 | 28 | 30;
export type SceneCountInput = SceneCount | "auto";
export type CompanionShotKind = "broll" | "transition";
export type BeatRole = "hero" | "broll" | "transition";
export type ColorGradePreset =
  | "vibrant cel-shaded"
  | "neon twilight"
  | "pastel dreamlight"
  | "inked dramatic contrast";

export type FilmTone =
  | "cinematic anime"
  | "shonen action"
  | "slice of life"
  | "fantasy drama";

export type SceneImportance = "A" | "B" | "C";
export type ScenePhase =
  | "Opening - Awareness"
  | "Understanding - Reframing"
  | "Turning Point - Action"
  | "Impact - Closing";
export type SceneType =
  | "environment"
  | "character close-up"
  | "behavior shot"
  | "symbolic insert"
  | "transition B-roll"
  | "atmospheric insert"
  | "POV shot"
  | "over-shoulder shot";

export interface UserSettings {
  title?: string;
  originalScript: string;
  lockedVoiceOver?: string;
  referenceTag?: string;
  sceneCount: SceneCountInput;
  style: FilmTone;
  colorGradePreset?: ColorGradePreset;
  strictMode?: boolean;
}

export interface BeatItem {
  beatNumber: number;
  phase: ScenePhase;
  role: BeatRole;
  importance: SceneImportance;
  voLine: string;
  purpose: string;
}

export interface SceneItem {
  sceneNumber: number;
  phase: ScenePhase;
  voLine: string;
  shotType: SceneType;
  scenePurpose: string;
  importance: SceneImportance;
  useReferenceImage: boolean;
  imagePrompt: string;
  videoPrompt: string;
  camera: string;
  lightingColor: string;
  companionShots?: CompanionShot[];
}

export interface CompanionShot {
  id: string;
  parentSceneNumber: number;
  label: string;
  kind: CompanionShotKind;
  phase: ScenePhase;
  voLine: string;
  shotType: SceneType;
  scenePurpose: string;
  importance: SceneImportance;
  useReferenceImage: boolean;
  imagePrompt: string;
  videoPrompt: string;
  camera: string;
  lightingColor: string;
}

export interface FilmPack {
  title: string;
  style: FilmTone;
  colorGradePreset?: ColorGradePreset;
  settingNote: string;
  preservedVoiceOverScript: string;
  characterReferenceGuidance: string;
  beatSheet?: BeatItem[];
  scenes: SceneItem[];
}

export interface GenerateFilmPackRequest {
  settings: UserSettings;
  beatSheet?: BeatItem[];
}
