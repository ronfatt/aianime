import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractRunwayError,
  extractRunwayOutputUrl,
  getRunwayModel,
  getRunwayTask,
  hasRunwayKey,
  normalizeRunwayStatus,
  submitRunwayImageToVideo,
} from "@/lib/runway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const submitSchema = z.object({
  action: z.literal("submit"),
  providerId: z.literal("runway-video"),
  request: z.object({
    providerId: z.literal("runway-video"),
    episodeNumber: z.number().int().positive(),
    sceneTitle: z.string().min(1),
    prompt: z.string().min(1).max(4000),
    promptImage: z.string().min(10),
    durationSeconds: z.number().int().min(1).max(20),
    camera: z.string().min(1).max(500),
    lighting: z.string().min(1).max(500),
    aspectRatio: z.literal("9:16"),
  }),
});

const statusSchema = z.object({
  action: z.literal("status"),
  providerId: z.literal("runway-video"),
  providerJobId: z.string().min(1),
});

function toRunwayRatio(aspectRatio: "9:16"): "720:1280" {
  return aspectRatio === "9:16" ? "720:1280" : "720:1280";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === "submit") {
      const parsed = submitSchema.parse(body);

      if (!hasRunwayKey()) {
        return NextResponse.json({ error: "Missing RUNWAY_API_KEY. Add it to .env.local." }, { status: 503 });
      }

      const response = await submitRunwayImageToVideo({
        model: getRunwayModel(),
        promptText: parsed.request.prompt,
        promptImage: parsed.request.promptImage,
        duration: parsed.request.durationSeconds,
        ratio: toRunwayRatio(parsed.request.aspectRatio),
      });

      return NextResponse.json({
        providerJobId: response.id,
        status: "submitted",
        acceptedAt: new Date().toISOString(),
        raw: response,
      });
    }

    const parsed = statusSchema.parse(body);

    if (!hasRunwayKey()) {
      return NextResponse.json({ error: "Missing RUNWAY_API_KEY. Add it to .env.local." }, { status: 503 });
    }

    const task = await getRunwayTask(parsed.providerJobId);

    return NextResponse.json({
      providerJobId: task.id,
      status: normalizeRunwayStatus(task),
      outputUrl: extractRunwayOutputUrl(task),
      error: extractRunwayError(task),
      raw: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid video job request." }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected video job error." }, { status: 500 });
  }
}
