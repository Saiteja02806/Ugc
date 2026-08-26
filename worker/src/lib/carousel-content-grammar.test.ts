import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
} from "./carousel-content-grammar.js";
import {
  buildCarouselContentPlan,
  mergeCarouselRecentContentHistory,
  parseCarouselContentPlanForAssignment,
  partitionCarouselContentPlanValidationIssues,
  validateCarouselRecentContentRepetition,
  validateCarouselContentPlan,
} from "./carousel-llm-slide-plan.js";
import { buildCarouselBusinessContentContext } from "./carousel-business-content-context.js";
import { inspectCarouselSlideLayout } from "./carousel-render-slide.js";

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

test("every Structure 1 format accepts the exact assigned five-slide grammar", () => {
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.formats.length, 15);
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.hookFamilies.length, 10);
  assert.deepEqual(
    CAROUSEL_CONTENT_GRAMMAR.formats
      .map((format) => format.rotationOrder)
      .sort((left, right) => left - right),
    Array.from({ length: 15 }, (_, index) => index + 1),
  );

  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    const hookFamilyId = format.compatibleHookFamilies[0]!;
    const fixture = createAssignedStructure1Fixture(format.id, hookFamilyId);
    const result = parseCarouselContentPlanForAssignment(fixture, {
      analysis,
      candidateIndex: format.rotationOrder - 1,
      contentFormatId: format.id,
      hookFamilyId,
      recentHistory: [],
      slideCount: 5,
    });

    assert.deepEqual(result.blockingIssues, [], format.id);
    assert.equal(result.plan.contentStrategy?.contentFormatId, format.id);
    assert.equal(result.plan.contentStrategy?.hookFamilyId, hookFamilyId);
    assert.equal(result.plan.slides.length, 5, format.id);
    assert.ok(
      result.plan.slides.every((slide) => slide.textPosition === "center"),
      `${format.id} should keep every automatic text group centered`,
    );

    for (const [slideIndex, definition] of format.slides.entries()) {
      const slide = result.plan.slides[slideIndex]!;
      assert.equal(slide.slideNumber, slideIndex + 1, format.id);
      assert.equal(slide.formatRole, definition.role, format.id);
      assert.equal(slide.slideType, definition.slideType, format.id);
      assert.ok(
        definition.preferredTextModes.includes(slide.textMode),
        `${format.id} slide ${slideIndex + 1} used ${slide.textMode}`,
      );
      if (definition.listItemCount !== undefined) {
        assert.equal(slide.listItems.length, definition.listItemCount);
      }
    }
  }

  assert.equal(
    CAROUSEL_CONTENT_GRAMMAR_VERSION,
    "carousel-formats-v1+carousel-hook-families-v1",
  );
});

test("Structure 1 uses Structure 2's plain white SVG text treatment", async () => {
  const headlineAndBody = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "Supporting copy stays plain white over the image instead of receiving a second SVG bubble.",
      ctaText: null,
      headline: "The headline uses the same direct white text treatment",
      imageDirection: "An object-only workspace with clear centered space.",
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
      body: "This normal body copy remains white text directly on the image with no SVG background.",
      ctaText: null,
      headline: null,
      imageDirection: "An object-only workspace with clear centered space.",
      layoutPreset: "caption-cluster",
      listItems: [],
      slideNumber: 2,
      slideType: "problem",
      subtext: null,
      textMode: "body_only",
      textPosition: "center",
    },
  });
  const headingAndList = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: null,
      ctaText: null,
      headline: "This heading has no white background bubble",
      imageDirection: "An object-only workspace with clear centered space.",
      layoutPreset: "interactive-list",
      listItems: ["First normal list item", "Second normal list item"],
      slideNumber: 3,
      slideType: "problem",
      subtext: null,
      textMode: "question_list",
      textPosition: "center",
    },
  });

  assert.equal(headlineAndBody.whiteBackgroundGroupCount, 0);
  assert.equal(headingAndList.whiteBackgroundGroupCount, 0);
  assert.equal(bodyOnly.whiteBackgroundGroupCount, 0);
  assert.equal(
    headlineAndBody.bubbleShapeStrategy,
    "plain-white-text-with-shadow",
  );
  assert.equal(headlineAndBody.fontFamily, "Geist, Arial, Helvetica, sans-serif");
});

