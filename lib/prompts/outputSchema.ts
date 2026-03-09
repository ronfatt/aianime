import { ALLOWED_SCENE_PHASES, ALLOWED_SCENE_TYPES } from "@/lib/prompts/sceneRules";

export const outputSchema = `
Return output in valid JSON only.

Use this exact structure and key names:

{
  "title": "string",
  "style": "cinematic anime | shonen action | slice of life | fantasy drama",
  "settingNote": "string",
  "preservedVoiceOverScript": "string",
  "characterReferenceGuidance": "string",
  "scenes": [
    {
      "sceneNumber": 1,
      "phase": "Opening - Awareness | Understanding - Reframing | Turning Point - Action | Impact - Closing",
      "voLine": "string",
      "shotType": "environment | character close-up | behavior shot | symbolic insert | transition B-roll | atmospheric insert | POV shot | over-shoulder shot",
      "scenePurpose": "string",
      "importance": "A | B | C",
      "useReferenceImage": true,
      "imagePrompt": "string",
      "videoPrompt": "string",
      "camera": "string",
      "lightingColor": "string"
    }
  ]
}
`;

export const filmPackJsonSchema = {
  name: "film_pack",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      style: {
        type: "string",
        enum: [
          "cinematic anime",
          "shonen action",
          "slice of life",
          "fantasy drama",
        ],
      },
      settingNote: { type: "string" },
      preservedVoiceOverScript: { type: "string" },
      characterReferenceGuidance: { type: "string" },
      scenes: {
        type: "array",
        minItems: 20,
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sceneNumber: { type: "integer" },
            phase: { type: "string", enum: [...ALLOWED_SCENE_PHASES] },
            voLine: { type: "string" },
            shotType: { type: "string", enum: [...ALLOWED_SCENE_TYPES] },
            scenePurpose: { type: "string" },
            importance: { type: "string", enum: ["A", "B", "C"] },
            useReferenceImage: { type: "boolean" },
            imagePrompt: { type: "string" },
            videoPrompt: { type: "string" },
            camera: { type: "string" },
            lightingColor: { type: "string" },
          },
          required: [
            "sceneNumber",
            "phase",
            "voLine",
            "shotType",
            "scenePurpose",
            "importance",
            "useReferenceImage",
            "imagePrompt",
            "videoPrompt",
            "camera",
            "lightingColor",
          ],
        },
      },
    },
    required: [
      "title",
      "style",
      "settingNote",
      "preservedVoiceOverScript",
      "characterReferenceGuidance",
      "scenes",
    ],
  },
} as const;
