import assert from "node:assert/strict";
import test from "node:test";

import { deriveCarouselStructure2PerformanceSignals } from "./structure-2-performance.ts";

test("Structure 2 performance learns only from two qualified Structure 2 formats", () => {
  const signals = deriveCarouselStructure2PerformanceSignals([
    row("wrong_belief", 8, 150, 100),
    row("perfect_plan_breaks", 8, 75, 100),
    row("stopped_behavior", 3, 400, 100),
    row("problem-agitation", 8, 500, 100),
  ]);

  assert.ok((signals.formatMultipliers?.wrong_belief ?? 0) > 1);
  assert.ok(
    (signals.formatMultipliers?.perfect_plan_breaks ?? Number.POSITIVE_INFINITY) <
      1,
  );
  assert.equal(
    "problem-agitation" in (signals.formatMultipliers ?? {}),
    false,
  );
});

test("Structure 2 performance ignores hook aggregates and insufficient peers", () => {
  const hookRow = {
    ...row("wrong_belief", 8, 200, 100),
    hookFamilyId: "confession",
    scope: "format_hook" as const,
  };

  assert.deepEqual(
    deriveCarouselStructure2PerformanceSignals([
      hookRow,
      row("perfect_plan_breaks", 8, 120, 100),
    ]),
    {},
  );
});

function row(
  contentFormatId: string,
  evaluatedPostCount: number,
  medianViewCount: number,
  baselineMedianViewCount: number,
) {
  return {
    averageViewCount: medianViewCount,
    baselineMedianViewCount,
    contentFormatId,
    evaluatedPostCount,
    hookFamilyId: null,
    medianViewCount,
    scope: "format" as const,
    viewStandardDeviation: 0,
  };
}