test("Structure 1 preserves structurally valid AI copy verbatim", () => {
  const fixture = createAssignedStructure1Fixture(
    "comparison",
    "question",
  );
  const exactCopy =
    "i’d compare both campaign handoffs before choosing the calmer workflow.";
  fixture.slides[0]!.body = exactCopy;

  const result = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    candidateIndex: 0,
    contentFormatId: "comparison",
    hookFamilyId: "question",
    recentHistory: [],
    slideCount: 5,
  });

  assert.equal(result.plan.slides[0]?.body, exactCopy);
  assert.equal(result.plan.slides[0]?.subtext, exactCopy);
  assert.deepEqual(result.blockingIssues, []);
});

test("Structure 1 accepts a 50-word follow-up body without changing its centered placement", async () => {
  const fixture = createAssignedStructure1Fixture("comparison", "question");
  const expandedBody =
    "Each review keeps the plan clear so the next handoff starts with the right owner, timing, notes, goals, tasks, risks, facts, and next steps, giving the team enough context to keep work moving without repeating old talks or losing track of what must happen next today for everyone right now.";
  fixture.slides[1]!.body = expandedBody;

  const result = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    candidateIndex: 0,
    contentFormatId: "comparison",
    hookFamilyId: "question",
    recentHistory: [],
    slideCount: 5,
  });

  assert.equal(expandedBody.split(/\s+/).length, 50);
  assert.ok(expandedBody.length > 240);
  assert.ok(expandedBody.length <= 300);
  assert.equal(result.plan.slides[1]!.body, expandedBody);
  assert.equal(result.plan.slides[1]!.textPosition, "center");
  assert.deepEqual(result.blockingIssues, []);
  await inspectCarouselSlideLayout({
    format: "4:5",
    slide: result.plan.slides[1]!,
  });
});

test("Structure 1 keeps Slide 1 at 40 words and blocks more than 50 words on Slides 2-5", () => {
  const fiftyWordBody =
    "Each review keeps the plan clear so the next handoff starts with the right owner, timing, notes, goals, tasks, risks, facts, and next steps, giving the team enough context to keep work moving without repeating old talks or losing track of what must happen next today for everyone right now.";
  const fortyOneWordBody =
    "Keep each plan clear so the next handoff has the right owner, time, notes, goals, tasks, risks, facts, and steps, giving the full team enough context to move work forward without repeating old talks or losing track of key decisions today.";
  const slideOneFixture = createAssignedStructure1Fixture("comparison", "question");
  slideOneFixture.slides[0]!.body = fortyOneWordBody;

  assert.equal(fortyOneWordBody.split(/\s+/).length, 41);
  assert.ok(fortyOneWordBody.length <= 240);

  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(slideOneFixture, {
        analysis,
        candidateIndex: 0,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        recentHistory: [],
        slideCount: 5,
      }),
    /Slide 1 body must not exceed 40 words/,
  );

  const fiftyOneWordFixture = createAssignedStructure1Fixture(
    "comparison",
    "question",
  );
  fiftyOneWordFixture.slides[1]!.body = fiftyWordBody.replace(
    "right now.",
    "right now together.",
  );
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fiftyOneWordFixture, {
        analysis,
        candidateIndex: 0,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        recentHistory: [],
        slideCount: 5,
      }),
    /Slide 2 body must not exceed 50 words/,
  );
});

