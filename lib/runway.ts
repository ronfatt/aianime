const RUNWAY_API_BASE = "https://api.dev.runwayml.com";

export interface RunwayImageToVideoRequest {
  model: string;
  promptText: string;
  promptImage: string;
  duration: number;
  ratio: "720:1280" | "1080:1920";
}

export interface RunwayTaskResponse {
  id: string;
  status?: string;
  output?: Array<string | { url?: string }>;
  failure?: string | { message?: string };
  error?: string | { message?: string };
}

function getRunwayHeaders() {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RUNWAY_API_KEY environment variable.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": process.env.RUNWAY_API_VERSION || "2024-11-06",
  };
}

export function hasRunwayKey(): boolean {
  return Boolean(process.env.RUNWAY_API_KEY);
}

export function getRunwayModel(): string {
  return process.env.RUNWAY_MODEL || "gen4_turbo";
}

export async function submitRunwayImageToVideo(input: RunwayImageToVideoRequest): Promise<RunwayTaskResponse> {
  const response = await fetch(`${RUNWAY_API_BASE}/v1/image_to_video`, {
    method: "POST",
    headers: getRunwayHeaders(),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as RunwayTaskResponse | { error?: string } | null;
  if (!response.ok || !payload || !("id" in payload)) {
    const message =
      (payload && "error" in payload && typeof payload.error === "string" && payload.error) ||
      `Runway submit failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export async function getRunwayTask(taskId: string): Promise<RunwayTaskResponse> {
  const response = await fetch(`${RUNWAY_API_BASE}/v1/tasks/${taskId}`, {
    method: "GET",
    headers: getRunwayHeaders(),
  });

  const payload = (await response.json().catch(() => null)) as RunwayTaskResponse | { error?: string } | null;
  if (!response.ok || !payload || !("id" in payload)) {
    const message =
      (payload && "error" in payload && typeof payload.error === "string" && payload.error) ||
      `Runway status failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export function extractRunwayOutputUrl(task: RunwayTaskResponse): string | undefined {
  const candidate = task.output?.[0];
  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate === "object" && typeof candidate.url === "string") {
    return candidate.url;
  }
  return undefined;
}

export function normalizeRunwayStatus(task: RunwayTaskResponse): "submitted" | "processing" | "completed" | "failed" {
  const status = String(task.status || "").toUpperCase();

  if (status === "SUCCEEDED" || status === "COMPLETED") return "completed";
  if (status === "FAILED" || status === "CANCELLED" || status === "CANCELED") return "failed";
  if (status === "RUNNING" || status === "PROCESSING" || status === "PENDING") return "processing";
  return "submitted";
}

export function extractRunwayError(task: RunwayTaskResponse): string | undefined {
  if (typeof task.failure === "string") return task.failure;
  if (task.failure && typeof task.failure === "object" && typeof task.failure.message === "string") {
    return task.failure.message;
  }
  if (typeof task.error === "string") return task.error;
  if (task.error && typeof task.error === "object" && typeof task.error.message === "string") {
    return task.error.message;
  }
  return undefined;
}
