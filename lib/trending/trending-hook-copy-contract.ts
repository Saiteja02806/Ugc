export const TRENDING_HOOK_PROMPT_VERSION =
  "trending-hook-copy-v5";
export const TRENDING_HOOK_SELECTION_VERSION =
  "purpose-industry-diversity-v5";
export const TRENDING_HOOK_COPY_JOB_TYPE =
  "generate_trending_hook_copy" as const;

export const TRENDING_HOOK_CAMPAIGN_PURPOSES = [
  "product_discovery",
  "education",
  "conversion",
  "retargeting",
  "app_install",
] as const;

export const TRENDING_HOOK_PATTERN_IDS = [
  "mystery_discovery",
  "direct_capability",
  "problem_observation",
  "skeptical_challenge",
  "problem_reversal",
  "workflow_exposed",
  "outcome_without_friction",
  "professional_transformation",
] as const;

export type TrendingHookPerformanceSignals = {
  preferredPatternIds?: Array<(typeof TRENDING_HOOK_PATTERN_IDS)[number]>;
  preferredPurposes?: Array<(typeof TRENDING_HOOK_CAMPAIGN_PURPOSES)[number]>;
};

/**
 * A generation must be distinct when its safe, id-only learned preference
 * changes. Raw publisher metrics deliberately never become part of a job
 * payload or idempotency key.
 */
export function getTrendingHookPerformanceSignalKey(
  signals: TrendingHookPerformanceSignals | undefined,
) {
  const patterns = [
    ...new Set(
      (signals?.preferredPatternIds ?? []).filter((value) =>
        (TRENDING_HOOK_PATTERN_IDS as readonly string[]).includes(value),
      ),
    ),
  ].slice(0, 3);
  const purposes = [
    ...new Set(
      (signals?.preferredPurposes ?? []).filter((value) =>
        (TRENDING_HOOK_CAMPAIGN_PURPOSES as readonly string[]).includes(value),
      ),
    ),
  ].slice(0, 3);

  return `patterns-${patterns.join(".") || "none"}:purposes-${purposes.join(".") || "none"}`;
}

export type TrendingHookPreparationStatus =
  | "processing"
  | "queued"
  | "ready";