test("Structure 1 rejects a changed format, role order, or required field", () => {
  const changedFormat = createAssignedStructure1Fixture(
    "comparison",
    "question",
  );
  changedFormat.contentStrategy.contentFormatId = "list";
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(changedFormat, {
        analysis,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        slideCount: 5,
      }),
    /changed the backend-selected content format/,
  );

  const changedRole = createAssignedStructure1Fixture(
    "comparison",
    "question",
  );
  changedRole.slides[1]!.formatRole = "option_b";
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(changedRole, {
        analysis,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        slideCount: 5,
      }),
    /must use format role option_a/,
  );

  const missingCopy = createAssignedStructure1Fixture(
    "comparison",
    "question",
  );
  missingCopy.slides[1]!.body = null;
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(missingCopy, {
        analysis,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        slideCount: 5,
      }),
    /body_only needs body/,
  );

  const unexpectedList = createAssignedStructure1Fixture(
    "problem_solution",
    "problem_recognition",
  );
  unexpectedList.slides[4]!.listItems = ["Hardcoded extra item"];
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(unexpectedList, {
        analysis,
        contentFormatId: "problem_solution",
        hookFamilyId: "problem_recognition",
        slideCount: 5,
      }),
    /must keep listItems empty/,
  );
});

test("Structure 1 has no deterministic planner mode or authored fallback", async () => {
  const previousMode = process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      buildCarouselContentPlan({
        analysis,
        candidateIndex: 0,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        recentHistory: [],
        slideCount: 5,
      }),
      /Missing OPENAI_API_KEY/,
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_CONTENT_PLANNER_MODE = previousMode;
    }
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  }
});

test("fails closed before planning when a V1 assignment is missing or incomplete", async () => {
  await assert.rejects(
    buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      recentHistory: [],
      slideCount: 5,
    }),
    /Carousel V1 requires exactly five slides plus a backend-selected content format and compatible hook family/,
  );

  await assert.rejects(
    buildCarouselContentPlan({
      analysis,
      candidateIndex: 0,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      recentHistory: [],
      slideCount: 4,
    }),
    /Carousel V1 requires exactly five slides plus a backend-selected content format and compatible hook family/,
  );
});

test("Structure 1 wording preferences remain advisory for publishing", () => {
  const parsed = parseAssignedFixture("checklist", "utility");
  const usableCopy = {
    ...parsed,
    slides: parsed.slides.map((slide, index) =>
      index === 1
        ? {
            ...slide,
            body: "work smarter with ease",
            subtext: "work smarter with ease",
          }
        : slide,
    ),
  };
  const issues = validateCarouselContentPlan(usableCopy, analysis);
  const partitioned = partitionCarouselContentPlanValidationIssues(issues);

  assert.ok(issues.some((issue) => issue.code === "generic_copy"));
  assert.deepEqual(partitioned.blockingIssues, []);
  assert.ok(partitioned.advisoryIssues.length > 0);
});

test("Structure 1 blocks copy that cannot fit at the fixed slideshow font size", () => {
  const parsed = parseAssignedFixture("checklist", "utility");
  const oversized = {
    ...parsed,
    slides: parsed.slides.map((slide, index) =>
      index === 1 && slide.listItems.length > 0
        ? {
            ...slide,
            listItems: [
              "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
              ...slide.listItems.slice(1),
            ],
          }
        : slide,
    ),
  };
  const partitioned = partitionCarouselContentPlanValidationIssues(
    validateCarouselContentPlan(oversized, analysis),
  );

  assert.ok(
    partitioned.blockingIssues.some((issue) => issue.code === "render_fit"),
  );
});

test("Structure 1 reports unsupported claims without replacing structurally valid AI copy", () => {
  const parsed = parseAssignedFixture("myth_fact", "contrarian");
  const unsupported = {
    ...parsed,
    slides: parsed.slides.map((slide, index) =>
      index === 1
        ? {
            ...slide,
            body: "A 1,200 calorie target works for every person.",
            subtext: "A 1,200 calorie target works for every person.",
          }
        : slide,
    ),
  };
  const issues = validateCarouselContentPlan(unsupported, analysis);

  assert.ok(issues.some((issue) => issue.code === "unsupported_claim"));
  assert.deepEqual(
    partitionCarouselContentPlanValidationIssues(issues).blockingIssues,
    [],
  );
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
  const sibling = makeRecentCopy("sibling", "Which campaign view is clearer?");
  const olderHistory = Array.from({ length: 10 }, (_, index) =>
    makeRecentCopy(`older-${index}`, `Older hook ${index}`),
  );
  const merged = mergeCarouselRecentContentHistory(
    [sibling],
    [sibling, ...olderHistory],
  );

  assert.equal(merged.length, 10);
  assert.deepEqual(merged[0], sibling);
  assert.equal(merged.filter((item) => item.generationId === sibling.generationId).length, 1);
});

