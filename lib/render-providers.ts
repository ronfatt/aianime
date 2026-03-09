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
  durationSeconds: number;
  camera: string;
  lighting: string;
  aspectRatio: "9:16";
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
      durationSeconds: input.durationSeconds,
      camera: input.camera,
      lighting: input.lighting,
      aspectRatio: input.aspectRatio,
    },
    null,
    2
  );
}
