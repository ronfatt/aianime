import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { normalizeBeatSheet, phaseByPosition } from "@/lib/beat-sheet";
import { getModelName, getOpenAIClient } from "@/lib/openai";
import { generateRequestSchema } from "@/lib/schemas";
import { resolveSceneCount } from "@/lib/scene-count";
import { splitVoiceOverIntoSceneBeats } from "@/lib/vo-segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const beatSheetResponseSchema = z.object({
  beats: z.array(
    z.object({
      beatNumber: z.number().int().positive(),
      phase: z.string(),
      role: z.string(),
      importance: z.string(),
      voLine: z.string().min(1),
      purpose: z.string().min(1),
    })
  ),
});

const beatSheetJsonSchema = {
  name: "beat_sheet",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      beats: {
        type: "array",
        minItems: 20,
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            beatNumber: { type: "integer" },
            phase: { type: "string" },
            role: { type: "string" },
            importance: { type: "string" },
            voLine: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["beatNumber", "phase", "role", "importance", "voLine", "purpose"],
        },
      },
    },
    required: ["beats"],
  },
} as const;

function buildBeatPrompt({
  sourceText,
  sceneCount,
  style,
  colorGradePreset,
  lockedVoiceOver,
  strictMode,
  beatLines,
}: {
  sourceText: string;
  sceneCount: number;
  style: string;
  colorGradePreset?: string;
  lockedVoiceOver: string;
  strictMode: boolean;
  beatLines?: string[];
}) {
  const nonHeroTarget = sceneCount >= 25 ? "5" : "4";

  return `
You are building a beat sheet for a vertical 9:16 anime short pack.

Return valid JSON only.

Goals:
- Cover the full story in order with exactly ${sceneCount} beats.
- Keep 4 story phases in order:
  Opening - Awareness
  Understanding - Reframing
  Turning Point - Action
  Impact - Closing
- Include about ${nonHeroTarget} non-hero beats total using role=broll or role=transition.
- Every other beat should stay role=hero unless there is a clear reason not to.
- importance should usually be A for hero, B for broll, C for transition.
- Keep portrait-first staging and anime production logic in mind.
- Use concise purpose lines for each beat.

Hard rules:
- Do not add new facts, events, people, or locations.
- Preserve source meaning and sequence.
- If beat lines are provided, keep each voLine exactly as provided.
- Beat count must be exactly ${sceneCount}.
- strict mode is ${strictMode ? "ON" : "OFF"}.
- style is ${style}.
- color grade preset is ${colorGradePreset || "not provided"}.
- Think in clean mobile-readable 9:16 progression.

${lockedVoiceOver ? `Locked voice over:\n${lockedVoiceOver}\n` : ""}

${
  beatLines?.length
    ? `Beat lines to annotate exactly:\n${beatLines.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n`
    : ""
}

Source text:
${sourceText.trim()}
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = generateRequestSchema.parse(body);

    const strictMode = parsedBody.settings.strictMode ?? parsedBody.strict_mode ?? true;
    const lockedVoiceOver = parsedBody.settings.lockedVoiceOver?.trim() || "";
    const sceneCount = resolveSceneCount(parsedBody.settings.sceneCount, {
      lockedVoiceOver,
      originalScript: parsedBody.settings.originalScript,
    });

    const beatLines = lockedVoiceOver
      ? splitVoiceOverIntoSceneBeats(lockedVoiceOver, sceneCount)
      : undefined;

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: getModelName(),
      temperature: strictMode ? 0.15 : 0.4,
      input: [
        {
          role: "user",
          content: buildBeatPrompt({
            sourceText: parsedBody.settings.originalScript,
            sceneCount,
            style: parsedBody.settings.style,
            colorGradePreset: parsedBody.settings.colorGradePreset,
            lockedVoiceOver,
            strictMode,
            beatLines,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...beatSheetJsonSchema,
        },
      },
    });

    const raw = response.output_text;
    if (!raw) {
      throw new Error("No beat sheet returned from model.");
    }

    const parsed = beatSheetResponseSchema.parse(JSON.parse(raw));
    let beatSheet = normalizeBeatSheet(parsed.beats, sceneCount);

    if (beatLines?.length) {
      beatSheet = beatSheet.map((beat, index) => ({
        ...beat,
        voLine: beatLines[index] || beat.voLine,
        phase: beat.phase || phaseByPosition(index, sceneCount),
      }));
    }

    if (beatSheet.length !== sceneCount) {
      return NextResponse.json(
        { error: `Beat sheet returned ${beatSheet.length} beats; expected ${sceneCount}.` },
        { status: 502 }
      );
    }

    return NextResponse.json({ beatSheet, sceneCount });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid beat sheet request or output format.", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
