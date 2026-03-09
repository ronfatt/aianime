import type { ColorGradePreset, FilmTone, SceneCountInput } from "@/types/film-pack";

export const SCENE_COUNTS: SceneCountInput[] = ["auto", 20, 22, 25, 28, 30];

export const FILM_STYLES: FilmTone[] = [
  "cinematic anime",
  "shonen action",
  "slice of life",
  "fantasy drama",
];

export const COLOR_GRADE_PRESETS: ColorGradePreset[] = [
  "vibrant cel-shaded",
  "neon twilight",
  "pastel dreamlight",
  "inked dramatic contrast",
];

export const RULE_CHECKLIST = [
  "Preserve original meaning and keep narration around 80-90 seconds.",
  "Generate exactly selected scene count (Auto / 20 / 22 / 25 / 28 / 30).",
  "Every key scene should compose for vertical 9:16 framing.",
  "Keep one dominant subject per shot for clean mobile-first readability.",
  "If interaction is needed, use layered depth, POV, silhouette, or over-shoulder framing.",
  "Avoid crowded frames unless the story explicitly needs them.",
  "Mark protagonist scenes with reference image = yes for character consistency.",
  "Treat all outputs as stylized animation, not photoreal live action.",
  "Image/video prompts should be optimized for anime keyframe -> image-to-video workflow.",
  "Keep color continuity stable across the full short-form episode.",
];

export const SAMPLE_SCRIPT = `Rain slides down the glass towers of Neo Kyoto as Aki races through the elevated train station with a sketchbook pressed to her chest. She is late for the academy showcase, and the city screens keep flashing a countdown that makes every second feel louder.

When she reaches the platform, she notices a small maintenance robot trapped between closing gates. Everyone else rushes past. Aki stops, wedges the doors open with her bag, and frees it just before the train leaves without her.

Stranded on the empty platform, she discovers the robot is projecting fragments of unfinished memories: a child drawing stars, a rooftop garden, a promise to build a sky lantern that could carry wishes above the city haze. The images feel strangely connected to her own lost childhood.

Aki follows the robot through service corridors and neon stairwells until they emerge on a rooftop above the station. There, she rebuilds the broken lantern with pages from her sketchbook and the robot's glowing parts.

As the showcase fireworks begin in the distance, the lantern rises into the storm-blue sky. The city below still moves fast, but for one suspended moment Aki sees that the future she wants to animate is not about winning applause. It is about protecting fragile wonder before the world forgets how to look up.`;

export const DEFAULT_REFERENCE_TAG = "[AKI_REF]";
