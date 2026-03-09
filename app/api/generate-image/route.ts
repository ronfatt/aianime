import { NextResponse } from "next/server";
import { z } from "zod";

const generateImageSchema = z.object({
  imagePrompt: z.string().min(8).max(4000),
  sceneNumber: z.number().int().positive(),
  useReferenceImage: z.boolean(),
  referenceTag: z.string().optional().or(z.literal("")),
  style: z.string().min(1),
  colorGradePreset: z.string().min(1).max(80).optional(),
  lightingColor: z.string().min(1).max(300).optional(),
  projectColorGradeLock: z.string().min(1).max(300).optional(),
  strictMode: z.boolean().optional(),
  continuitySeed: z.string().min(1).max(200).optional(),
  masterReferenceImages: z.array(z.string().min(10)).max(8).optional(),
});

type Provider = "gemini" | "kling";

function buildLockedImagePrompt(input: z.infer<typeof generateImageSchema>): string {
  const locks = [
    "one dominant readable subject",
    "vertical 9:16 anime composition",
    "stylized anime keyframe look",
    "clean silhouette readability",
    "do not drift into live-action photorealism",
    "keep color grading consistent with the same project palette",
    "do not swing wildly between palette families across scenes unless explicitly required",
  ];

  if (input.useReferenceImage && input.referenceTag?.trim()) {
    locks.push(`keep character identity consistent with reference tag ${input.referenceTag.trim()}`);
    locks.push("avoid changing facial identity across scenes");
  }

  if (input.continuitySeed) {
    locks.push(`continuity seed ${input.continuitySeed}`);
  }

  if (input.strictMode !== false) {
    locks.push("strict continuity mode");
  }

  if ((input.masterReferenceImages || []).length > 0) {
    locks.push("must match identity in provided master reference images");
  }

  const colorNotes = [
    input.colorGradePreset ? `Color grade preset: ${input.colorGradePreset}` : "",
    input.projectColorGradeLock ? `Project color grade lock: ${input.projectColorGradeLock}` : "",
    input.lightingColor ? `Scene lighting/color target: ${input.lightingColor}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return `${input.imagePrompt}. Style: ${input.style}. ${colorNotes ? `${colorNotes}. ` : ""}Locks: ${locks.join(
    ", "
  )}. Output a single best frame.`;
}

function parseDataUrlImage(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function findInlineImageData(node: unknown): { mimeType: string; data: string } | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as Record<string, unknown>;

  const inline = (candidate.inlineData || candidate.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === "string") {
    const mimeType = typeof inline.mimeType === "string" ? inline.mimeType : "image/png";
    return { mimeType, data: inline.data };
  }

  for (const value of Object.values(candidate)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findInlineImageData(item);
        if (found) return found;
      }
    } else {
      const found = findInlineImageData(value);
      if (found) return found;
    }
  }

  return null;
}

function findStringImageUrl(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as Record<string, unknown>;
  const directUrl = candidate.url;
  if (typeof directUrl === "string" && /^https?:\/\//i.test(directUrl)) {
    return directUrl;
  }

  for (const value of Object.values(candidate)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findStringImageUrl(item);
        if (found) return found;
      }
    } else {
      const found = findStringImageUrl(value);
      if (found) return found;
    }
  }

  return null;
}

function extractKlingResultUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data as Record<string, unknown> | undefined) || root;
  const taskResult = (data.task_result as Record<string, unknown> | undefined) || {};

  const images = taskResult.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          return url;
        }
      }
    }
  }

  const seriesImages = taskResult.series_images;
  if (Array.isArray(seriesImages)) {
    for (const item of seriesImages) {
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          return url;
        }
      }
    }
  }

  return null;
}

function findBase64Image(node: unknown): { mimeType: string; data: string } | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as Record<string, unknown>;
  const keys = ["b64_json", "base64", "image_base64", "imageBase64"];

  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "string" && value.length > 100) {
      return { mimeType: "image/png", data: value };
    }
  }

  for (const value of Object.values(candidate)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findBase64Image(item);
        if (found) return found;
      }
    } else {
      const found = findBase64Image(value);
      if (found) return found;
    }
  }

  return null;
}

function hashToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0) % 2147483647;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractKlingTaskId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data as Record<string, unknown> | undefined) || root;
  const taskId = data.task_id || data.taskId;
  return typeof taskId === "string" ? taskId : null;
}

function extractKlingTaskStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const data = (root.data as Record<string, unknown> | undefined) || root;
  const status = data.task_status || data.taskStatus || root.status;
  return typeof status === "string" ? status.toLowerCase() : "";
}

function buildKlingQueryUrl(taskId: string): string {
  const template = process.env.KLING_QUERY_ENDPOINT_TEMPLATE;
  if (template?.includes("{task_id}")) {
    return template.replace("{task_id}", taskId);
  }

  const base = process.env.KLING_BASE_URL || "https://api-singapore.klingai.com";
  return `${base}/v1/images/generations/${taskId}`;
}

async function generateWithGemini(
  prompt: string,
  refs: string[]
): Promise<{ ok: true; imageSrc: string; modelUsed: string } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
  const fallbackModel = process.env.GEMINI_IMAGE_FALLBACK_MODEL || "gemini-2.5-flash-image-preview";

  if (!apiKey) {
    return { ok: false, error: "Missing GEMINI_API_KEY environment variable." };
  }

  const models = Array.from(new Set([primaryModel, fallbackModel]));
  let lastError = "Gemini image generation failed.";

  for (const model of models) {
    const referenceParts = refs
      .map((ref) => parseDataUrlImage(ref))
      .filter((item): item is { mimeType: string; data: string } => Boolean(item))
      .map((item) => ({ inlineData: { mimeType: item.mimeType, data: item.data } }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, ...referenceParts] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.error as { message?: string })?.message) ||
        "Gemini image generation failed.";
      lastError = `${lastError} [${model}] ${message}`;
      continue;
    }

    const inline = findInlineImageData(data);
    if (inline) {
      return { ok: true, imageSrc: `data:${inline.mimeType};base64,${inline.data}`, modelUsed: model };
    }

    return { ok: false, error: `No image returned by Gemini model ${model}.` };
  }

  return { ok: false, error: lastError };
}

async function generateWithKling(
  prompt: string,
  payload: z.infer<typeof generateImageSchema>
): Promise<{ ok: true; imageSrc: string; modelUsed: string } | { ok: false; error: string }> {
  const apiKey = process.env.KLING_API_KEY;
  const endpoint = process.env.KLING_IMAGE_ENDPOINT || "https://api-singapore.klingai.com/v1/images/omni-image";
  const model = process.env.KLING_IMAGE_MODEL || "kling-v2-1";
  const authHeader = process.env.KLING_AUTH_HEADER || "Authorization";
  const authPrefix = process.env.KLING_AUTH_PREFIX || "Bearer";
  const pollAttempts = Number(process.env.KLING_POLL_MAX_ATTEMPTS || 12);
  const pollIntervalMs = Number(process.env.KLING_POLL_INTERVAL_MS || 1500);

  if (!apiKey) {
    return { ok: false, error: "Missing KLING_API_KEY environment variable." };
  }
  if (!endpoint) {
    return { ok: false, error: "Missing KLING_IMAGE_ENDPOINT environment variable." };
  }

  const seed = hashToSeed(`${payload.continuitySeed || "seed"}|${payload.sceneNumber}`);
  const referenceUrls = (payload.masterReferenceImages || []).filter((item) => /^https?:\/\//i.test(item));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [authHeader]: `${authPrefix} ${apiKey}`,
    },
    body: JSON.stringify({
      model_name: model,
      prompt,
      negative_prompt: "",
      image_list: referenceUrls.slice(0, 4).map((image) => ({ image })),
      n: 1,
      external_task_id: `scene_${payload.sceneNumber}_${seed}`,
      callback_url: "",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.error as { message?: string })?.message) ||
      "Kling image generation failed.";
    return { ok: false, error: message };
  }

  const immediateBase64 = findBase64Image(data);
  if (immediateBase64) {
    return { ok: true, imageSrc: `data:${immediateBase64.mimeType};base64,${immediateBase64.data}`, modelUsed: model };
  }

  const immediateUrl = findStringImageUrl(data);
  if (immediateUrl) {
    return { ok: true, imageSrc: immediateUrl, modelUsed: model };
  }

  const taskId = extractKlingTaskId(data);
  if (!taskId) {
    return { ok: false, error: "Kling create task succeeded but no task_id returned." };
  }

  const queryUrl = buildKlingQueryUrl(taskId);

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    await sleep(pollIntervalMs);

    const taskResponse = await fetch(queryUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        [authHeader]: `${authPrefix} ${apiKey}`,
      },
    });

    const taskData = await taskResponse.json().catch(() => ({}));
    if (!taskResponse.ok) {
      const message =
        (taskData && typeof taskData === "object" && (taskData.error as { message?: string })?.message) ||
        "Kling task query failed.";
      return { ok: false, error: message };
    }

    const directResultUrl = extractKlingResultUrl(taskData);
    if (directResultUrl) {
      return { ok: true, imageSrc: directResultUrl, modelUsed: model };
    }

    const polledBase64 = findBase64Image(taskData);
    if (polledBase64) {
      return { ok: true, imageSrc: `data:${polledBase64.mimeType};base64,${polledBase64.data}`, modelUsed: model };
    }

    const polledUrl = findStringImageUrl(taskData);
    if (polledUrl) {
      return { ok: true, imageSrc: polledUrl, modelUsed: model };
    }

    const status = extractKlingTaskStatus(taskData);
    if (status.includes("fail") || status.includes("error")) {
      return { ok: false, error: `Kling task failed with status: ${status}` };
    }
  }

  return { ok: false, error: "Kling task timeout while waiting for image result." };

}

function getProvider(): Provider {
  const provider = (process.env.IMAGE_PROVIDER || "gemini").toLowerCase();
  return provider === "kling" ? "kling" : "gemini";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = generateImageSchema.parse(body);

    const prompt = buildLockedImagePrompt(payload);
    const provider = getProvider();
    const refs = payload.masterReferenceImages || [];

    const primary = provider === "kling" ? await generateWithKling(prompt, payload) : await generateWithGemini(prompt, refs);

    if (primary.ok) {
      return NextResponse.json({ imageDataUrl: primary.imageSrc, modelUsed: primary.modelUsed, provider });
    }

    const fallbackProvider = (process.env.IMAGE_FALLBACK_PROVIDER || "").toLowerCase();
    if (fallbackProvider === "gemini" && provider === "kling") {
      const fallback = await generateWithGemini(prompt, refs);
      if (fallback.ok) {
        return NextResponse.json({
          imageDataUrl: fallback.imageSrc,
          modelUsed: fallback.modelUsed,
          provider: "gemini",
          fallbackFrom: "kling",
        });
      }
      return NextResponse.json(
        { error: `Kling failed: ${primary.error} | Gemini fallback failed: ${fallback.error}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: primary.error }, { status: 502 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid image generation request." }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected image generation error." }, { status: 500 });
  }
}
