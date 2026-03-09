import { NextResponse } from "next/server";
import { z } from "zod";
import { getModelName, getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  seriesTitle: z.string().trim().min(1).max(200),
  premise: z.string().trim().min(1).max(3000),
  seasonArc: z.string().trim().min(1).max(3000),
  style: z.string().trim().min(2).max(120),
  genre: z.string().trim().min(2).max(200),
  tone: z.string().trim().min(2).max(200),
  world: z.string().trim().min(2).max(3000),
  character: z.string().trim().min(2).max(3000),
  episodeNumber: z.number().int().min(1).max(50),
  episodeTitle: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(3000),
  hook: z.string().trim().min(1).max(1000),
  conflict: z.string().trim().min(1).max(1000),
  action: z.string().trim().min(1).max(1000),
  climax: z.string().trim().min(1).max(1000),
  ending: z.string().trim().min(1).max(1000),
  cliffhanger: z.string().trim().min(1).max(1000),
  sceneCount: z.number().int().min(6).max(16).default(10),
});

const responseSchema = z.object({
  scenes: z.array(
    z.object({
      title: z.string().min(1),
      purpose: z.string().min(1),
      beat: z.string().min(1),
    })
  ),
});

const responseJsonSchema = {
  name: "episode_scenes",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scenes: {
        type: "array",
        minItems: 6,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            purpose: { type: "string" },
            beat: { type: "string" },
          },
          required: ["title", "purpose", "beat"],
        },
      },
    },
    required: ["scenes"],
  },
} as const;

function buildPrompt(input: z.infer<typeof requestSchema>) {
  return `
You are breaking one short-form animated episode into storyboard-ready scenes.

Return valid JSON only.

Series:
- title: ${input.seriesTitle}
- premise: ${input.premise}
- season arc: ${input.seasonArc}
- style: ${input.style}
- genre: ${input.genre}
- tone: ${input.tone}
- world: ${input.world}
- character: ${input.character}

Episode:
- episode number: ${input.episodeNumber}
- title: ${input.episodeTitle}
- summary: ${input.summary}
- hook: ${input.hook}
- conflict: ${input.conflict}
- action: ${input.action}
- climax: ${input.climax}
- ending: ${input.ending}
- cliffhanger: ${input.cliffhanger}

Task:
- Generate exactly ${input.sceneCount} scenes.
- Each scene must have:
  - title
  - purpose
  - beat
- Keep scenes concise, visual, and suitable for vertical short animation.
- Distribute the episode rhythm from hook to cliffhanger.
- Do not generate shot prompts yet.
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
      throw new Error("No episode scenes returned from model.");
    }

    const payload = responseSchema.parse(JSON.parse(raw));
    if (payload.scenes.length !== parsed.sceneCount) {
      return NextResponse.json(
        { error: `Scene generator returned ${payload.scenes.length} scenes; expected ${parsed.sceneCount}.` },
        { status: 502 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid episode scene request or output format." }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected episode scene generator error." }, { status: 500 });
  }
}
