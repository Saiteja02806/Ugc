export const TRENDING_HOOK_PROMPT_VERSION =
  "trending-hook-copy-v7";
export const TRENDING_HOOK_SELECTION_VERSION =
  "global-format-rotation-v1";
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

export const HOOK_TEXT_FORMAT_IDS = [
  "GF_001",
  "GF_002",
  "GF_003",
  "GF_004",
  "GF_005",
  "GF_006",
  "GF_007",
  "GF_008",
  "GF_009",
  "GF_010",
  "GF_011",
  "GF_012",
  "GF_013",
  "GF_014",
  "GF_015",
  "GF_016",
  "GF_017",
  "GF_018",
] as const;

export type HookTextFormatId =
  (typeof HOOK_TEXT_FORMAT_IDS)[number];

export type HookTextFormatPerformanceSignal = {
  formatId: HookTextFormatId;
  lastGeneratedAt?: string | null;
  publishedResultCount: number;
  selectionWeight: number;
  temporaryBoost: number;
  timesGenerated: number;
};

export type TrendingHookPerformanceSignals = {
  formatSignals?: HookTextFormatPerformanceSignal[];
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
  const formats = (signals?.formatSignals ?? [])
    .filter((signal) =>
      (HOOK_TEXT_FORMAT_IDS as readonly string[]).includes(signal.formatId),
    )
    .map((signal) => ({
      formatId: signal.formatId,
      publishedResultCount: Math.max(0, Math.trunc(signal.publishedResultCount)),
      selectionWeight: Math.round(signal.selectionWeight * 1000) / 1000,
      temporaryBoost: Math.round(signal.temporaryBoost * 1000) / 1000,
      timesGenerated: Math.max(0, Math.trunc(signal.timesGenerated)),
    }))
    .sort((left, right) => left.formatId.localeCompare(right.formatId));
  const purposes = [
    ...new Set(
      (signals?.preferredPurposes ?? []).filter((value) =>
        (TRENDING_HOOK_CAMPAIGN_PURPOSES as readonly string[]).includes(value),
      ),
    ),
  ].slice(0, 3);

  const formatKey = formats
    .map(
      (signal) =>
        `${signal.formatId}.${signal.timesGenerated}.${signal.publishedResultCount}.${signal.selectionWeight}.${signal.temporaryBoost}`,
    )
    .join("-");

  return `formats-${formatKey || "none"}:purposes-${purposes.join(".") || "none"}`;
}

export type TrendingHookPreparationStatus =
  | "processing"
  | "queued"
  | "ready";
