import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
} from "./carousel-content-grammar.js";
import {
  buildCarouselContentPlan,
  CAROUSEL_CONTENT_PLANNER_VERSION,
  mergeCarouselRecentContentHistory,
  normalizeRepairedCarouselCopy,
  validateCarouselRecentContentRepetition,
  validateCarouselContentPlan,
} from "./carousel-llm-slide-plan.js";
import { buildCarouselBusinessContentContext } from "./carousel-business-content-context.js";

const analysis: WebsiteBusinessAnalysis = {
  brandTone: "clear and practical",
  businessName: "CampaignFlow",
  carouselAngles: [
    "A calmer campaign handoff",
    "How connected reporting reduces scattered work",
    "What to organize before a campaign launch",
  ],
  categories: ["campaign planning", "marketing operations"],
  category: "marketing software",
  claimsToAvoid: ["guaranteed revenue growth"],
  confidence: "high",
  ctaIdeas: ["Organize your next campaign"],
  differentiators: ["Planning and reporting stay in one workspace"],
  mainProblem: "Campaign planning and reporting are scattered across tools",
  mainPromise: "Keep campaign work in one organized workflow",
  painPoints: [
    "Missed follow-ups",
    "Manual spreadsheet reporting",
    "Late campaign checks",
  ],
  productSummary: "A workspace for planning and reporting marketing campaigns.",
  targetAudience: ["small marketing teams", "campaign managers"],
  valueProps: [
    "Connect planning, follow-up, and reporting",
    "Keep the next action visible",
  ],
  visualKeywords: ["paper calendar", "organized desk", "reporting dashboard"],
};