test("classifies repeated exact Structure 1 copy as advisory", () => {
  const plan = parseAssignedFixture("comparison", "question");
  const hook = plan.slides[0]!.headline ?? plan.slides[0]!.body ?? "";
  const issues = validateCarouselRecentContentRepetition(
    plan,
    [makeRecentCopy("repeat", hook)],
  );
  const partitioned = partitionCarouselContentPlanValidationIssues(issues);

  assert.ok(
    issues.some((issue) => issue.code === "recent_repetition"),
  );
  assert.deepEqual(partitioned.blockingIssues, []);
  assert.ok(
    partitioned.advisoryIssues.some(
      (issue) => issue.code === "recent_repetition",
    ),
  );
});

function parseAssignedFixture(formatId: string, hookFamilyId: string) {
  return parseCarouselContentPlanForAssignment(
    createAssignedStructure1Fixture(formatId, hookFamilyId),
    {
      analysis,
      contentFormatId: formatId,
      hookFamilyId,
      recentHistory: [],
      slideCount: 5,
    },
  ).plan;
}

function makeRecentCopy(id: string, headline: string) {
  return {
    contentPlanItemId: null,
    formatId: "comparison",
    generationId: id,
    slides: [
      {
        ctaText: null,
        headline,
        slideNumber: 1,
        subtext: null,
      },
    ],
    structureId: "structure_1" as const,
  };
}

function createAssignedStructure1Fixture(
  formatId: string,
  hookFamilyId: string,
) {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats.find(
    (candidate) => candidate.id === formatId,
  );
  if (!format) throw new Error(`Unknown Structure 1 test format ${formatId}.`);

  const businessContext = buildCarouselBusinessContentContext(analysis);
  const listItems = [
    "Capture launch context",
    "Name the next action",
    "Connect approval notes",
    "Review campaign timing",
    "Keep reporting visible",
    "Record the handoff",
  ];
  const ordinals = ["opening", "first", "second", "third", "closing"];
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
      audienceId: businessContext.audiences[0]!.id,
      contentFormatId: format.id,
      customerGoalId: businessContext.customerGoals[0]!.id,
      hookFamilyId,
      problemId: businessContext.problems[0]!.id,
      topicId: businessContext.topics[0]!.id,
    },
    slides: format.slides.map((definition, index) => {
      const listItemCount = definition.listItemCount ?? 0;
      const selectedListItems = listItems.slice(
        listCursor,
        listCursor + listItemCount,
      );
      listCursor += listItemCount;
      const textMode = listItemCount > 0
        ? definition.preferredTextModes[0]!
        : definition.slideType === "cta"
          ? "cta_takeaway"
          : definition.preferredTextModes.includes("single_statement")
            ? "single_statement"
            : definition.preferredTextModes.includes("body_only")
              ? "body_only"
              : "headline_body";
      const body = listItemCount > 0
        ? null
        : index === 0
          ? "Scattered campaign details make every launch harder to review calmly."
          : index === 4
            ? "Keep one clear action visible before the next campaign handoff begins."
            : `The ${ordinals[index]} campaign detail stays connected before the next launch review begins.`;
      const headline = textMode === "headline_body"
        ? `Campaign detail ${ordinals[index]}`
        : null;

      return {
        body,
        ctaText: null,
        formatRole: definition.role,
        headline,
        imageDirection:
          "Organized calendar and notebook still life with clear upper space.",
        listItems: selectedListItems,
        slideNumber: index + 1,
        slideType: definition.slideType,
        textMode,
      };
    }),
  };
}
