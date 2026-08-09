import type { InstagramContentAccount } from "@/lib/analytics/instagram-content-insights";
import type { TikTokAnalyticsAccount } from "@/lib/analytics/tiktok";
import {
  TRENDING_HOOK_CAMPAIGN_PURPOSES,
  TRENDING_HOOK_PATTERN_IDS,
  type TrendingHookPerformanceSignals,
} from "./trending-hook-copy-contract.ts";

export type HookPerformanceObservationInput = {
  averageWatchTimeSeconds: number | null;
  clickCount: number | null;
  commentCount: number | null;
  completionRate: number | null;
  conversionCount: number | null;
  interactionCount: number | null;
  likeCount: number | null;
  observedAt: string;
  platform: "instagram" | "tiktok";
  platformPostId: string;
  reachCount: number | null;
  saveCount: number | null;
  shareCount: number | null;
  socialConnectionId: string;
  attributedSalesAmount: number | null;
  attributedSalesCurrency: string | null;
  viewCount: number | null;
  watchTimeSeconds: number | null;
};

/**
 * This is a server-returned aggregate, never text shown to a customer. Its
 * values only come from published posts that were successfully attributed to a
 * selected Hook. A nullable metric means the connected publisher did not give
 * us that data; it is not treated as zero.
 */
export type HookPerformancePatternAggregate = {
  attributedSalesAmount: number | null;
  attributedSalesCurrency: string | null;
  averageWatchTimeSeconds: number | null;
  campaignPurpose: string | null;
  completionRate: number | null;
  conversionCount: number | null;
  observedPostCount: number;
  patternId: string | null;
  saveCount: number | null;
  shareCount: number | null;
  viewCount: number | null;
};

type RankedPattern = {
  campaignPurpose: (typeof TRENDING_HOOK_CAMPAIGN_PURPOSES)[number] | null;
  patternId: (typeof TRENDING_HOOK_PATTERN_IDS)[number];
  score: number;
};

export function getInstagramHookPerformanceObservations(
  accounts: InstagramContentAccount[],
): HookPerformanceObservationInput[] {
  return accounts.flatMap((account) => {
    if (account.status !== "ready") {
      return [];
    }

    const observedAt = normalizeObservedAt(account.lastSyncedAt);

    return account.items.map((item) => ({
      averageWatchTimeSeconds: null,
      clickCount: null,
      commentCount: normalizeCount(item.metrics.comments),
      completionRate: null,
      conversionCount: null,
      interactionCount: normalizeCount(item.metrics.interactions),
      likeCount: normalizeCount(item.metrics.likes),
      observedAt,
      platform: "instagram" as const,
      platformPostId: item.id,
      reachCount: normalizeCount(item.metrics.reach),
      saveCount: normalizeCount(item.metrics.saves),
      shareCount: normalizeCount(item.metrics.shares),
      socialConnectionId: account.connectionId,
      attributedSalesAmount: null,
      attributedSalesCurrency: null,
      viewCount: normalizeCount(item.metrics.views),
      watchTimeSeconds: null,
    }));
  });
}

export function getTikTokHookPerformanceObservations(
  accounts: TikTokAnalyticsAccount[],
): HookPerformanceObservationInput[] {
  return accounts.flatMap((account) => {
    if (account.status !== "ready") {
      return [];
    }

    const observedAt = normalizeObservedAt(account.lastSyncedAt);

    return account.videos.map((video) => ({
      averageWatchTimeSeconds: null,
      clickCount: null,
      commentCount: normalizeCount(video.commentCount),
      completionRate: null,
      conversionCount: null,
      interactionCount: null,
      likeCount: normalizeCount(video.likeCount),
      observedAt,
      platform: "tiktok" as const,
      platformPostId: video.id,
      reachCount: null,
      saveCount: null,
      shareCount: normalizeCount(video.shareCount),
      socialConnectionId: account.connectionId,
      attributedSalesAmount: null,
      attributedSalesCurrency: null,
      viewCount: normalizeCount(video.viewCount),
      watchTimeSeconds: null,
    }));
  });
}

/**
 * Turn genuine publisher results into a small, bounded pattern preference.
 *
 * We wait for at least three attributed posts per pattern/purpose and compare
 * only metrics the publishers actually supplied. The result carries ids only;
 * raw performance numbers are never inserted into a hook prompt or displayed
 * as claims. If evidence is too thin or identical, no preference is returned.
 */
export function deriveHookPerformanceSignals(
  rows: readonly HookPerformancePatternAggregate[],
): TrendingHookPerformanceSignals {
  const candidates = rows
    .map(normalizePatternAggregate)
    .filter(
      (row): row is NormalizedPatternAggregate =>
        row !== null && row.observedPostCount >= 3 && hasComparableEvidence(row),
    );

  if (candidates.length < 2) {
    return {};
  }

  const scores = new Map<string, number>();
  const scoreCounts = new Map<string, number>();

  for (const metric of getComparableMetrics(candidates)) {
    const values = candidates
      .map((candidate) => ({ candidate, value: metric.value(candidate) }))
      .filter(
        (
          entry,
        ): entry is { candidate: NormalizedPatternAggregate; value: number } =>
          entry.value !== null && Number.isFinite(entry.value),
      );

    if (values.length < 2) {
      continue;
    }

    const minimum = Math.min(...values.map((entry) => entry.value));
    const maximum = Math.max(...values.map((entry) => entry.value));

    if (maximum <= minimum) {
      continue;
    }

    for (const { candidate, value } of values) {
      const key = getAggregateKey(candidate);
      const normalized = (value - minimum) / (maximum - minimum);
      scores.set(key, (scores.get(key) ?? 0) + normalized);
      scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
    }
  }

  const ranked = candidates
    .map((candidate): RankedPattern | null => {
      const key = getAggregateKey(candidate);
      const scoreCount = scoreCounts.get(key) ?? 0;

      if (scoreCount === 0) {
        return null;
      }

      return {
        campaignPurpose: candidate.campaignPurpose,
        patternId: candidate.patternId,
        score: (scores.get(key) ?? 0) / scoreCount,
      };
    })
    .filter((value): value is RankedPattern => value !== null)
    .filter((value) => value.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.patternId.localeCompare(right.patternId) ||
        (left.campaignPurpose ?? "").localeCompare(right.campaignPurpose ?? ""),
    );

  const preferredPatternIds = uniqueBounded(
    ranked.map((row) => row.patternId),
  );
  const preferredPurposes = uniqueBounded(
    ranked.flatMap((row) =>
      row.campaignPurpose ? [row.campaignPurpose] : [],
    ),
  );

  return {
    ...(preferredPatternIds.length > 0 ? { preferredPatternIds } : {}),
    ...(preferredPurposes.length > 0 ? { preferredPurposes } : {}),
  };
}

