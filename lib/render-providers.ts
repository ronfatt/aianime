import type { RenderTaskKind } from "@/types/studio";

export type RenderProviderId =
  | "gemini-image"
  | "midjourney-image"
  | "runway-video"
  | "kling-video"
  | "pika-video";

export interface RenderProviderDefinition {
  id: RenderProviderId;
  kind: RenderTaskKind;
  label: string;
  vendor: string;
  output: "image" | "video";
}

export interface RenderPayloadInput {
  providerId: RenderProviderId;
  episodeNumber: number;
  sceneTitle: string;
  prompt: string;
  promptImage?: string;
  durationSeconds: number;
  camera: string;
  lighting: string;
  aspectRatio: "9:16";
}

export type VideoJobRequest = RenderPayloadInput;

export interface ProviderJobSubmission {
  providerJobId: string;
  status: "submitted";
  acceptedAt: string;
  raw: Record<string, unknown>;
}

export interface ProviderJobSnapshot {
  providerJobId: string;
  status: "submitted" | "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
  raw: Record<string, unknown>;
}

export interface VideoProviderAdapter {
  submitJob(request: VideoJobRequest): Promise<ProviderJobSubmission>;
  getJobStatus(providerJobId: string): Promise<ProviderJobSnapshot>;
  normalizeStatus(raw: Record<string, unknown>): ProviderJobSnapshot;
}

export const RENDER_PROVIDERS: RenderProviderDefinition[] = [
  {
    id: "gemini-image",
    kind: "image",
    label: "Gemini Image",
    vendor: "Google",
    output: "image",
  },
  {
    id: "midjourney-image",
    kind: "image",
    label: "Midjourney",
    vendor: "Midjourney",
    output: "image",
  },
  {
    id: "kling-video",
    kind: "video",
    label: "Kling",
    vendor: "Kuaishou",
    output: "video",
  },
  {
    id: "runway-video",
    kind: "video",
    label: "Runway",
    vendor: "Runway",
    output: "video",
  },
  {
    id: "pika-video",
    kind: "video",
    label: "Pika",
    vendor: "Pika",
    output: "video",
  },
];

export const DEFAULT_IMAGE_PROVIDER: RenderProviderId = "gemini-image";
export const DEFAULT_VIDEO_PROVIDER: RenderProviderId = "kling-video";

export function getProvidersByKind(kind: RenderTaskKind): RenderProviderDefinition[] {
  return RENDER_PROVIDERS.filter((provider) => provider.kind === kind);
}

export function getProviderDefinition(providerId: RenderProviderId): RenderProviderDefinition {
  return (
    RENDER_PROVIDERS.find((provider) => provider.id === providerId) || {
      id: providerId,
      kind: providerId.includes("image") ? "image" : "video",
      label: providerId,
      vendor: "Custom",
      output: providerId.includes("image") ? "image" : "video",
    }
  );
}

export function buildRenderProviderPayload(input: RenderPayloadInput): string {
  const provider = getProviderDefinition(input.providerId);

  return JSON.stringify(
    {
      providerId: provider.id,
      providerLabel: provider.label,
      vendor: provider.vendor,
      output: provider.output,
      episode: input.episodeNumber,
      sceneTitle: input.sceneTitle,
      prompt: input.prompt,
      promptImage: input.promptImage,
      durationSeconds: input.durationSeconds,
      camera: input.camera,
      lighting: input.lighting,
      aspectRatio: input.aspectRatio,
    },
    null,
    2
  );
}

const mockVideoJobs = new Map<
  string,
  {
    providerId: RenderProviderId;
    submittedAt: number;
    request: VideoJobRequest;
  }
>();

function buildMockVideoProviderAdapter(providerId: RenderProviderId): VideoProviderAdapter {
  return {
    async submitJob(request) {
      const providerJobId = `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const acceptedAt = new Date().toISOString();

      mockVideoJobs.set(providerJobId, {
        providerId,
        submittedAt: Date.now(),
        request,
      });

      return {
        providerJobId,
        status: "submitted",
        acceptedAt,
        raw: {
          providerId,
          acceptedAt,
        },
      };
    },

    async getJobStatus(providerJobId) {
      const record = mockVideoJobs.get(providerJobId);
      if (!record) {
        return {
          providerJobId,
          status: "failed",
          error: "Provider job not found.",
          raw: { providerJobId, error: "Provider job not found." },
        };
      }

      const elapsed = Date.now() - record.submittedAt;
      if (!record.request.prompt.trim()) {
        return {
          providerJobId,
          status: "failed",
          error: "Missing video prompt.",
          raw: { providerJobId, reason: "missing_prompt" },
        };
      }

      if (elapsed < 450) {
        return {
          providerJobId,
          status: "submitted",
          raw: { providerJobId, stage: "queued_at_provider" },
        };
      }

      if (elapsed < 1100) {
        return {
          providerJobId,
          status: "processing",
          raw: { providerJobId, stage: "rendering" },
        };
      }

      return {
        providerJobId,
        status: "completed",
        outputUrl: `mock://${record.providerId}/${providerJobId}`,
        raw: { providerJobId, stage: "completed" },
      };
    },

    normalizeStatus(raw) {
      return {
        providerJobId: String(raw.providerJobId || ""),
        status: (raw.status as ProviderJobSnapshot["status"]) || "processing",
        outputUrl: typeof raw.outputUrl === "string" ? raw.outputUrl : undefined,
        error: typeof raw.error === "string" ? raw.error : undefined,
        raw,
      };
    },
  };
}

export function getVideoProviderAdapter(providerId: RenderProviderId): VideoProviderAdapter {
  switch (providerId) {
    case "runway-video":
      return {
        async submitJob(request) {
          const response = await fetch("/api/video-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "submit",
              providerId,
              request,
            }),
          });

          const payload = (await response.json().catch(() => null)) as
            | ProviderJobSubmission
            | { error?: string }
            | null;

          if (
            !response.ok ||
            !payload ||
            !("providerJobId" in payload) ||
            typeof payload.providerJobId !== "string"
          ) {
            const message = payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Failed to submit Runway video job.";
            throw new Error(message);
          }

          return payload;
        },

        async getJobStatus(providerJobId) {
          const response = await fetch("/api/video-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "status",
              providerId,
              providerJobId,
            }),
          });

          const payload = (await response.json().catch(() => null)) as
            | ProviderJobSnapshot
            | { error?: string }
            | null;

          if (
            !response.ok ||
            !payload ||
            !("providerJobId" in payload) ||
            typeof payload.providerJobId !== "string"
          ) {
            const message = payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Failed to fetch Runway job status.";
            throw new Error(message);
          }

          return payload;
        },

        normalizeStatus(raw) {
          return {
            providerJobId: String(raw.providerJobId || ""),
            status: (raw.status as ProviderJobSnapshot["status"]) || "processing",
            outputUrl: typeof raw.outputUrl === "string" ? raw.outputUrl : undefined,
            error: typeof raw.error === "string" ? raw.error : undefined,
            raw,
          };
        },
      };
    case "kling-video":
    case "pika-video":
      return buildMockVideoProviderAdapter(providerId);
    default:
      throw new Error(`No video adapter available for provider: ${providerId}`);
  }
}
