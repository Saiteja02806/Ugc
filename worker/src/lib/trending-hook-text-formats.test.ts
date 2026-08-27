import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOK_TEXT_FORMATS,
  HOOK_TEXT_FORMAT_IDS,
  HOOK_REACTION_FORMAT_RULES,
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

test("Global V1 retains 20 format definitions and unique variants", () => {
  assert.equal(HOOK_TEXT_FORMATS.length, 20);
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

test("the Trending reaction map selects the exact compatible format", () => {
  const expectedFormats = {
    amusement_laughter: "GF_019",
    concern_anxiety: "GF_002",
    confidence_approval: "GF_006",
    confusion_skepticism: "GF_020",
    curiosity_discovery: "GF_015",
    focused_attention: "GF_009",
    secret_reveal: "GF_005",
    shock_surprise: "GF_012",
  } as const;

  assert.deepEqual(
    Object.fromEntries(
      Object.keys(HOOK_REACTION_FORMAT_RULES).map((reactionType) => [
        reactionType,
        selectHookTextFormats({
          campaignPurpose: "product_discovery",
          candidateIndex: 0,
          eligibility: baseEligibility,
          excludedFormatIds: new Set(["GF_012"]),
          performanceSignals: {
            formatSignals: [
              {
                formatId: "GF_001",
                publishedResultCount: 100,
                selectionWeight: 1.3,
                temporaryBoost: 0.12,
                timesGenerated: 0,
              },
            ],
          },
          reactionType,
          selectionStrategy: "reaction_mapped",
        })[0]?.id,
      ]),
    ),
    expectedFormats,
  );
});

test("the strict map rejects unknown reactions and missing required evidence", () => {
  assert.deepEqual(
    selectHookTextFormats({
      campaignPurpose: "product_discovery",
      candidateIndex: 0,
      eligibility: baseEligibility,
      reactionType: "unreviewed",
      selectionStrategy: "reaction_mapped",
    }),
    [],
  );

  assert.deepEqual(
    selectHookTextFormats({
      campaignPurpose: "product_discovery",
      candidateIndex: 0,
      eligibility: {
        ...baseEligibility,
        businessContext: {
          ...baseEligibility.businessContext,
          differentiator: null,
          desiredOutcome: null,
          productSummary: null,
          valueProps: [],
        },
      },
      reactionType: "amusement_laughter",
      selectionStrategy: "reaction_mapped",
    }),
    [],
  );
});

test("legacy rotation never selects retired or reaction-mapped-only formats", () => {
  const selectedIds = new Set(
    Array.from({ length: 500 }, (_, candidateIndex) =>
      selectHookTextFormats({
        campaignPurpose: "product_discovery",
        candidateIndex,
        eligibility: baseEligibility,
        reactionType: "shock_surprise",
      })[0]?.id,
    ),
  );

  for (const formatId of [
    "GF_013",
    "GF_017",
    "GF_019",
    "GF_020",
  ] as const) {
    assert.equal(selectedIds.has(formatId), false);
  }
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

test("legacy rotation still explores multiple formats across a cold start", () => {
  const selectedIds = new Set(
    Array.from({ length: 20 }, (_, candidateIndex) =>
      selectHookTextFormats({
        campaignPurpose: "product_discovery",
        candidateIndex,
        eligibility: baseEligibility,
        reactionType: "shock_surprise",
      })[0]?.id,
    ),
  );

  assert.ok(selectedIds.size > 1);
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
