import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";
import { normalizeBeatSheet } from "@/lib/beat-sheet";
import { enforceFilmPackGuardrails } from "@/lib/output-guardrails";
import { buildPrompt } from "@/lib/prompts/promptBuilder";
import { filmPackJsonSchema } from "@/lib/prompts/outputSchema";
import { filmPackSchema, generateRequestSchema } from "@/lib/schemas";
import { passesVoFidelity } from "@/lib/vo-fidelity";
import { resolveSceneCount } from "@/lib/scene-count";
import { splitVoiceOverIntoSceneBeats } from "@/lib/vo-segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const providedBeatSheet =
      parsedBody.beatSheet && parsedBody.beatSheet.length === sceneCount
        ? normalizeBeatSheet(parsedBody.beatSheet, sceneCount)
        : undefined;
    const sceneBeats = providedBeatSheet?.map((beat) => beat.voLine)
      ?? (lockedVoiceOver ? splitVoiceOverIntoSceneBeats(lockedVoiceOver, sceneCount) : undefined);

    const client = getOpenAIClient();

    const generateOnce = async (extraInstruction?: string) => {
      const response = await client.responses.create({
        model: getModelName(),
        temperature: strictMode ? 0.18 : 0.55,
        input: [
          {
            role: "user",
            content: buildPrompt(parsedBody.settings.originalScript, {
              title: parsedBody.settings.title,
              referenceTag: parsedBody.settings.referenceTag,
              lockedVoiceOver,
              sceneCount,
              style: parsedBody.settings.style,
              colorGradePreset: parsedBody.settings.colorGradePreset,
              strictMode,
              sceneBeats,
              beatSheet: providedBeatSheet,
              extraInstruction,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            ...filmPackJsonSchema,
          },
        },
      });

      const raw = response.output_text;
      if (!raw) {
        throw new Error("No content returned from model.");
      }

      const candidate = JSON.parse(raw);
      const parsedFilmPack = filmPackSchema.parse(candidate);
      return enforceFilmPackGuardrails(parsedFilmPack, { strictMode });
    };

    let filmPack = await generateOnce();

    if (!lockedVoiceOver && !passesVoFidelity(parsedBody.settings.originalScript, filmPack.preservedVoiceOverScript, strictMode)) {
      filmPack = await generateOnce(
        "The preservedVoiceOverScript drifted. Regenerate with very high fidelity to source wording. " +
          "Do not add new claims. Keep narration concise by trimming only redundancy."
      );
    }

    if (filmPack.scenes.length !== sceneCount) {
      return NextResponse.json(
        {
          error: `Model returned ${filmPack.scenes.length} scenes; expected ${sceneCount}. Please retry.`,
        },
        { status: 502 }
      );
    }

    if (lockedVoiceOver) {
      filmPack = {
        ...filmPack,
        preservedVoiceOverScript: lockedVoiceOver,
        scenes: filmPack.scenes.map((scene, index) => ({
          ...scene,
          voLine: sceneBeats?.[index] || scene.voLine,
        })),
      };
    } else if (!passesVoFidelity(parsedBody.settings.originalScript, filmPack.preservedVoiceOverScript, strictMode)) {
      return NextResponse.json(
        { error: "VO drifted too far from source script. Please retry or keep Strict Mode ON." },
        { status: 502 }
      );
    }

    if (providedBeatSheet) {
      filmPack = {
        ...filmPack,
        beatSheet: providedBeatSheet,
        scenes: filmPack.scenes.map((scene, index) => {
          const beat = providedBeatSheet[index];
          if (!beat) return scene;

          return {
            ...scene,
            phase: beat.phase,
            importance: beat.importance,
            voLine: beat.voLine,
            shotType:
              beat.role === "transition"
                ? "transition B-roll"
                : beat.role === "broll" &&
                    !["environment", "symbolic insert", "transition B-roll", "atmospheric insert"].includes(
                      scene.shotType
                    )
                  ? "atmospheric insert"
                  : scene.shotType,
            scenePurpose:
              beat.role === "hero"
                ? scene.scenePurpose
                : `${beat.role === "transition" ? "Transition coverage" : "B-roll coverage"}: ${beat.purpose}`,
          };
        }),
      };
    }

    filmPack = {
      ...filmPack,
      colorGradePreset: parsedBody.settings.colorGradePreset,
    };

    return NextResponse.json({ filmPack });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request or output format.", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
