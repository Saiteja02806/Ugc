import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWallTextPerformanceSignals,
  isWallTextPerformanceObservationReady,
} from "./wall-format-performance-logic.ts";

test("Wall performance accepts only the fixed 72-96 hour views window", () => {
  const publishedAt = "2026-08-01T00:00:00.000Z";
  assert.equal(isWallTextPerformanceObservationReady({
    observedAt: "2026-08-03T23:59:59.000Z",
    publishedAt,
  }), false);
  assert.equal(isWallTextPerformanceObservationReady({
    observedAt: "2026-08-04T00:00:00.000Z",
    publishedAt,
  }), true);
  assert.equal(isWallTextPerformanceObservationReady({
    observedAt: "2026-08-05T00:00:00.000Z",
    publishedAt,
  }), true);
  assert.equal(isWallTextPerformanceObservationReady({
    observedAt: "2026-08-05T00:00:01.000Z",
    publishedAt,
  }), false);
});

test("four results qualify and median views prevent one viral outlier dominating", () => {
  const signals = deriveWallTextPerformanceSignals([
    {
      formatId: "hidden_cause",
      lastGeneratedAt: null,
      publishedResultCount: 4,
      recentViewCounts: [900, 1000, 1100, 100000],
      timesGenerated: 4,
    },
    {
      formatId: "future_snapshot",
      lastGeneratedAt: null,
      publishedResultCount: 4,
      recentViewCounts: [1200, 1250, 1300, 1350],
      timesGenerated: 4,
    },
    {
      formatId: "warning_alert",
      lastGeneratedAt: null,
      publishedResultCount: 3,
      recentViewCounts: [5000, 6000, 7000],
      timesGenerated: 3,
    },
  ]);
  const hidden = signals.formats.find((row) => row.formatId === "hidden_cause")!;
  const future = signals.formats.find((row) => row.formatId === "future_snapshot")!;
  const warning = signals.formats.find((row) => row.formatId === "warning_alert")!;
  assert.equal(hidden.medianViews, 1050);
  assert.equal(future.medianViews, 1275);
  assert.equal(hidden.qualified, true);
  assert.equal(warning.qualified, false);
  assert.ok(future.selectionWeight > hidden.selectionWeight);
});
