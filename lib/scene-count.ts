import type { SceneCount } from "@/types/film-pack";

function estimateDurationSeconds(input: string): number {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;

  const latinWords = (normalized.match(/[A-Za-z0-9]+/g) || []).length;
  const cjkChars = (normalized.match(/[\u3400-\u9FFF]/g) || []).length;

  const latinSeconds = latinWords / 2.45;
  const cjkSeconds = cjkChars / 4.2;

  return latinSeconds + cjkSeconds;
}

export function resolveSceneCount(
  sceneCount: SceneCount | "auto",
  opts: { lockedVoiceOver?: string; originalScript: string }
): SceneCount {
  if (sceneCount !== "auto") return sceneCount;

  const source = (opts.lockedVoiceOver?.trim() || opts.originalScript || "").trim();
  const seconds = estimateDurationSeconds(source);

  if (seconds <= 90) return 25;
  if (seconds <= 102) return 28;
  return 30;
}
