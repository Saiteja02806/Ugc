export const TRENDING_HOOK_PROMPT_VERSION =
  "trending-hook-copy-v4";
export const TRENDING_HOOK_SELECTION_VERSION =
  "pattern-diversity-v4";
export const TRENDING_HOOK_COPY_JOB_TYPE =
  "generate_trending_hook_copy" as const;

export type TrendingHookPreparationStatus =
  | "processing"
  | "queued"
  | "ready";
