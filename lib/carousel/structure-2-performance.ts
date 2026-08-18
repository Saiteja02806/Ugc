import {
  CAROUSEL_FORMAT_MULTIPLIER_MAX,
  CAROUSEL_FORMAT_MULTIPLIER_MIN,
  CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS,
  type CarouselPerformanceAggregate,
} from "./performance-logic.ts";
import {
  isCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
} from "./structure-2-formats.ts";
import type { CarouselStructure2PerformanceSignals } from "./structure-2-selector.ts";

export function deriveCarouselStructure2PerformanceSignals(
  rows: readonly CarouselPerformanceAggregate[],
): CarouselStructure2PerformanceSignals {
  const eligible: Array<{
    averageViewCount: number;
    baselineMedianViewCount: number;
    contentFormatId: CarouselStructure2FormatId;
    evaluatedPostCount: number;
    medianViewCount: number;
    viewStandardDeviation: number;
  }> = [];

  for (const row of rows) {
    if (
      row.scope !== "format" ||
      row.hookFamilyId !== null ||
      !isCarouselStructure2FormatId(row.contentFormatId) ||
      !isCount(row.evaluatedPostCount) ||
      row.evaluatedPostCount < CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS ||
      !isNonNegative(row.averageViewCount) ||
      !isNonNegative(row.baselineMedianViewCount) ||
      row.baselineMedianViewCount <= 0 ||
      !isNonNegative(row.medianViewCount)
    ) {
      continue;
    }

    eligible.push({
      averageViewCount: row.averageViewCount,
      baselineMedianViewCount: row.baselineMedianViewCount,
      contentFormatId: row.contentFormatId,
      evaluatedPostCount: row.evaluatedPostCount,
      medianViewCount: row.medianViewCount,
      viewStandardDeviation: isNonNegative(row.viewStandardDeviation)
        ? row.viewStandardDeviation
        : 0,
    });
  }

  if (eligible.length < 2) return {};

  const formatMultipliers: Partial<
    Record<CarouselStructure2FormatId, number>
  > = {};

  for (const row of eligible) {
    const variation =
      row.averageViewCount > 0
        ? Math.min(row.viewStandardDeviation / row.averageViewCount, 1)
        : 1;
    const ratio = row.medianViewCount / row.baselineMedianViewCount;
    const adjustedRatio = ratio * (1 - variation * 0.2);
    const confidence = Math.min(
      (row.evaluatedPostCount - CAROUSEL_PERFORMANCE_MIN_EVALUATED_POSTS + 1) /
        9,
      1,
    );
    const multiplier = 1 + (adjustedRatio - 1) * confidence;

    formatMultipliers[row.contentFormatId] = round(
      Math.min(
        Math.max(multiplier, CAROUSEL_FORMAT_MULTIPLIER_MIN),
        CAROUSEL_FORMAT_MULTIPLIER_MAX,
      ),
    );
  }

  return Object.keys(formatMultipliers).length >= 2
    ? { formatMultipliers }
    : {};
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
