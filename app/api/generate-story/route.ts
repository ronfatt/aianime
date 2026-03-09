import { NextResponse } from "next/server";
import { z } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idea: z.string().trim().min(10).max(3000),
  style: z.string().trim().min(2).max(120),
  durationSeconds: z.number().int().min(30).max(180),
  episodeCount: z.number().int().min(3).max(50),
  format: z.string().trim().min(2).max(50),
});

const responseSchema = z.object({
  seriesTitle: z.string().min(1),
  premise: z.string().min(1),
  seasonLabel: z.string().min(1),
  seasonArc: z.string().min(1),
  hookFormula: z.string().min(1),
  project: z.object({
    title: z.string().min(1),
    genre: z.string().min(1),
    tone: z.string().min(1),
    animationStyle: z.string().min(1),
  }),
  world: z.object({
    setting: z.string().min(1),
    environment: z.string().min(1),
    weather: z.string().min(1),
    architecture: z.string().min(1),
    palette: z.string().min(1),
  }),
  character: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    age: z.string().min(1),
    appearance: z.string().min(1),
    outfit: z.string().min(1),
    poseLanguage: z.string().min(1),
    power: z.string().min(1),
  }),
});

const responseJsonSchema = {
  name: "story_foundation",
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
      project: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          genre: { type: "string" },
          tone: { type: "string" },
          animationStyle: { type: "string" },
        },
        required: ["title", "genre", "tone", "animationStyle"],
      },
      world: {
        type: "object",
        additionalProperties: false,
        properties: {
          setting: { type: "string" },
          environment: { type: "string" },
          weather: { type: "string" },
          architecture: { type: "string" },
          palette: { type: "string" },
        },
        required: ["setting", "environment", "weather", "architecture", "palette"],
      },
      character: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          age: { type: "string" },
          appearance: { type: "string" },
          outfit: { type: "string" },
          poseLanguage: { type: "string" },
          power: { type: "string" },
        },
        required: ["name", "role", "age", "appearance", "outfit", "poseLanguage", "power"],
      },
    },
    required: ["seriesTitle", "premise", "seasonLabel", "seasonArc", "hookFormula", "project", "world", "character"],
  },
} as const;

function buildPrompt(input: z.infer<typeof requestSchema>) {
  return `
You are creating the story foundation for a vertical animated series studio.

Return valid JSON only.

Input:
- idea: ${input.idea}
- style: ${input.style}
- episode count target: ${input.episodeCount}
- duration per episode: ${input.durationSeconds} seconds
- format: ${input.format}

Goals:
- Turn the idea into a strong series foundation before episode generation.
- Produce a usable series bible starter, world design, and main character design.
- Keep everything suitable for short-form serialized animation.

Hard rules:
- seriesTitle should feel marketable and clear.
- premise should explain the series in 1-2 sentences.
- seasonArc should define the season's main progression.
- hookFormula should explain how cliffhangers should work in this series.
- project fields should define genre, tone, and animation style.
- world fields should be visual and production-useful.
- character fields should describe one main lead character only.
- Keep all outputs practical for storyboard and prompt generation.
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: getModelName(),
      temperature: 0.45,
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
      throw new Error("No story foundation returned from model.");
    }

    const payload = responseSchema.parse(JSON.parse(raw));
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid story generation request or output format." }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected story generator error." }, { status: 500 });
  }
}