test("every V1 content format produces its exact five-slide grammar", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    assert.equal(CAROUSEL_CONTENT_GRAMMAR.formats.length, 15);
    assert.equal(CAROUSEL_CONTENT_GRAMMAR.hookFamilies.length, 10);

    for (const [candidateIndex, format] of
      CAROUSEL_CONTENT_GRAMMAR.formats.entries()) {
      const hookFamilyId = format.compatibleHookFamilies[0]!;
      const plan = await buildCarouselContentPlan({
        analysis,
        candidateIndex,
        contentFormatId: format.id,
        hookFamilyId,
        recentHistory: [],
        slideCount: 5,
      });

      assert.equal(plan.source, "deterministic-fallback", format.id);
      assert.equal(plan.plannerVersion, CAROUSEL_CONTENT_PLANNER_VERSION);
      assert.equal(plan.contentStrategy?.contentFormatId, format.id);
      assert.equal(plan.contentStrategy?.hookFamilyId, hookFamilyId);
      assert.equal(plan.slides.length, 5, format.id);
      assert.equal(plan.validationResult.ok, true, format.id);

      for (const [slideIndex, definition] of format.slides.entries()) {
        const slide = plan.slides[slideIndex]!;
        assert.equal(slide.slideNumber, slideIndex + 1, format.id);
        assert.equal(slide.formatRole, definition.role, format.id);
        assert.equal(slide.slideType, definition.slideType, format.id);
        assert.ok(
          definition.preferredTextModes.includes(slide.textMode),
          `${format.id} slide ${slideIndex + 1} used ${slide.textMode}`,
        );

        if (definition.listItemCount !== undefined) {
          assert.equal(
            slide.listItems.length,
            definition.listItemCount,
            `${format.id} slide ${slideIndex + 1}`,
          );
        }
      }
    }

    assert.equal(
      CAROUSEL_CONTENT_GRAMMAR_VERSION,
      "carousel-formats-v1+carousel-hook-families-v1",
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("resources fallback stays valid with only four saved content options", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const sparseAnalysis: WebsiteBusinessAnalysis = {
      ...analysis,
      carouselAngles: [],
      categories: ["meal planning"],
      category: "fitness",
      mainProblem: "Meal logging feels inconsistent",
      mainPromise: "Keep meal logging clearer",
      painPoints: [],
      valueProps: [],
      visualKeywords: [],
    };
    const plan = await buildCarouselContentPlan({
      analysis: sparseAnalysis,
      candidateIndex: 0,
      contentFormatId: "resources",
      hookFamilyId: "specific_outcome",
      recentHistory: [],
      slideCount: 5,
    });
    const resourceSlides = plan.slides.slice(1, 4);
    const resourceItems = resourceSlides.flatMap((slide) => slide.listItems);

    assert.equal(plan.validationResult.ok, true);
    assert.equal(resourceItems.length, 6);
    assert.equal(new Set(resourceItems).size, 6);
    assert.equal(
      new Set(resourceSlides.map((slide) => slide.listItems.join(" "))).size,
      3,
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("resources fallback treats AI as meaningful copy in repetition checks", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const compactTopicAnalysis: WebsiteBusinessAnalysis = {
      ...analysis,
      carouselAngles: ["Speed up meal logging"],
      categories: ["Nutrition Tracking"],
      category: "Nutrition Tracking",
      mainProblem:
        "Users struggle with meal logging and need personalized guidance.",
      mainPromise: "Fast meal tracking with access to nutrition experts.",
      painPoints: ["Logging meals is time-consuming"],
      valueProps: ["AI-assisted meal logging"],
      visualKeywords: ["AI", "nutrition", "meal logging", "support", "progress"],
    };
    const plan = await buildCarouselContentPlan({
      analysis: compactTopicAnalysis,
      candidateIndex: 0,
      contentFormatId: "resources",
      hookFamilyId: "specific_outcome",
      recentHistory: [],
      slideCount: 5,
    });

    assert.equal(plan.validationResult.ok, true);
    const resourceItems = plan.slides.slice(1, 4).flatMap((slide) => slide.listItems);
    assert.equal(resourceItems.length, 6);
    assert.equal(new Set(resourceItems).size, 6);
    assert.ok(
      resourceItems.every((item) =>
        /^(Checklist|Guide|Review prompt):/i.test(item),
      ),
    );
    assert.ok(resourceItems.every((item) => item.length <= 44));
    assert.equal(resourceItems[0], "Guide: Nutrition Tracking");
    assert.equal(resourceItems[1], "Checklist: Fast meal tracking");
    assert.equal(resourceItems[2], "Guide: meal logging");
    assert.ok(resourceItems.includes("Checklist: AI-assisted meal logging"));
    assert.ok(
      resourceItems.every((item) => !/^(?:Guide|Checklist): (?:AI|support)$/i.test(item)),
    );
    assert.match(
      `${plan.slides[0]?.headline ?? ""} ${plan.slides[0]?.body ?? ""}`,
      /(?:six Nutrition Tracking resources|six practical references)/i,
    );
    assert.equal(
      plan.slides[0]?.subtext,
      "Save six practical references for fast meal tracking with access to nutrition experts.",
    );
    assert.ok(resourceItems.every((item) => !/users struggle/i.test(item)));
    assert.equal(plan.slides.length, 5);

    const actionTopicPlan = await buildCarouselContentPlan({
      analysis: {
        ...compactTopicAnalysis,
        carouselAngles: [],
        categories: [],
        category: "Speed up meal logging",
        visualKeywords: [],
      },
      candidateIndex: 0,
      contentFormatId: "resources",
      hookFamilyId: "specific_outcome",
      recentHistory: [],
      slideCount: 5,
    });
    assert.match(
      `${actionTopicPlan.slides[0]?.headline ?? ""} ${actionTopicPlan.slides[0]?.body ?? ""}`,
      /(?:meal logging resources|practical references)/i,
    );

    const compactTermIssues = validateCarouselContentPlan(
      {
        ...plan,
        slides: plan.slides.map((slide, index) =>
          index === 1
            ? { ...slide, listItems: ["Nutrition Tracking", "AI"] }
            : slide,
        ),
      },
      compactTopicAnalysis,
    );
    assert.equal(
      compactTermIssues.some((issue) => issue.code === "story_repetition"),
      false,
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("examples fallback replaces repeated AI copy with a fresh format-aware story", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const nutritionAnalysis: WebsiteBusinessAnalysis = {
      brandTone: "supportive and practical",
      businessName: "Calorie Fit",
      carouselAngles: ["Speed up meal logging", "Understand your nutrition"],
      categories: ["Nutrition Tracking"],
      category: "fitness health",
      ctaIdeas: ["Join the waitlist"],
      mainProblem: "Logging meals can be tedious",
      mainPromise: "Fast meal logging with access to nutrition experts",
      painPoints: [
        "Logging meals can be tedious",
        "Traditional calorie tracking lacks personalized guidance",
        "Need for context in tracking",
      ],
      targetAudience: ["People seeking weight management"],
      valueProps: [
        "AI-assisted meal logging",
        "Personalized nutrition guidance",
        "Clear progress insights",
      ],
      visualKeywords: ["AI", "nutrition", "meal logging", "support", "progress"],
    };
    const recentHistory = [
      {
        angle:
          "Speed up meal logging with expert support for health-conscious individuals",
        contentFormatId: "framework",
        hook:
          "Use this simple system to log meals faster and get expert nutrition help.",
        hookFamilyId: "utility",
        topic: "Speed up meal logging",
        topicId: "topic_speed_up_meal_logging_95vb7h",
      },
      {
        angle: "AI: Need for context in tracking toward Clear progress insights",
        contentFormatId: "list",
        hook: "AI has a less obvious pattern",
        hookFamilyId: "surprise",
        topic: "AI",
        topicId: "topic_ai_9xx36n",
      },
    ];
    const plan = await buildCarouselContentPlan({
      analysis: nutritionAnalysis,
      candidateIndex: 1,
      contentFormatId: "examples",
      hookFamilyId: "utility",
      recentHistory,
      slideCount: 5,
    });

    assert.equal(plan.source, "deterministic-fallback");
    assert.equal(plan.contentStrategy?.contentFormatId, "examples");
    assert.equal(plan.contentStrategy?.hookFamilyId, "utility");
    assert.deepEqual(
      plan.slides.map((slide) => slide.formatRole),
      ["hook", "example_1", "example_2", "example_3", "pattern_cta"],
    );
    assert.equal(
      plan.slides.some((slide) =>
        slide.body?.includes(
          "Busy meals make detailed logging easy to postpone until the day is already over.",
        ),
      ),
      false,
    );
    assert.match(
      `${plan.slides[0]?.headline ?? ""} ${plan.slides[0]?.body ?? ""}`,
      /examples/i,
    );
    assert.ok(
      plan.slides.every(
        (slide) => !/current routine|supporting context/i.test(slide.body ?? ""),
      ),
    );
    assert.deepEqual(
      validateCarouselRecentContentRepetition(
        plan,
        recentHistory,
        buildCarouselBusinessContentContext(nutritionAnalysis).topics,
      ),
      [],
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("V1 repair keeps a completed takeaway CTA-free", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const plan = await buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      contentFormatId: "checklist",
      hookFamilyId: "utility",
      recentHistory: [],
      slideCount: 5,
    });
    const repaired = normalizeRepairedCarouselCopy({
      ...plan.normalizedPlan,
      slides: plan.normalizedPlan.slides.map((slide, index) =>
        index === 4
          ? { ...slide, ctaText: null, formatRole: slide.formatRole ?? null }
          : { ...slide, formatRole: slide.formatRole ?? null },
      ),
    });

    assert.equal(repaired.slides[4]?.ctaText, null);
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("rejects an exact calorie claim missing from the saved profile evidence", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const plan = await buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      contentFormatId: "myth_fact",
      hookFamilyId: "contrarian",
      recentHistory: [],
      slideCount: 5,
    });
    const unsupported = {
      ...plan,
      slides: plan.slides.map((slide, index) =>
        index === 1
          ? {
              ...slide,
              body: "A 1,200 calorie target works for every person.",
              subtext: "A 1,200 calorie target works for every person.",
            }
          : slide,
      ),
    };

    assert.ok(
      validateCarouselContentPlan(unsupported, analysis).some(
        (issue) => issue.code === "unsupported_claim",
      ),
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});

test("uses saved business model and campaign purposes in controlled context", () => {
  const context = buildCarouselBusinessContentContext({
    ...analysis,
    businessModel: "b2b",
    campaignPurposes: ["education", "conversion"],
  });

  assert.equal(context.brand.businessModel, "b2b");
  assert.deepEqual(context.brand.campaignPurposes, [
    "Educate the audience",
    "Support conversion",
  ]);
});

test("merges same-batch ideas ahead of reserved history without exceeding ten", () => {
  const sibling = {
    angle: "A fresh sibling angle",
    contentFormatId: "comparison",
    hook: "Which campaign view is clearer?",
    hookFamilyId: "question",
    topic: "campaign reporting",
    topicId: "topic_campaign_reporting",
  };
  const olderHistory = Array.from({ length: 10 }, (_, index) => ({
    angle: `Older angle ${index}`,
    contentFormatId: "list",
    hook: `Older hook ${index}`,
    hookFamilyId: "utility",
    topic: `Older topic ${index}`,
    topicId: `topic_older_${index}`,
  }));
  const merged = mergeCarouselRecentContentHistory(
    [sibling],
    [sibling, ...olderHistory],
  );

  assert.equal(merged.length, 10);
  assert.deepEqual(merged[0], sibling);
  assert.equal(
    merged.filter((item) => item.topicId === sibling.topicId).length,
    1,
  );
});

test("rejects a repeated topic while another saved topic is available", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";

  try {
    const context = buildCarouselBusinessContentContext(analysis);
    const plan = await buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      recentHistory: [],
      slideCount: 5,
    });
    const strategy = plan.contentStrategy!;
    const issues = validateCarouselRecentContentRepetition(
      plan,
      [{ topic: strategy.topic, topicId: strategy.topicId }],
      context.topics,
    );

    assert.ok(
      issues.some((issue) =>
        issue.message.includes("another saved topic is available"),
      ),
    );

    const rotatedPlan = await buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      recentHistory: [{ topic: strategy.topic, topicId: strategy.topicId }],
      slideCount: 5,
    });

    assert.notEqual(rotatedPlan.contentStrategy?.topicId, strategy.topicId);
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
  }
});
