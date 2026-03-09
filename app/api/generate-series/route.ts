import { NextResponse } from "next/server";
import { z } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(3000),
  episodeCount: z.number().int().min(3).max(50),
  style: z.string().trim().min(2).max(120),
  durationSeconds: z.number().int().min(30).max(180),
  tone: z.string().trim().min(2).max(200),
  genre: z.string().trim().min(2).max(200),
  format: z.string().trim().min(2).max(50),
});

const responseBodySchema = z.object({
  seriesTitle: z.string().min(1),
  premise: z.string().min(1),
  seasonLabel: z.string().min(1),
  seasonArc: z.string().min(1),
  hookFormula: z.string().min(1),
  episodes: z.array(
    z.object({
      episodeNumber: z.number().int().positive(),
      title: z.string().min(1),
      summary: z.string().min(1),
      hook: z.string().min(1),
      conflict: z.string().min(1),
      action: z.string().min(1),
      climax: z.string().min(1),
      ending: z.string().min(1),
      cliffhanger: z.string().min(1),
      durationSeconds: z.number().int().min(30).max(180),
    })
  ),
});

const responseJsonSchema = {
  name: "series_bible",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      seriesTitle: { type: "string" },
      premise: { type: "string" },
      seasonLabel: { type: "string" },
      seasonArc: { type: "string" },
      hookFormula: { type: "string" },
      episodes: {
        type: "array",
        minItems: 3,
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            episodeNumber: { type: "integer" },
            title: { type: "string" },
            summary: { type: "string" },
            hook: { type: "string" },
            conflict: { type: "string" },
            action: { type: "string" },
            climax: { type: "string" },
            ending: { type: "string" },
            cliffhanger: { type: "string" },
            durationSeconds: { type: "integer" },
          },
          required: [
            "episodeNumber",
            "title",
            "summary",
            "hook",
            "conflict",
            "action",
            "climax",
            "ending",
            "cliffhanger",
            "durationSeconds",
          ],
        },
      },
    },
    required: ["seriesTitle", "premise", "seasonLabel", "seasonArc", "hookFormula", "episodes"],
  },
} as const;

function buildPrompt(input: z.infer<typeof requestSchema>) {
  return `
You are designing a vertical animated short-form series bible for TikTok, Reels, Shorts, and Xiaohongshu style episodic viewing.

Return valid JSON only.

Goal:
- Turn one story idea into a coherent season with exactly ${input.episodeCount} episodes.
- Each episode should feel serialized, not standalone.
- The ending of each episode must create momentum for the next one.

Series requirements:
- Story idea: ${input.idea}
- Style: ${input.style}
- Duration per episode: ${input.durationSeconds} seconds
- Format: ${input.format}
- Genre: ${input.genre}
- Tone: ${input.tone}

Hard rules:
- Generate exactly ${input.episodeCount} episodes.
- Episode numbers must start at 1 and increment by 1.
- Keep one continuous season arc.
- Each episode must include:
  - title
  - summary
  - hook
  - conflict
  - action
  - climax
  - ending
  - cliffhanger
- Cliffhangers should naturally feed the next episode's hook.
- Summaries must be concise and production-oriented.
- Keep this viable for short-form vertical animation, not long television scenes.

Output should describe one season only.
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: getModelName(),
      temperature: 0.35,
      input: [{ role: "user", content: buildPrompt(parsed) }],
      text: {
        format: {
          type: "json_schema",
          ...responseJsonSchema,
        },
      },
    });

    const raw = response.output_text;
    if (!raw) {
      throw new Error("No series structure returned from model.");
    }

    const payload = responseBodySchema.parse(JSON.parse(raw));

    if (payload.episodes.length !== parsed.episodeCount) {
      return NextResponse.json(
        { error: `Series generator returned ${payload.episodes.length} episodes; expected ${parsed.episodeCount}.` },
        { status: 502 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid series request or output format." }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected series generator error." }, { status: 500 });
  }
}
