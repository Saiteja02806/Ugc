export type GeneratedVideoHistoryMetadata = {
  model?: "google_omni" | "seedance_2_5";
  prompt?: string;
  resolution?: "480p" | "720p" | "1080p";
};

export function getGeneratedVideoHistoryMetadata(
  value: unknown,
): GeneratedVideoHistoryMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const model = input.model;
  const prompt = input.hookIdea;
  const resolution = input.resolution;

  return {
    ...(model === "google_omni" || model === "seedance_2_5" ? { model } : {}),
    ...(typeof prompt === "string" && prompt.trim()
      ? { prompt: prompt.trim() }
      : {}),
    ...(resolution === "480p" || resolution === "720p" || resolution === "1080p"
      ? { resolution }
      : {}),
  };
}
