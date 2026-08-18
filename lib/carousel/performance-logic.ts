import type { InstagramContentAccount } from "../analytics/instagram-content-insights.ts";
import {
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatId,
  type CarouselHookFamilyId,
} from "./content-grammar.ts";

export const CAROUSEL_PERFORMANCE_EVALUATION_DAYS = 7;
export const CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS = 4;
export const CAROUSEL_FORMAT_MULTIPLIER_MIN = 0.85;
export const CAROUSEL_FORMAT_MULTIPLIER_MAX = 1.25;
export const CAROUSEL_HOOK_MULTIPLIER_MIN = 0.9;
export const CAROUSEL_HOOK_MULTIPLIER_MAX = 1.2;

export type CarouselPerformanceObservationInput = {
  observedAt: string;
  platform: "instagram";
  platformPostId: string;
  publishedAt: string;
  socialConnectionId: string;
  viewCount: number | null;
};

export type CarouselPerformanceAggregate = {
  averageViewCount: number | null;
  baselineMedianViewCount: number | null;
  contentFormatId: string | null;
  evaluatedPostCount: number;
  hookFamilyId: string | null;
  medianViewCount: number | null;
  scope: "format" | "format_hook";
  viewStandardDeviation: number | null;
};

export type CarouselPerformanceSignals = {
  formatMultipliers?: Partial<Record<CarouselContentFormatId, number>>;
  hookFamilyMultipliers?: Partial<
    Record<
      CarouselContentFormatId,
      Partial<Record<CarouselHookFamilyId, number>>
    >
  >;
};

export function getInstagramCarouselPerformanceObservations(
  accounts: InstagramContentAccount[],
): CarouselPerformanceObservationInput[] {
  return accounts.flatMap((account) => {
    if (account.status !== "ready") return [];

    const observedAt = normalizeIsoDate(account.lastSyncedAt);
    if (!observedAt) return [];

    return account.items.flatMap((item) => {
      if (item.contentType !== "carousel") return [];

      const publishedAt = normalizeIsoDate(item.publishedAt);
      if (!publishedAt) return [];

      return [
        {
          observedAt,
          platform: "instagram" as const,
          platformPostId: item.id,
          publishedAt,
          socialConnectionId: account.connectionId,
          viewCount: normalizeCount(item.metrics.views),
        },
      ];
    });
  });
}

/**
 * Convert evaluated, business-scoped publisher results into gentle selection
 * multipliers. Median views limit the effect of one viral spike, variation
 * penalizes unstable results, and confidence grows slowly after four samples.
 */
export function deriveCarouselPerformanceSignals(
  rows: readonly CarouselPerformanceAggregate[],
): CarouselPerformanceSignals {
  const formatRows = rows
    .map(normalizeAggregate)
    .filter(
      (row): row is NormalizedAggregate =>
        row !== null &&
        row.scope === "format" &&
        row.hookFamilyId === null &&
        row.evaluatedPostCount >= CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS,
    );

  // A single tested format has no trustworthy peer comparison. Keep rotating
  // until at least two formats have enough evaluated evidence.
  if (formatRows.length < 2) return {};

  const formatMultipliers: Partial<Record<CarouselContentFormatId, number>> = {};

  for (const row of formatRows) {
    const multiplier = deriveReliabilityWeightedMultiplier({
      averageViewCount: row.averageViewCount,
      baselineMedianViewCount: row.baselineMedianViewCount,
      evaluatedPostCount: row.evaluatedPostCount,
      maximum: CAROUSEL_FORMAT_MULTIPLIER_MAX,
      medianViewCount: row.medianViewCount,
      minimum: CAROUSEL_FORMAT_MULTIPLIER_MIN,
      viewStandardDeviation: row.viewStandardDeviation,
    });

    if (multiplier !== null) {
      formatMultipliers[row.contentFormatId] = multiplier;
    }
  }

  const normalizedFormatIds = new Set(Object.keys(formatMultipliers));
  if (normalizedFormatIds.size < 2) return {};

  const hookRowsByFormat = new Map<
    CarouselContentFormatId,
    NormalizedAggregate[]
  >();

  for (const row of rows.map(normalizeAggregate)) {
    if (
      !row ||
      row.scope !== "format_hook" ||
      row.hookFamilyId === null ||
      row.evaluatedPostCount < CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS
    ) {
      continue;
    }

    const existing = hookRowsByFormat.get(row.contentFormatId) ?? [];
    existing.push(row);
    hookRowsByFormat.set(row.contentFormatId, existing);
  }

  const hookFamilyMultipliers: NonNullable<
    CarouselPerformanceSignals["hookFamilyMultipliers"]
  > = {};

  for (const [contentFormatId, hookRows] of hookRowsByFormat) {
    // Hook performance must be compared inside the same format. A single hook
    // family is not enough evidence to change its probability.
    if (hookRows.length < 2) continue;

    const formatBaseline = formatRows.find(
      (row) => row.contentFormatId === contentFormatId,
    )?.medianViewCount;

    if (!formatBaseline || formatBaseline <= 0) continue;

    const multipliers: Partial<Record<CarouselHookFamilyId, number>> = {};

    for (const row of hookRows) {
      const multiplier = deriveReliabilityWeightedMultiplier({
        averageViewCount: row.averageViewCount,
        baselineMedianViewCount: formatBaseline,
        evaluatedPostCount: row.evaluatedPostCount,
        maximum: CAROUSEL_HOOK_MULTIPLIER_MAX,
        medianViewCount: row.medianViewCount,
        minimum: CAROUSEL_HOOK_MULTIPLIER_MIN,
        viewStandardDeviation: row.viewStandardDeviation,
      });

      if (multiplier !== null && row.hookFamilyId) {
        multipliers[row.hookFamilyId] = multiplier;
      }
    }

    if (Object.keys(multipliers).length >= 2) {
      hookFamilyMultipliers[contentFormatId] = multipliers;
    }
  }

  return {
    formatMultipliers,
    ...(Object.keys(hookFamilyMultipliers).length > 0
      ? { hookFamilyMultipliers }
      : {}),
  };
}

