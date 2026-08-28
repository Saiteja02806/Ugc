export const DEFAULT_IMAGE_GENERATION_CREDITS = 1;
export const DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND = 4;

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
