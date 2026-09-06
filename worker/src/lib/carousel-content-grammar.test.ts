import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
} from "./carousel-content-grammar.js";
import {
  parseCarouselContentPlanForAssignment,
  partitionCarouselContentPlanValidationIssues,
  validateCarouselContentPlan,
} from "./carousel-llm-slide-plan.js";
import { buildCarouselBusinessContentContext } from "./carousel-business-content-context.js";
import { inspectCarouselSlideLayout } from "./carousel-render-slide.js";

const analysis: WebsiteBusinessAnalysis = {
  brandTone: "clear and practical",
  businessName: "CampaignFlow",
  carouselAngles: ["A calmer campaign handoff"],
  categories: ["campaign planning"],
  category: "marketing software",
  claimsToAvoid: ["guaranteed revenue growth"],
  confidence: "high",
  ctaIdeas: ["Organize your next campaign"],
  differentiators: ["Planning and reporting stay in one workspace"],
  mainProblem: "Campaign planning and reporting are scattered across tools",
  mainPromise: "Keep campaign work in one organized workflow",
  painPoints: ["Missed follow-ups"],
  productSummary: "A workspace for planning and reporting marketing campaigns.",
  targetAudience: ["small marketing teams"],
  valueProps: ["Connect planning, follow-up, and reporting"],
  visualKeywords: ["paper calendar", "organized desk"],
};

test("Structure 1 expands every educational format to the agreed six-slide flow", () => {
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.formats.length, 15);
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.hookFamilies.length, 10);
  assert.equal(
    CAROUSEL_CONTENT_GRAMMAR_VERSION,
    "carousel-formats-v2-six-slide-core-flow+carousel-hook-families-v1",
  );

  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    assert.equal(format.slides.length, CAROUSEL_STRUCTURE_1_SLIDE_COUNT);
    assert.equal(format.slides[0]!.role, "cover_hook");
    assert.equal(format.slides[0]!.slideType, "hook");
    assert.equal(format.slides[4]!.role, "practical_extension");
    assert.equal(format.slides[5]!.role, "takeaway_cta");
    assert.equal(format.slides[5]!.slideType, "cta");
  }
});

test("Structure 1 accepts a six-slide reader-first educational carousel", () => {
  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    const hookFamilyId = format.compatibleHookFamilies[0]!;
    const result = parseCarouselContentPlanForAssignment(
      createFixture(format.id, hookFamilyId),
      {
        analysis,
        contentFormatId: format.id,
        hookFamilyId,
        recentHistory: [],
        slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
      },
    );

    assert.deepEqual(result.blockingIssues, [], format.id);
    assert.equal(result.plan.slides.length, 6, format.id);
    assert.equal(result.plan.slides[0]!.formatRole, "cover_hook");
    assert.equal(result.plan.slides[5]!.formatRole, "takeaway_cta");
  }
});

test("Structure 1 keeps subjective cover wording nonblocking while recording an advisory", () => {
  const fixture = createFixture("comparison", "question");
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fixture, {
        analysis,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        recentHistory: [],
        slideCount: 5,
      }),
    /exactly six slides/i,
  );

  fixture.slides[0]!.body = "Better productivity starts here";
  const accepted = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    contentFormatId: "comparison",
    hookFamilyId: "question",
    recentHistory: [],
    slideCount: 6,
  });
  assert.deepEqual(
    accepted.blockingIssues,
    [],
  );
  assert.ok(
    accepted.advisoryIssues.some((issue) => issue.code === "hook_quality"),
  );
});

test("Structure 1 uses the white SVG only for an actual heading", async () => {
  const heading = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "Supporting copy remains directly on the image.",
      ctaText: null,
      headline: "The heading is highlighted",
      imageDirection: "An object-only workspace with open centered space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 1,
      slideType: "hook",
      subtext: null,
      textMode: "headline_body",
      textPosition: "center",
    },
  });
  const bodyOnly = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "A clear cover gives readers a reason to swipe.",
      ctaText: null,
      headline: null,
      imageDirection: "An object-only workspace with open centered space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 1,
      slideType: "hook",
      subtext: null,
      textMode: "single_statement",
      textPosition: "center",
    },
  });

  assert.equal(heading.whiteBackgroundGroupCount, 1);
  assert.equal(bodyOnly.whiteBackgroundGroupCount, 0);
  assert.equal(heading.bodyFontSize, 44);
  assert.equal(bodyOnly.bodyFontSize, 60);
});

test("Structure 1 treats generic copy as a repairable blocking issue", () => {
  const parsed = parseCarouselContentPlanForAssignment(
    createFixture("comparison", "question"),
    {
      analysis,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      recentHistory: [],
      slideCount: 6,
    },
  ).plan;
  const altered = {
    ...parsed,
    slides: parsed.slides.map((slide, index) =>
      index === 1
        ? { ...slide, body: "Work smarter with one platform.", subtext: "Work smarter with one platform." }
        : slide,
    ),
  };
  const partitioned = partitionCarouselContentPlanValidationIssues(
    validateCarouselContentPlan(altered, analysis),
  );

  assert.ok(
    partitioned.blockingIssues.some((issue) => issue.code === "generic_copy"),
  );
});

function createFixture(formatId: string, hookFamilyId: string) {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats.find(
    (candidate) => candidate.id === formatId,
  );
  if (!format) throw new Error(`Unknown Structure 1 test format ${formatId}.`);

  const context = buildCarouselBusinessContentContext(analysis);
  const listItems = [
    "Capture launch context",
    "Name the next action",
    "Connect approval notes",
    "Review campaign timing",
    "Keep reporting visible",
    "Record the handoff",
  ];
  const valueBodies = [
    "Map the campaign owner before a handoff so the next decision has a clear person responsible for moving it forward.",
    "Keep approval context beside the work so campaign changes do not send the team searching through separate messages and documents.",
    "Review timing with the current reporting details so launch choices reflect what changed instead of relying on an outdated checklist.",
    "Record the practical next step after each review so the team can resume campaign work without rebuilding the handoff context.",
  ];
  let listCursor = 0;

  return {
    broadSituations: [
      "campaign details scattered across tools",
      "approval notes separated from launch work",
      "reporting context missing during handoffs",
    ],
    concept: `A practical ${format.name} for clearer campaign handoffs`,
    contentStrategy: {
      angle: `Use ${format.name} to keep campaign handoffs clear`,
      audienceId: context.audiences[0]!.id,
      contentFormatId: format.id,
      customerGoalId: context.customerGoals[0]!.id,
      hookFamilyId,
      problemId: context.problems[0]!.id,
      topicId: context.topics[0]!.id,
    },
    slides: format.slides.map((definition, index) => {
      const listItemCount = definition.listItemCount ?? 0;
      const selectedListItems = listItems.slice(listCursor, listCursor + listItemCount);
      listCursor += listItemCount;
      const textMode = listItemCount > 0
        ? definition.preferredTextModes[0]!
        : definition.slideType === "cta"
          ? "cta_takeaway"
          : definition.preferredTextModes.includes("single_statement")
            ? "single_statement"
            : "body_only";
      const body = listItemCount > 0
        ? null
        : index === 0
          ? "Why campaign handoffs keep creating extra work"
          : index === 5
            ? "Keep the next campaign handoff clear with one connected workflow."
            : valueBodies[index - 1]!;

      return {
        body,
        ctaText: null,
        formatRole: definition.role,
        headline: null,
        imageDirection: "Organized calendar and notebook still life with clear upper space.",
        listItems: selectedListItems,
        slideNumber: index + 1,
        slideType: definition.slideType,
        textMode,
      };
    }),
  };
}
