import { readSlideshowGenerationSlot } from "../../worker/src/lib/slideshow-generation-batch.ts";

/** Reconstruct legacy image history from its owner-checked generation job. */
export function getGeneratedImageHistoryMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    ...(typeof input.prompt === "string" && input.prompt.trim() ? { prompt: input.prompt } : {}),
    ...(typeof input.model === "string" ? { model: input.model } : {}),
    ...(readSlideshowGenerationSlot(input.slideshowGeneration) ? { slideshowGeneration: readSlideshowGenerationSlot(input.slideshowGeneration)! } : {}),
  };
}
