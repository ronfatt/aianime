import { NextResponse } from "next/server";
import { z } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";
import type { CompanionShotKind, ScenePhase, SceneType } from "@/types/film-pack";

const generateCompanionShotSchema = z.object({
  kind: z.union([z.literal("broll"), z.literal("transition")]),
  title: z.string().min(1),
  style: z.string().min(1),
  colorGradePreset: z.string().optional().or(z.literal("")),
  settingNote: z.string().min(1),
  characterReferenceGuidance: z.string().min(1),
  referenceTag: z.string().optional().or(z.literal("")),
  projectColorGradeLock: z.string().optional().or(z.literal("")),
  strictMode: z.boolean().optional(),
  scene: z.object({
    sceneNumber: z.number().int().positive(),
    phase: z.string().min(1),
    voLine: z.string().min(1),
    shotType: z.string().min(1),
    scenePurpose: z.string().min(1),
    importance: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    useReferenceImage: z.boolean(),
    imagePrompt: z.string().min(1),
    videoPrompt: z.string().min(1),
    camera: z.string().min(1),
    lightingColor: z.string().min(1),
  }),
});

const responseSchema = {
  name: "companion_shot",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      phase: {
        type: "string",
        enum: [
          "Opening - Awareness",
          "Understanding - Reframing",
          "Turning Point - Action",
          "Impact - Closing",
        ],
      },
      voLine: { type: "string" },
      shotType: {
        type: "string",
        enum: [
          "environment",
          "character close-up",
          "behavior shot",
          "symbolic insert",
          "transition B-roll",
          "atmospheric insert",
          "POV shot",
          "over-shoulder shot",
        ],
      },
      scenePurpose: { type: "string" },
      importance: { type: "string", enum: ["A", "B", "C"] },
      useReferenceImage: { type: "boolean" },
      imagePrompt: { type: "string" },
      videoPrompt: { type: "string" },
      camera: { type: "string" },
      lightingColor: { type: "string" },
    },
    required: [
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
} as const;

function buildPrompt(input: z.infer<typeof generateCompanionShotSchema>): string {
  return `Create one ${input.kind === "broll" ? "B-roll" : "transition"} companion shot for an existing 9:16 anime scene.

Rules:
- Keep the same story phase and same VO segment.
- Do not replace the main scene. This is an extra companion shot.
- Keep the same anime world and portrait-first composition logic.
- Keep one dominant readable subject.
- If possible, reduce frontal face dependency.
- For broll: prefer environment, atmospheric insert, symbolic insert, transition B-roll.
- For transition: focus on bridging motion, space, mood, or time shift.
- Importance should usually be B or C.
- Keep prompts concise and animation-ready.
- Keep the same overall color script as the base scene and project lock.
- Do not radically change palette family unless the base scene already does that.

Project:
- title: ${input.title}
- style: ${input.style}
- color grade preset: ${input.colorGradePreset || "(not provided)"}
- world note: ${input.settingNote}
- character guidance: ${input.characterReferenceGuidance}
- reference tag: ${input.referenceTag || "(none)"}
- project color grade lock: ${input.projectColorGradeLock || input.scene.lightingColor}

Base scene:
- scene number: ${input.scene.sceneNumber}
- phase: ${input.scene.phase}
- vo line: ${input.scene.voLine}
- shot type: ${input.scene.shotType}
- purpose: ${input.scene.scenePurpose}
- importance: ${input.scene.importance}
- reference image: ${input.scene.useReferenceImage ? "yes" : "no"}
- image prompt: ${input.scene.imagePrompt}
- video prompt: ${input.scene.videoPrompt}
- camera: ${input.scene.camera}
- lighting/color: ${input.scene.lightingColor}

Return one JSON object only.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generateCompanionShotSchema.parse(body);

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: getModelName(),
      temperature: parsed.strictMode === false ? 0.55 : 0.25,
      input: [{ role: "user", content: buildPrompt(parsed) }],
      text: {
        format: {
          type: "json_schema",
          ...responseSchema,
        },
      },
    });

    const raw = response.output_text;
    if (!raw) {
      return NextResponse.json({ error: "No companion shot returned." }, { status: 502 });
    }

    const payload = JSON.parse(raw) as {
      phase: ScenePhase;
      voLine: string;
      shotType: SceneType;
      scenePurpose: string;
      importance: "A" | "B" | "C";
      useReferenceImage: boolean;
      imagePrompt: string;
      videoPrompt: string;
      camera: string;
      lightingColor: string;
    };

    const shot = {
      id: crypto.randomUUID(),
      parentSceneNumber: parsed.scene.sceneNumber,
      label: parsed.kind === "broll" ? `Scene ${parsed.scene.sceneNumber}B` : `Scene ${parsed.scene.sceneNumber}T`,
      kind: parsed.kind as CompanionShotKind,
      ...payload,
    };

    return NextResponse.json({ shot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid companion shot request." }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected companion shot error." }, { status: 500 });
  }
}
