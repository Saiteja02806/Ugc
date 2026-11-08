export const DEFAULT_IMAGE_GENERATION_CREDITS = 1;
export const DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND = 3;

export const STANDARD_VIDEO_GENERATION_CREDITS_PER_SECOND = 2;

export function getVideoModelCreditsPerSecond(model?: string): number {
  if (model === "kling_3_0") return 1;
  if (model === "kling_4_0") return 2;
  if (model === "flux_3") return 3;
  return model === "wan_3_0" || model === "google_omni"
    ? STANDARD_VIDEO_GENERATION_CREDITS_PER_SECOND
    : DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND;
}

export function calculateVideoGenerationCreditCost(
  durationSeconds: number,
  creditsPerSecond = DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND,
) {
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 1 ||
    !Number.isInteger(creditsPerSecond) ||
    creditsPerSecond < 1
  ) {
    throw new Error(
      "Video duration and credits per second must be positive integers.",
    );
  }

  return durationSeconds * creditsPerSecond;
}
