import type { InstagramContentAccount } from "@/lib/analytics/instagram-content-insights";
import type { TikTokAnalyticsAccount } from "@/lib/analytics/tiktok";
import {
  HOOK_TEXT_FORMAT_IDS,
  type HookTextFormatId,
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
export type HookTextFormatPerformanceAggregate = {
  campaignPurpose: string | null;
  hookTextFormatId: string | null;
  lastGeneratedAt: string | null;
  medianViews: number | null;
  recentViewCounts: number[];
  publishedResultCount: number;
  selectionWeight?: number | null;
  temporaryBoost?: number | null;
  timesGenerated: number;
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
 * Turn genuine Instagram views into bounded, per-user format weights.
 *
 * One unusually strong result earns only a modest temporary validation boost.
 * Repeated results increase the durable weight slowly, using the median so a
 * single spike cannot dominate. Raw views never enter the generation prompt.
 */
export function deriveHookPerformanceSignals(
  rows: readonly HookTextFormatPerformanceAggregate[],
): TrendingHookPerformanceSignals {
  const normalized = rows
    .map(normalizeFormatAggregate)
    .filter(
      (row): row is NormalizedFormatAggregate => row !== null,
    );
  const observedMedians = normalized
    .map((row) => row.medianViews)
    .filter((value): value is number => value !== null);
  const comparisonMedian = median(observedMedians);

  return {
    formatSignals: normalized.map((row) => {
      const resultCount = row.recentViewCounts.length;
      const relativeStrength =
        row.medianViews !== null &&
        comparisonMedian !== null &&
        comparisonMedian > 0
          ? row.medianViews / comparisonMedian
          : 1;
      const isStrong = relativeStrength >= 1.2;
      const temporaryBoost =
        resultCount === 1 && isStrong ? 0.08 : 0;
      const durableEvidence = Math.min(1, Math.max(0, (resultCount - 1) / 5));
      const durableAdjustment =
        resultCount >= 2
          ? clamp((relativeStrength - 1) * 0.16 * durableEvidence, -0.12, 0.22)
          : 0;
      const consistency = getConsistency(row.recentViewCounts);
      const consistencyAdjustment =
        resultCount >= 3 ? (consistency - 0.5) * 0.04 : 0;
      const databaseSelectionWeight = normalizeBoundedNumber(
        row.selectionWeight,
        0.8,
        1.3,
      );
      const databaseTemporaryBoost = normalizeBoundedNumber(
        row.temporaryBoost,
        0,
        0.12,
      );

      return {
        formatId: row.hookTextFormatId,
        lastGeneratedAt: row.lastGeneratedAt,
        publishedResultCount: row.publishedResultCount,
        selectionWeight:
          databaseSelectionWeight ??
          clamp(
            1 + durableAdjustment + consistencyAdjustment,
            0.8,
            1.3,
          ),
        temporaryBoost: databaseTemporaryBoost ?? temporaryBoost,
        timesGenerated: row.timesGenerated,
      };
    }),
  };
}

type NormalizedFormatAggregate = {
  hookTextFormatId: HookTextFormatId;
  lastGeneratedAt: string | null;
  medianViews: number | null;
  publishedResultCount: number;
  recentViewCounts: number[];
  selectionWeight: number | null;
  temporaryBoost: number | null;
  timesGenerated: number;
};

function normalizeFormatAggregate(
  row: HookTextFormatPerformanceAggregate,
): NormalizedFormatAggregate | null {
  if (
    typeof row.hookTextFormatId !== "string" ||
    !(HOOK_TEXT_FORMAT_IDS as readonly string[]).includes(
      row.hookTextFormatId,
    )
  ) {
    return null;
  }

  const timesGenerated = normalizeWholeNumber(row.timesGenerated);
  const publishedResultCount = normalizeWholeNumber(
    row.publishedResultCount,
  );

  if (timesGenerated === null || publishedResultCount === null) {
    return null;
  }

  const recentViewCounts = row.recentViewCounts
    .map((value) => normalizeWholeNumber(value))
    .filter((value): value is number => value !== null)
    .slice(0, 12);

  return {
    hookTextFormatId: row.hookTextFormatId as HookTextFormatId,
    lastGeneratedAt:
      row.lastGeneratedAt && Number.isFinite(Date.parse(row.lastGeneratedAt))
        ? new Date(row.lastGeneratedAt).toISOString()
        : null,
    medianViews:
      normalizeNonNegativeNumber(row.medianViews) ?? median(recentViewCounts),
    publishedResultCount,
    recentViewCounts,
    selectionWeight:
      normalizeBoundedNumber(row.selectionWeight, 0.8, 1.3),
    temporaryBoost:
      normalizeBoundedNumber(row.temporaryBoost, 0, 0.12),
    timesGenerated,
  };
}

function median(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function getConsistency(values: readonly number[]) {
  const typical = median(values);

  if (typical === null || typical <= 0 || values.length < 2) {
    return 0.5;
  }

  const deviations = values.map((value) => Math.abs(value - typical));
  const medianDeviation = median(deviations) ?? 0;
  return clamp(1 - medianDeviation / typical, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
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

function normalizeBoundedNumber(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
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
