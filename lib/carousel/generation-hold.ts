// Temporary product hold. App and worker copies must stay in sync.
// Set explicitly to false only when automatic Carousel generation is released.
export function isAutomaticCarouselGenerationPaused(
  value = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED,
) {
  return value?.trim().toLowerCase() !== "false";
}

export function assertAutomaticCarouselGenerationEnabled() {
  if (isAutomaticCarouselGenerationPaused()) {
    throw new Error("Automatic Carousel generation is temporarily on hold.");
  }
}