type NormalizedAggregate = {
  averageViewCount: number;
  baselineMedianViewCount: number;
  contentFormatId: CarouselContentFormatId;
  evaluatedPostCount: number;
  hookFamilyId: CarouselHookFamilyId | null;
  medianViewCount: number;
  scope: CarouselPerformanceAggregate["scope"];
  viewStandardDeviation: number;
};

function normalizeAggregate(
  row: CarouselPerformanceAggregate,
): NormalizedAggregate | null {
  if (
    !isCarouselContentFormatId(row.contentFormatId) ||
    (row.scope !== "format" && row.scope !== "format_hook") ||
    (row.scope === "format_hook" && !isCarouselHookFamilyId(row.hookFamilyId))
  ) {
    return null;
  }

  const evaluatedPostCount = normalizeCount(row.evaluatedPostCount);
  const averageViewCount = normalizeNonNegative(row.averageViewCount);
  const baselineMedianViewCount = normalizeNonNegative(
    row.baselineMedianViewCount,
  );
  const medianViewCount = normalizeNonNegative(row.medianViewCount);
  const viewStandardDeviation =
    normalizeNonNegative(row.viewStandardDeviation) ?? 0;

  if (
    evaluatedPostCount === null ||
    averageViewCount === null ||
    baselineMedianViewCount === null ||
    baselineMedianViewCount <= 0 ||
    medianViewCount === null
  ) {
    return null;
  }

  return {
    averageViewCount,
    baselineMedianViewCount,
    contentFormatId: row.contentFormatId,
    evaluatedPostCount,
    hookFamilyId:
      row.scope === "format_hook" && isCarouselHookFamilyId(row.hookFamilyId)
        ? row.hookFamilyId
        : null,
    medianViewCount,
    scope: row.scope,
    viewStandardDeviation,
  };
}

function deriveReliabilityWeightedMultiplier(params: {
  averageViewCount: number;
  baselineMedianViewCount: number;
  evaluatedPostCount: number;
  maximum: number;
  medianViewCount: number;
  minimum: number;
  viewStandardDeviation: number;
}) {
  if (
    params.evaluatedPostCount < CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS ||
    params.baselineMedianViewCount <= 0
  ) {
    return null;
  }

  const medianRatio = params.medianViewCount / params.baselineMedianViewCount;
  const variation =
    params.averageViewCount > 0
      ? Math.min(params.viewStandardDeviation / params.averageViewCount, 1)
      : 1;
  const consistencyAdjustedRatio = medianRatio * (1 - variation * 0.2);
  const confidence = Math.min(
    (params.evaluatedPostCount -
      CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS +
      1) /
      9,
    1,
  );
  const learned = 1 + (consistencyAdjustedRatio - 1) * confidence;

  return roundMultiplier(clamp(learned, params.minimum, params.maximum));
}

function normalizeCount(value: number | null) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function normalizeNonNegative(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeIsoDate(value: string | null) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMultiplier(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
