// Temporary product hold. App and worker copies must stay in sync.
// One verified pilot owner is enabled; all other owners retain the product hold.
export const CAROUSEL_GENERATION_PILOT_USER_ID = "oPQhLloYHKQFCysJ4cznV2dv8v02";
export function isAutomaticCarouselGenerationPaused(
  value = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED,
  userId?: string | null,
) {
  return userId !== CAROUSEL_GENERATION_PILOT_USER_ID && value?.trim().toLowerCase() !== "false";
}

export function assertAutomaticCarouselGenerationEnabled(userId?: string | null) {
  if (isAutomaticCarouselGenerationPaused(undefined, userId)) {
    throw new Error("Automatic Carousel generation is temporarily on hold.");
  }
}