type NormalizedPatternAggregate = {
  attributedSalesAmount: number | null;
  attributedSalesCurrency: string | null;
  averageWatchTimeSeconds: number | null;
  campaignPurpose: (typeof TRENDING_HOOK_CAMPAIGN_PURPOSES)[number] | null;
  completionRate: number | null;
  conversionCount: number | null;
  observedPostCount: number;
  patternId: (typeof TRENDING_HOOK_PATTERN_IDS)[number];
  saveCount: number | null;
  shareCount: number | null;
  viewCount: number | null;
};

function normalizePatternAggregate(
  row: HookPerformancePatternAggregate,
): NormalizedPatternAggregate | null {
  if (!isHookPatternId(row.patternId)) {
    return null;
  }

  const observedPostCount = normalizeWholeNumber(row.observedPostCount);

  if (observedPostCount === null) {
    return null;
  }

  return {
    attributedSalesAmount: normalizeNonNegativeNumber(row.attributedSalesAmount),
    attributedSalesCurrency: normalizeCurrency(row.attributedSalesCurrency),
    averageWatchTimeSeconds: normalizeNonNegativeNumber(
      row.averageWatchTimeSeconds,
    ),
    campaignPurpose: isCampaignPurpose(row.campaignPurpose)
      ? row.campaignPurpose
      : null,
    completionRate: normalizeRate(row.completionRate),
    conversionCount: normalizeWholeNumber(row.conversionCount),
    observedPostCount,
    patternId: row.patternId,
    saveCount: normalizeWholeNumber(row.saveCount),
    shareCount: normalizeWholeNumber(row.shareCount),
    viewCount: normalizeWholeNumber(row.viewCount),
  };
}

function getComparableMetrics(
  candidates: readonly NormalizedPatternAggregate[],
) {
  const salesCurrencies = new Set(
    candidates
      .filter((candidate) => candidate.attributedSalesAmount !== null)
      .map((candidate) => candidate.attributedSalesCurrency)
      .filter((currency): currency is string => currency !== null),
  );
  const salesCanBeCompared = salesCurrencies.size === 1;

  return [
    {
      value: (candidate: NormalizedPatternAggregate) =>
        getRate(candidate.shareCount, candidate.viewCount),
    },
    {
      value: (candidate: NormalizedPatternAggregate) =>
        getRate(candidate.saveCount, candidate.viewCount),
    },
    {
      value: (candidate: NormalizedPatternAggregate) => candidate.completionRate,
    },
    {
      value: (candidate: NormalizedPatternAggregate) =>
        getRate(candidate.conversionCount, candidate.viewCount),
    },
    // Watch time is only a light ranking signal after it arrives from the
    // publisher. It remains absent rather than guessed for current providers.
    {
      value: (candidate: NormalizedPatternAggregate) =>
        candidate.averageWatchTimeSeconds,
    },
    {
      value: (candidate: NormalizedPatternAggregate) =>
        salesCanBeCompared
          ? getRate(candidate.attributedSalesAmount, candidate.viewCount)
          : null,
    },
  ];
}

function hasComparableEvidence(row: NormalizedPatternAggregate) {
  return [
    getRate(row.shareCount, row.viewCount),
    getRate(row.saveCount, row.viewCount),
    row.completionRate,
    getRate(row.conversionCount, row.viewCount),
    row.averageWatchTimeSeconds,
    row.attributedSalesAmount,
  ].some((value) => value !== null);
}

function getAggregateKey(row: NormalizedPatternAggregate) {
  return `${row.patternId}:${row.campaignPurpose ?? "none"}`;
}

function getRate(
  numerator: number | null,
  denominator: number | null,
) {
  if (
    numerator === null ||
    denominator === null ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function uniqueBounded<T extends string>(values: readonly T[]) {
  return [...new Set(values)].slice(0, 3);
}

function isHookPatternId(
  value: string | null,
): value is (typeof TRENDING_HOOK_PATTERN_IDS)[number] {
  return (
    typeof value === "string" &&
    (TRENDING_HOOK_PATTERN_IDS as readonly string[]).includes(value)
  );
}

function isCampaignPurpose(
  value: string | null,
): value is (typeof TRENDING_HOOK_CAMPAIGN_PURPOSES)[number] {
  return (
    typeof value === "string" &&
    (TRENDING_HOOK_CAMPAIGN_PURPOSES as readonly string[]).includes(value)
  );
}

function normalizeWholeNumber(value: number | null) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function normalizeNonNegativeNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeRate(value: number | null) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function normalizeCurrency(value: string | null) {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value)
    ? value
    : null;
}

function normalizeCount(value: number | null) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function normalizeObservedAt(value: string | null) {
  if (value) {
    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date().toISOString();
}
