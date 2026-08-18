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
import {
  buildTrendingHookCampaignPurposeSequence,
  type TrendingHookCampaignPurpose,
} from "./trending-hook-patterns.js";
import { HOOK_TEXT_FORMAT_IDS } from "./trending-hook-text-formats.js";

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
  businessModel: "B2C",
  businessName: "Calorie Fit",
  campaignPurposes: [
    "product_discovery",
    "education",
    "conversion",
  ] as TrendingHookCampaignPurpose[],
  categories: ["nutrition", "mobile app"],
  category: "nutrition",
  claimsToAvoid: ["guaranteed weight loss"],
  desiredOutcome: "Spend less attention logging meals",
  differentiator: "quicker meal logging",
  differentiators: ["quicker meal logging"],
  mainProblem: "Meal logging interrupts the day",
  mainPromise: "Spend less attention logging meals",
  painPoints: ["repetitive meal entry"],
  primaryAudience: "people who track meals",
  productSummary: "A meal logging application",
  targetAudience: ["people who track meals"],
  valueProps: ["quicker meal logging"],
};

test("campaign purpose follows the business choice and never adds an unselected goal", () => {
  assert.deepEqual(
    buildTrendingHookCampaignPurposeSequence({
      count: 4,
      performanceSignals: {
        preferredPurposes: ["product_discovery", "education"],
      },
      requestedPurposes: ["conversion"],
    }),
    ["conversion", "conversion", "conversion", "conversion"],
  );

  assert.deepEqual(
    buildTrendingHookCampaignPurposeSequence({
      count: 3,
      requestedPurposes: ["app_install"],
    }),
    ["app_install", "app_install", "app_install"],
  );
});

test("uses semantic lines and the shared 9:16 renderer fit", () => {
  const fit = measureHookOverlayVisualFit([
    "Meal logging should not",
    "interrupt your whole day.",
  ]);
  const threeLineFit = measureHookOverlayVisualFit([
    "Meal logging",
    "interrupts the day",
    "again 😩",
  ]);
  const overflow = measureHookOverlayVisualFit([
    "This intentionally oversized advertising paragraph keeps adding unnecessary words",
    "until the mobile Hook overlay must wrap these semantic lines again.",
  ]);

  assert.equal(fit.fits, true);
  assert.equal(fit.semanticLineCount, 2);
  assert.equal(fit.renderedLineCount, 2);
  assert.equal(threeLineFit.fits, true);
  assert.equal(threeLineFit.semanticLineCount, 3);
  assert.equal(threeLineFit.renderedLineCount, 3);
  assert.equal(
    threeLineFit.characterCount,
    Array.from("Meal logging interrupts the day again 😩").length,
  );
  assert.equal(overflow.fits, false);
});

test("allows up to two relevant emojis and rejects a third", () => {
  const baseDraft = {
    audioIntent: {
      energy: "medium",
      hookType: "problem",
      mood: "serious",
    },
    candidateIndex: 0,
    draftKey: "0:GF_002",
    evidenceKeys: ["mainProblem"],
    lines: ["Meal logging interrupts the day 😩"],
    hookTextFormatId: "GF_002",
    hookTextVariantId: "GF_002_A",
  } satisfies HookDraft;

  const oneEmoji = validateHookDraft({
    businessContext,
    candidate,
    draft: baseDraft,
    duplicate: false,
  });
  const twoEmojis = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...baseDraft,
      lines: ["Meal logging interrupts the day 😩😩"],
    },
    duplicate: false,
  });
  const threeEmojis = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...baseDraft,
      lines: ["Meal logging interrupts the day 😩😩😩"],
    },
    duplicate: false,
  });

  assert.equal(oneEmoji.emojiValidationPassed, true);
  assert.equal(twoEmojis.emojiValidationPassed, true);
  assert.equal(threeEmojis.emojiValidationPassed, false);
  assert.ok(threeEmojis.reasons.includes("too_many_emojis"));
});

