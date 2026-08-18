import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOK_TEXT_FORMATS,
  HOOK_TEXT_FORMAT_IDS,
  isHookTextFormatEligible,
  selectHookTextFormats,
} from "./trending-hook-text-formats.js";

const baseEligibility = {
  businessContext: {
    categories: ["mobile app"],
    category: "productivity",
    desiredOutcome: "organize the day",
    differentiator: "automatic task prioritization",
    mainProblem: "manual planning takes attention",
    painPoints: ["rewriting a task list"],
    primaryAudience: "busy professionals",
    targetAudience: ["busy professionals"],
    valueProps: ["clear daily priorities"],
  },
  evidence: [
    { key: "mainProblem", text: "manual planning takes attention" },
    { key: "desiredOutcome", text: "organize the day" },
  ],
};

test("Global V1 contains exactly 18 permanent formats and unique variants", () => {
  assert.equal(HOOK_TEXT_FORMATS.length, 18);
  assert.deepEqual(
    HOOK_TEXT_FORMATS.map((format) => format.id),
    [...HOOK_TEXT_FORMAT_IDS],
  );
  assert.equal(
    new Set(HOOK_TEXT_FORMATS.flatMap((format) =>
      format.variants.map((variant) => variant.id),
    )).size,
    HOOK_TEXT_FORMATS.reduce(
      (total, format) => total + format.variants.length,
      0,
    ),
  );
});

test("claim-sensitive formats are unavailable without supplied evidence", () => {
  for (const formatId of ["GF_003", "GF_011", "GF_018"] as const) {
    const format = HOOK_TEXT_FORMATS.find((item) => item.id === formatId)!;
    assert.equal(isHookTextFormatEligible(format, baseEligibility), false);
  }

  const withVerifiedTiming = {
    ...baseEligibility,
    evidence: [
      ...baseEligibility.evidence,
      { key: "verifiedClaim", text: "organize 12 supplied tasks in 2 minutes" },
    ],
  };
  assert.equal(
    isHookTextFormatEligible(
      HOOK_TEXT_FORMATS.find((item) => item.id === "GF_011")!,
      withVerifiedTiming,
    ),
    true,
  );
});

test("forbidden framing is excluded for sensitive businesses", () => {
  assert.equal(
    isHookTextFormatEligible(
      HOOK_TEXT_FORMATS.find((item) => item.id === "GF_004")!,
      {
        ...baseEligibility,
        businessContext: {
          ...baseEligibility.businessContext,
          categories: ["healthcare"],
          category: "medical",
        },
      },
    ),
    false,
  );
});

test("cold start rotates broadly instead of locking a visual reaction to one text format", () => {
  const shock = selectHookTextFormats({
    campaignPurpose: "product_discovery",
    candidateIndex: 0,
    eligibility: baseEligibility,
    reactionType: "shock_surprise",
  })[0];
  const approval = selectHookTextFormats({
    campaignPurpose: "product_discovery",
    candidateIndex: 1,
    eligibility: baseEligibility,
    reactionType: "confidence_approval",
  })[0];

  assert.ok(shock);
  assert.ok(approval);
  assert.notEqual(shock?.id, approval?.id);
});

test("one strong result creates a bounded chance increase while exploration remains", () => {
  const countSelections = (temporaryBoost: number) =>
    Array.from({ length: 500 }, (_, candidateIndex) =>
      selectHookTextFormats({
        campaignPurpose: "product_discovery",
        candidateIndex,
        eligibility: baseEligibility,
        performanceSignals: {
          formatSignals: HOOK_TEXT_FORMAT_IDS.map((formatId) => ({
            formatId,
            publishedResultCount: formatId === "GF_006" ? 1 : 0,
            selectionWeight: 1,
            temporaryBoost:
              formatId === "GF_006" ? temporaryBoost : 0,
            timesGenerated: 0,
          })),
        },
        reactionType: "curiosity_discovery",
      })[0]?.id,
    ).filter((formatId) => formatId === "GF_006").length;

  const baselineSelections = countSelections(0);
  const boostedSelections = countSelections(0.08);

  assert.ok(boostedSelections > baselineSelections);
  assert.ok(boostedSelections < 100);
});
