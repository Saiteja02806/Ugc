import assert from "node:assert/strict";
import test from "node:test";

import {
  generateValidatedTrendingHookCopies,
  isPassingHookReview,
  measureHookOverlayVisualFit,
  validateHookDraft,
  type HookDraft,
  type HookReview,
  type TrendingHookCopyCandidate,
} from "./trending-hook-copy.js";

const candidate = {
  candidateIndex: 0,
  durationSeconds: 3,
  influencerId: "catalog:creator-001",
  influencerKey: "creator_001",
  influencerName: "Creator 001",
  influencerVideoId: "video-1",
  influencerVideoTitle: "Creator 001 - Shock Surprise",
  reactionType: "shock_surprise",
  sourceDurationSeconds: 3,
  sourceKind: "catalog",
  thumbnailUrl: null,
  trimEnd: 3,
  trimStart: 0,
  visualGroup: "indoor_selfie_closeup",
} satisfies TrendingHookCopyCandidate;

const passingScores = {
  businessRelevance: 19,
  claimSafety: 10,
  humanVoice: 14,
  originality: 4,
  reactionMatch: 19,
  readability: 14,
  scrollStop: 14,
};

const businessContext = {
  brandTone: "clear",
  businessName: "Calorie Fit",
  category: "nutrition",
  claimsToAvoid: ["guaranteed weight loss"],
  differentiators: ["quicker meal logging"],
  mainProblem: "Meal logging interrupts the day",
  mainPromise: "Spend less attention logging meals",
  painPoints: ["repetitive meal entry"],
  productSummary: "A meal logging application",
  targetAudience: ["people who track meals"],
  valueProps: ["quicker meal logging"],
};

test("uses semantic lines and the shared 9:16 renderer fit", () => {
  const fit = measureHookOverlayVisualFit([
    "Meal logging should not",
    "interrupt your whole day.",
  ]);
  const overflow = measureHookOverlayVisualFit([
    "This intentionally oversized advertising paragraph keeps adding unnecessary words",
    "until the mobile Hook overlay must wrap these semantic lines again.",
  ]);

  assert.equal(fit.fits, true);
  assert.equal(fit.semanticLineCount, 2);
  assert.equal(fit.renderedLineCount, 2);
  assert.equal(overflow.fits, false);
});

test("hard validation blocks fabricated history, numbers, and ad phrases", () => {
  const draft = {
    candidateIndex: 0,
    draftKey: "0:mystery_discovery",
    evidenceKeys: ["mainProblem"],
    lines: ["Ready to unlock", "results in 3 days?"],
    patternId: "mystery_discovery",
  } satisfies HookDraft;
  const validation = validateHookDraft({
    businessContext,
    candidate,
    draft,
    duplicate: false,
  });

  assert.equal(validation.passed, false);
  assert.equal(validation.bannedPhrasePassed, false);
  assert.equal(validation.claimValidationPassed, false);

  const populationClaim = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...draft,
      lines: ["Most people quit tracking", "because logging takes too long."],
    },
    duplicate: false,
  });

  assert.equal(populationClaim.claimValidationPassed, false);
  assert.ok(
    populationClaim.reasons.includes(
      "unsupported_high_risk_claim",
    ),
  );

  const inventedTiming = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...draft,
      lines: [
        "Tracking gets abandoned midweek.",
        "Logging becomes a chore.",
      ],
    },
    duplicate: false,
  });

  assert.ok(
    inventedTiming.reasons.includes(
      "unsupported_time_or_number",
    ),
  );

  const inventedSetting = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...draft,
      lines: [
        "Meal logging should not eat into dinner.",
        "A faster trick hides in your pantry.",
      ],
    },
    duplicate: false,
  });

  assert.equal(inventedSetting.businessGroundingPassed, false);
  assert.ok(
    inventedSetting.reasons.includes("weak_business_grounding"),
  );
});

test("rejects a Wall-of-text paragraph used as a Hook opening", () => {
  const validation = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      candidateIndex: 0,
      draftKey: "0:problem_observation",
      evidenceKeys: ["mainProblem", "productSummary"],
      lines: [
        "Logging dinner should not feel like homework — snap a photo,",
        "let the app draft details and spend that saved time elsewhere.",
      ],
      patternId: "problem_observation",
    },
    duplicate: false,
  });

  assert.equal(validation.passed, false);
  assert.ok(validation.reasons.includes("hook_too_long"));
  assert.ok(validation.reasons.includes("multiple_messages"));
  assert.ok(
    validation.reasons.includes(
      "hook_contains_demo_explanation",
    ),
  );
  assert.ok(validation.reasons.includes("ai_like_language"));
  assert.ok(
    validation.reasons.includes(
      "unverified_secondary_benefit",
    ),
  );
});