test("hard validation blocks fabricated history, numbers, and ad phrases", () => {
  const draft = {
    audioIntent: {
      energy: "medium",
      hookType: "curiosity",
      mood: "curious",
    },
    candidateIndex: 0,
    draftKey: "0:GF_015",
    evidenceKeys: ["mainProblem"],
    lines: ["Ready to unlock", "results in 3 days?"],
    hookTextFormatId: "GF_015",
    hookTextVariantId: "GF_015_A",
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

  const danglingContrast = validateHookDraft({
    businessContext,
    candidate,
    draft: {
      ...draft,
      evidenceKeys: ["painPoints"],
      lines: [
        "Not repetition",
        "tedious steps make people stop",
      ],
    },
    duplicate: false,
  });

  assert.equal(danglingContrast.lineValidationPassed, false);
  assert.ok(
    danglingContrast.reasons.includes("invalid_semantic_lines"),
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
      audioIntent: {
        energy: "medium",
        hookType: "problem",
        mood: "serious",
      },
      candidateIndex: 0,
      draftKey: "0:GF_002",
      evidenceKeys: ["mainProblem", "productSummary"],
      lines: [
        "Logging dinner should not feel like homework — snap a photo,",
        "let the app draft details and spend that saved time elsewhere.",
      ],
      hookTextFormatId: "GF_002",
      hookTextVariantId: "GF_002_A",
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
    draftKey: "0:GF_015",
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

test("keeps the preselected Global format while repairing an unsafe draft", async () => {
  const outputs = [
    {
      hooks: [
        {
          audioIntent: {
            energy: "high",
            hookType: "curiosity",
            mood: "urgent",
          },
          candidateIndex: 0,
          draftKey: "0:GF_015",
          evidenceKeys: ["mainProblem"],
          lines: ["Ready to unlock", "a better day?"],
          hookTextFormatId: "GF_015",
          hookTextVariantId: "GF_015_A",
        },
      ],
    },
    {
      reviews: [
        {
          candidateIndex: 0,
          claimSafe: true,
          draftKey: "0:GF_015",
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
      ],
    },
    {
      hooks: [
        {
          audioIntent: {
            energy: "medium",
            fileName: "model-must-not-select-this.mp3",
            hookType: "curiosity",
            mood: "curious",
          },
          candidateIndex: 0,
          draftKey: "0:GF_015",
          evidenceKeys: ["mainProblem"],
          lines: [
            "Why does meal logging",
            "interrupt everything?",
          ],
          hookTextFormatId: "GF_015",
          hookTextVariantId: "GF_015_A",
        },
      ],
    },
    {
      reviews: [
        {
          candidateIndex: 0,
          claimSafe: true,
          draftKey: "0:GF_015",
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
    performanceSignals: {
      formatSignals: HOOK_TEXT_FORMAT_IDS.map((formatId) => ({
        formatId,
        publishedResultCount: formatId === "GF_015" ? 1 : 0,
        selectionWeight: formatId === "GF_015" ? 1.3 : 1,
        temporaryBoost: formatId === "GF_015" ? 0.12 : 0,
        timesGenerated: formatId === "GF_015" ? 0 : 100,
      })),
    },
  });

  assert.deepEqual(result[0]?.openingLines, [
    "Why does meal logging",
    "interrupt everything?",
  ]);
  assert.equal(result[0]?.hookText.includes("\n"), true);
  assert.equal(result[0]?.hookTextFormatId, "GF_015");
  assert.deepEqual(result[0]?.audioIntent, {
    energy: "medium",
    hookType: "curiosity",
    mood: "curious",
  });
  assert.equal(result[0]?.readabilityReview.repairApplied, true);
  assert.equal(result[0]?.readabilityReview.scores.total, 94);
  assert.equal(result[0]?.validation.passed, true);
  assert.equal(result[0]?.visualFit.fits, true);
  assert.match(result[0]?.inputContextHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(outputs.length, 0);
});

test("repairs one assigned format without switching to another format", async () => {
  const discoveryDraft = {
    audioIntent: {
      energy: "medium",
      hookType: "curiosity",
      mood: "curious",
    },
    candidateIndex: 0,
    draftKey: "0:GF_015",
    evidenceKeys: ["mainProblem"],
    lines: ["Why does meal logging", "interrupt everything?"],
    hookTextFormatId: "GF_015",
    hookTextVariantId: "GF_015_A",
  };
  const failingReview = (draftKey: string) => ({
    candidateIndex: 0,
    claimSafe: true,
    draftKey,
    estimatedReadingSeconds: 2.5,
    humanVoice: false,
    openingOnly: true,
    readable: true,
    reactionMatch: false,
    reason: "Needs a more natural reaction.",
    revisedLines: [],
    scores: {
      ...passingScores,
      humanVoice: 5,
      reactionMatch: 8,
      scrollStop: 7,
    },
    scrollStopping: false,
    singleIdea: true,
    truthful: true,
  });
  const passingReview = (draftKey: string) => ({
    candidateIndex: 0,
    claimSafe: true,
    draftKey,
    estimatedReadingSeconds: 2.4,
    humanVoice: true,
    openingOnly: true,
    readable: true,
    reactionMatch: true,
    reason: "Grounded, readable, and natural.",
    revisedLines: [],
    scores: passingScores,
    scrollStopping: true,
    singleIdea: true,
    truthful: true,
  });
  const outputs = [
    {
      hooks: [
        {
          ...discoveryDraft,
          lines: ["Ready to unlock", "a better day?"],
        },
      ],
    },
    {
      reviews: [
        failingReview(discoveryDraft.draftKey),
      ],
    },
    { hooks: [discoveryDraft] },
    {
      reviews: [
        passingReview(discoveryDraft.draftKey),
      ],
    },
  ];
  let requestCount = 0;
  const client = {
    responses: {
      create: async () => {
        requestCount += 1;
        return {
          output_text: JSON.stringify(outputs.shift()),
        };
      },
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
    performanceSignals: {
      formatSignals: HOOK_TEXT_FORMAT_IDS.map((formatId) => ({
        formatId,
        publishedResultCount: formatId === "GF_015" ? 1 : 0,
        selectionWeight: formatId === "GF_015" ? 1.3 : 1,
        temporaryBoost: formatId === "GF_015" ? 0.12 : 0,
        timesGenerated: formatId === "GF_015" ? 0 : 100,
      })),
    },
  });

  assert.equal(requestCount, 4);
  assert.equal(outputs.length, 0);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.openingLines.length, 2);
  assert.equal(result[0]?.hookTextFormatId, "GF_015");
  assert.equal(result[0]?.readabilityReview.repairApplied, true);
  assert.equal(result[0]?.validation.passed, true);
});
