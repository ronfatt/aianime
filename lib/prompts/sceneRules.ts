export const ALLOWED_SCENE_TYPES = [
  "environment",
  "character close-up",
  "behavior shot",
  "symbolic insert",
  "transition B-roll",
  "atmospheric insert",
  "POV shot",
  "over-shoulder shot",
] as const;

export const ALLOWED_SCENE_PHASES = [
  "Opening - Awareness",
  "Understanding - Reframing",
  "Turning Point - Action",
  "Impact - Closing",
] as const;

export const IMAGE_PROMPT_SUFFIX =
  "vertical 9:16 anime keyframe, polished cel shading, strong silhouette, cinematic portrait composition";

export const sceneRules = `
Scene generation rules:

Generate between 20 and 30 scenes.
Aim for roughly 5 B-roll or transition scenes when total scene count is 25 or more.
If total scene count is below 25, still include 4 B-roll or transition scenes.

Scene types allowed:

- environment
- character close-up
- behavior shot
- symbolic insert
- transition B-roll
- atmospheric insert
- POV shot
- over-shoulder shot

Each scene must include:

- scene number
- phase (story stage)
- VO line
- shot type
- scene purpose
- scene importance (A/B/C)
- whether character reference image is used
- image prompt
- video prompt
- camera movement
- lighting and color notes

B-roll / transition rules:
- Include a small set of non-primary scenes for pacing and coverage.
- Use about 5 scenes as B-roll or transition scenes.
- These scenes should usually be lower importance (B or C).
- Prefer these shot types for B-roll: environment, symbolic insert, transition B-roll, atmospheric insert.
- Use them to bridge emotion, location, time shift, or narration transitions without advancing new plot facts.

Story phase rules:
- Use all four stages in order:
  1) Opening - Awareness
  2) Understanding - Reframing
  3) Turning Point - Action
  4) Impact - Closing
- Distribute scenes across these stages progressively.

Image prompt guidelines:

Focus on one vertical 9:16 anime keyframe.

Describe:

- subject
- environment
- pose or emotional posture
- lighting
- portrait composition

Avoid over describing camera parameters.

Video prompt guidelines:

Focus on controlled motion for short-form animation.

Include:

- subject motion
- environmental motion
- camera move
- timing feel

Avoid excessive instructions.

If the main character appears in a scene,
assume a reference image will be used.

Do not re-describe facial identity in every shot.

Focus on:

- silhouette
- pose
- framing
- environment
- emotion
- lighting
`;
