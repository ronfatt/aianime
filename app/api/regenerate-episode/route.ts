import { NextResponse } from "next/server";
import { z } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(3000),
  style: z.string().trim().min(2).max(120),
  durationSeconds: z.number().int().min(30).max(180),
  tone: z.string().trim().min(2).max(200),
  genre: z.string().trim().min(2).max(200),
  format: z.string().trim().min(2).max(50),
  seriesTitle: z.string().trim().min(1).max(200),
  premise: z.string().trim().min(1).max(3000),
  seasonLabel: z.string().trim().min(1).max(120),
  seasonArc: z.string().trim().min(1).max(3000),
  hookFormula: z.string().trim().min(1).max(1000),
  episodeCount: z.number().int().min(3).max(50),
  targetEpisodeNumber: z.number().int().min(1).max(50),
  previousCliffhanger: z.string().trim().max(1000).optional().or(z.literal("")),
  nextEpisodeTitle: z.string().trim().max(200).optional().or(z.literal("")),
});

const episodeSchema = z.object({
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
});

const responseJsonSchema = {
  name: "single_episode",
  strict: true,
  schema: {
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
} as const;

function buildPrompt(input: z.infer<typeof requestSchema>) {
  return `
You are regenerating one episode inside an existing short-form animated series.

Return valid JSON only.

Series context:
- series title: ${input.seriesTitle}
- premise: ${input.premise}
- season label: ${input.seasonLabel}
- season arc: ${input.seasonArc}
- hook formula: ${input.hookFormula}
- total episodes: ${input.episodeCount}
- story idea: ${input.idea}
- style: ${input.style}
- genre: ${input.genre}
- tone: ${input.tone}
- format: ${input.format}
- episode duration: ${input.durationSeconds} seconds

Target:
- regenerate episode ${input.targetEpisodeNumber}
- previous cliffhanger: ${input.previousCliffhanger || "(none)"}
- next episode title: ${input.nextEpisodeTitle || "(unknown)"}

Hard rules:
- Return exactly one episode object.
- episodeNumber must be ${input.targetEpisodeNumber}.
- Make the episode feel serialized within the season arc.
- The hook should naturally pick up from the previous cliffhanger if one exists.
- The cliffhanger should create momentum toward the next episode.
- Keep the episode concise and production-oriented for vertical short animation.
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: getModelName(),
      temperature: 0.4,
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
      throw new Error("No regenerated episode returned from model.");
    }

    const payload = episodeSchema.parse(JSON.parse(raw));
    if (payload.episodeNumber !== parsed.targetEpisodeNumber) {
      return NextResponse.json(
        { error: `Model returned episode ${payload.episodeNumber}; expected ${parsed.targetEpisodeNumber}.` },
        { status: 502 }
      );
    }

    return NextResponse.json({ episode: payload });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid regenerate episode request or output format." }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected regenerate episode error." }, { status: 500 });
  }
}
