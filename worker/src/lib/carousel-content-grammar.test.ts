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