test("the AI reading judgment has no duration-to-word formula", () => {
  const review = {
    candidateIndex: 0,
    claimSafe: true,
    draftKey: "0:mystery_discovery",
    estimatedReadingSeconds: 2.9,
    humanVoice: true,
    openingOnly: true,
    readable: true,
    reactionMatch: true,
    reason: "Comfortable in one pass.",
    revisedLines: [],
    scores: passingScores,
    scrollStopping: true,
    singleIdea: true,
    truthful: true,
  } satisfies HookReview;
  const validation = {
    aiLikeLanguagePassed: true,
    bannedPhrasePassed: true,
    businessGroundingPassed: true,
    claimValidationPassed: true,
    demoExplanationPassed: true,
    duplicateCheckPassed: true,
    emojiValidationPassed: true,
    evidenceBindingPassed: true,
    evidenceBindings: [
      {
        key: "mainProblem",
        text: businessContext.mainProblem,
      },
    ],
    firstPersonValidationPassed: true,
    intentionalLineBreaksPassed: true,
    lineValidationPassed: true,
    multipleMessagesPassed: true,
    passed: true,
    reasons: [],
    secondaryBenefitPassed: true,
    textFitPassed: true,
  };

  assert.equal(
    isPassingHookReview({ candidate, review, validation }),
    true,
  );
  assert.equal(
    isPassingHookReview({
      candidate,
      review: { ...review, estimatedReadingSeconds: 3.1 },
      validation,
    }),
    false,
  );
});

test("generates two patterns, repairs failures, and selects the best safe draft", async () => {
  const outputs = [
    {
      hooks: [
        {
          candidateIndex: 0,
          draftKey: "0:mystery_discovery",
          evidenceKeys: ["mainProblem"],
          lines: ["Ready to unlock", "a better day?"],
          patternId: "mystery_discovery",
        },
        {
          candidateIndex: 0,
          draftKey: "0:problem_observation",
          evidenceKeys: ["mainProblem"],
          lines: ["Meal logging keeps", "stealing your attention."],
          patternId: "problem_observation",
        },
      ],
    },
    {
      reviews: [
        {
          candidateIndex: 0,
          claimSafe: true,
          draftKey: "0:mystery_discovery",
          estimatedReadingSeconds: 2.5,
          humanVoice: false,
          openingOnly: true,
          readable: true,
          reactionMatch: false,
          reason: "Generic advertising language.",
          revisedLines: [
            "Why does meal logging",
            "interrupt everything?",
          ],
          scores: {
            ...passingScores,
            humanVoice: 5,
            reactionMatch: 8,
            scrollStop: 7,
          },
          scrollStopping: false,
          singleIdea: true,
          truthful: true,
        },
        {
          candidateIndex: 0,
          claimSafe: true,
          draftKey: "0:problem_observation",
          estimatedReadingSeconds: 2.5,
          humanVoice: true,
          openingOnly: true,
          readable: true,
          reactionMatch: true,
          reason: "Specific and readable.",
          revisedLines: [],
          scores: {
            ...passingScores,
            originality: 3,
          },
          scrollStopping: true,
          singleIdea: true,
          truthful: true,
        },
      ],
    },
    {
      hooks: [
        {
          candidateIndex: 0,
          draftKey: "0:mystery_discovery",
          evidenceKeys: ["mainProblem"],
          lines: [
            "Why does meal logging",
            "interrupt everything?",
          ],
          patternId: "mystery_discovery",
        },
      ],
    },
    {
      reviews: [
        {
          candidateIndex: 0,
          claimSafe: true,
          draftKey: "0:mystery_discovery",
          estimatedReadingSeconds: 2.4,
          humanVoice: true,
          openingOnly: true,
          readable: true,
          reactionMatch: true,
          reason: "A grounded question with a clean two-line rhythm.",
          revisedLines: [],
          scores: passingScores,
          scrollStopping: true,
          singleIdea: true,
          truthful: true,
        },
      ],
    },
  ];
  const client = {
    responses: {
      create: async () => ({
        output_text: JSON.stringify(outputs.shift()),
      }),
    },
  };

  const result = await generateValidatedTrendingHookCopies({
    businessProfile: {
      businessName: "Calorie Fit",
      mainProblem: "Meal logging interrupts the day",
      productSummary: "A meal logging application",
    },
    candidates: [candidate],
    client: client as never,
    model: "test-model",
  });

  assert.deepEqual(result[0]?.openingLines, [
    "Why does meal logging",
    "interrupt everything?",
  ]);
  assert.equal(result[0]?.hookText.includes("\n"), true);
  assert.equal(result[0]?.patternId, "mystery_discovery");
  assert.equal(result[0]?.readabilityReview.repairApplied, true);
  assert.equal(result[0]?.readabilityReview.scores.total, 94);
  assert.equal(result[0]?.validation.passed, true);
  assert.equal(result[0]?.visualFit.fits, true);
  assert.match(result[0]?.inputContextHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(outputs.length, 0);
});
