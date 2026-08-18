import {
  WALL_TEXT_FORMAT_IDS,
  type WallTextFormatId,
} from "./wall-text-types.ts";

export const WALL_TEXT_PERFORMANCE_VERSION =
  "wall-text-views-v1-72h-median" as const;
export const WALL_TEXT_PERFORMANCE_MINIMUM_RESULTS = 4;
export const WALL_TEXT_PERFORMANCE_MINIMUM_AGE_HOURS = 72;
export const WALL_TEXT_PERFORMANCE_TARGET_WINDOW_END_HOURS = 96;

export type WallTextFormatPerformanceAggregate = {
  formatId: string;
  lastGeneratedAt: string | null;
  publishedResultCount: number;
  recentViewCounts: number[];
  timesGenerated: number;
};

export type WallTextFormatPerformanceSignal = {
  formatId: WallTextFormatId;
  medianViews: number;
  publishedResultCount: number;
  qualified: boolean;
  selectionWeight: number;
  timesGenerated: number;
};

export type WallTextPerformanceSignals = {
  formats: WallTextFormatPerformanceSignal[];
  version: typeof WALL_TEXT_PERFORMANCE_VERSION;
};

export function isWallTextPerformanceObservationReady(params: {
  observedAt: string;
  publishedAt: string;
}) {
  const publishedAt = Date.parse(params.publishedAt);
  const observedAt = Date.parse(params.observedAt);
  if (!Number.isFinite(publishedAt) || !Number.isFinite(observedAt)) {
    return false;
  }
  const ageMs = observedAt - publishedAt;
  return (
    ageMs >= WALL_TEXT_PERFORMANCE_MINIMUM_AGE_HOURS * 60 * 60 * 1000 &&
    ageMs <=
      WALL_TEXT_PERFORMANCE_TARGET_WINDOW_END_HOURS * 60 * 60 * 1000
  );
}

export function getWallTextObservationAgeHours(params: {
  observedAt: string;
  publishedAt: string;
}) {
  const publishedAt = Date.parse(params.publishedAt);
  const observedAt = Date.parse(params.observedAt);
  if (!Number.isFinite(publishedAt) || !Number.isFinite(observedAt)) {
    return null;
  }
  return Math.max(0, (observedAt - publishedAt) / (60 * 60 * 1000));
}

export function deriveWallTextPerformanceSignals(
  rows: readonly WallTextFormatPerformanceAggregate[],
): WallTextPerformanceSignals {
  const normalized = rows.flatMap((row) => {
    if (!isWallTextFormatId(row.formatId)) return [];
    const viewCounts = row.recentViewCounts
      .filter(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
      .slice(0, 12);
    const medianViews = median(viewCounts) ?? 0;
    return [{
      formatId: row.formatId,
      medianViews,
      publishedResultCount: normalizeCount(row.publishedResultCount),
      recentViewCounts: viewCounts,
      timesGenerated: normalizeCount(row.timesGenerated),
    }];
  });
  const qualifiedMedians = normalized
    .filter(
      (row) =>
        row.recentViewCounts.length >= WALL_TEXT_PERFORMANCE_MINIMUM_RESULTS,
    )
    .map((row) => row.medianViews);
  const comparisonMedian = median(qualifiedMedians);

  return {
    formats: normalized.map((row) => {
      const qualified =
        row.recentViewCounts.length >= WALL_TEXT_PERFORMANCE_MINIMUM_RESULTS;
      const relativeStrength =
        qualified && comparisonMedian !== null && comparisonMedian > 0
          ? row.medianViews / comparisonMedian
          : 1;
      const consistency = getConsistency(row.recentViewCounts);
      const adjustment = qualified
        ? clamp((relativeStrength - 1) * 0.28, -0.2, 0.35) +
          (consistency - 0.5) * 0.08
        : 0;

      return {
        formatId: row.formatId,
        medianViews: row.medianViews,
        publishedResultCount: row.publishedResultCount,
        qualified,
        selectionWeight: qualified
          ? round(clamp(1 + adjustment, 0.8, 1.4), 4)
          : 1,
        timesGenerated: row.timesGenerated,
      };
    }),
    version: WALL_TEXT_PERFORMANCE_VERSION,
  };
}

function getConsistency(values: readonly number[]) {
  const typical = median(values);
  if (typical === null || typical <= 0 || values.length < 2) return 0.5;
  const deviation = median(values.map((value) => Math.abs(value - typical))) ?? 0;
  return clamp(1 - deviation / typical, 0, 1);
}

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function normalizeCount(value: number) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isWallTextFormatId(value: string): value is WallTextFormatId {
  return (WALL_TEXT_FORMAT_IDS as readonly string[]).includes(value);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
