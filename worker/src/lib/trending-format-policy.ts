import { isAutomaticCarouselGenerationPaused } from "./carousel-generation-hold.js";

// Keep in sync with lib/trending/format-policy.ts. Separate worker deployment.
export const TRENDING_SLIDESHOW_ONLY_ENABLED = false;

export function isTrendingGenerationJobDisabled(
  jobType: string,
  userId?: string | null,
) {
  return (
    (TRENDING_SLIDESHOW_ONLY_ENABLED ||
      isAutomaticCarouselGenerationPaused(undefined, userId)) &&
    [
      "generate_trending_hook_copy",
      "wall_text_content_plan_generation",
      "wall_text_generation",
      "reaction_generation",
    ].includes(jobType)
  );
}
