// Keep in sync with lib/trending/format-policy.ts. Separate worker deployment.
export const TRENDING_SLIDESHOW_ONLY_ENABLED = true;

export function isTrendingGenerationJobDisabled(jobType: string) {
  return TRENDING_SLIDESHOW_ONLY_ENABLED && [
    "generate_trending_hook_copy",
    "wall_text_content_plan_generation",
    "wall_text_generation",
    "reaction_generation",
  ].includes(jobType);
}
