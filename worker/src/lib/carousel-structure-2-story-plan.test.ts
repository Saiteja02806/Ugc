import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselStructure2StoryPlanBatch,
  CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
} from "./carousel-structure-2-planner.js";
import {
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  buildCarouselStructure2StoryBusinessContext,
  buildDeterministicCarouselStructure2StoryPlan,
  parseCarouselStructure2StoryPlan,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2StoryAssignment,
  type CarouselStructure2StoryPlan,
} from "./carousel-structure-2-story-plan.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  getCarouselStructure2Format,
} from "./carousel-structure-2-formats.js";

const analysis = {
  brandTone: "conversational and grounded",
  businessModel: "b2c" as const,
  businessName: "Todaywise",
  campaignPurposes: ["product_discovery" as const],
  carouselAngles: ["make changing priorities easier to handle"],
  category: "productivity planning",
  claimsToAvoid: ["guaranteed results"],
  ctaIdeas: ["see what matters first"],
  differentiators: ["prioritizes tasks around changing constraints"],
  mainProblem: "constant task reprioritization",
  mainPromise: "finish important work with fewer repeated decisions",
  painPoints: [
    "rebuilding the task list whenever priorities change",
    "checking the list throughout the day",
  ],
  productSummary: "Todaywise prioritizes a changing task list",
  targetAudience: ["busy professionals", "independent founders"],
  valueProps: ["automatic task prioritization", "a clearer next step"],
  visualKeywords: ["task list", "weekly planning"],
};

test("the dedicated prompt locks Structure 2 and never requests Structure 1 grammar", () => {
  const assignments = makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5));
  const messages = buildCarouselStructure2BatchMessages({
    analysis,
    assignments,
    recentHistory: [
      {
        centralProblem: "checking the same task list all day",
        storyFormatId: "wrong_belief",
        summary: "A repeated task-list checking story.",
      },
    ],
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /not the informational Structure 1 writer/i);
  assert.match(prompt, /Slide 1 recognition/i);
  assert.match(prompt, /Slides 1-3 must not introduce or name the business/i);
  assert.match(prompt, /Slide 4 must name the saved business/i);
  assert.match(prompt, /Recent compact Structure 2 history only/i);
  assert.doesNotMatch(prompt, /hookFamilyId|checklist|question_list/);
});

test("all eight deterministic story formats satisfy the locked five-slide validator", () => {
  for (const [candidateIndex, storyFormatId] of
    CAROUSEL_STRUCTURE_2_FORMAT_IDS.entries()) {
    const plan = buildDeterministicCarouselStructure2StoryPlan({
      analysis,
      assignment: {
        candidateIndex,
        slotIndex: candidateIndex % 5,
        storyFormatId,
      },
    });
    const format = getCarouselStructure2Format(storyFormatId);
    const issues = validateCarouselStructure2StoryPlan(plan, { analysis });

    assert.deepEqual(issues, [], storyFormatId);
    assert.equal(plan.slides.length, 5);
    assert.deepEqual(
      plan.slides.map((slide) => slide.storyRole),
      format.slides.map((slide) => slide.storyRole),
    );
    assert.deepEqual(
      plan.slides.map((slide) => slide.productVisualEligibility),
      ["forbidden", "forbidden", "forbidden", "preferred", "allowed"],
    );
    assert.equal(plan.historySummary.storyFormatId, storyFormatId);

    for (const [index, slide] of plan.slides.entries()) {
      const words = countWords(
        [slide.storyText, slide.ctaText].filter(Boolean).join(" "),
      );
      assert.ok(words >= format.slides[index]!.minimumWords, storyFormatId);
      assert.ok(words <= format.slides[index]!.maximumWords, storyFormatId);
    }
  }
});

test("the deterministic safety path remains valid for sparse saved context", () => {
  const sparseAnalysis = {
    businessName: "Plainly",
    mainProblem: "unclear daily priorities",
    mainPromise: "a clearer daily plan",
    productSummary: "Plainly helps organize daily work",
  };

  for (const [candidateIndex, storyFormatId] of
    CAROUSEL_STRUCTURE_2_FORMAT_IDS.entries()) {
    const plan = buildDeterministicCarouselStructure2StoryPlan({
      analysis: sparseAnalysis,
      assignment: {
        candidateIndex,
        slotIndex: candidateIndex % 5,
        storyFormatId,
      },
    });

    assert.deepEqual(
      validateCarouselStructure2StoryPlan(plan, {
        analysis: sparseAnalysis,
      }),
      [],
      storyFormatId,
    );
  }
});

test("the parser rejects a borrowed or changed format id", () => {
  const plan = buildDeterministicCarouselStructure2StoryPlan({
    analysis,
    assignment: {
      candidateIndex: 0,
      slotIndex: 0,
      storyFormatId: "wrong_belief",
    },
  });
  const raw = toRawPlan(plan);
  raw.strategy.storyFormatId = "checklist";

  assert.throws(
    () =>
      parseCarouselStructure2StoryPlan(raw, {
        analysis,
        storyFormatId: "wrong_belief",
      }),
    /must remain wrong_belief/i,
  );
});

test("validation rejects early product naming, second-person setup, and a missing Slide 4 action", () => {
  const plan = clonePlan(
    buildDeterministicCarouselStructure2StoryPlan({
      analysis,
      assignment: {
        candidateIndex: 0,
        slotIndex: 0,
        storyFormatId: "wrong_belief",
      },
    }),
  );
  plan.slides[0]!.storyText =
    "i thought Todaywise would fix every priority before i even started";
  plan.slides[1]!.storyText =
    "you kept checking the list whenever priorities changed, and the repeated decisions left the whole working day feeling unsettled.";
  plan.slides[3]!.storyText =
    "then i tried Todaywise; the product was revolutionary and everything in my routine felt completely transformed by the end.";

  const issues = validateCarouselStructure2StoryPlan(plan, { analysis });

  assert.ok(
    issues.some(
      (issue) => issue.code === "product_timing" && issue.slideNumber === 1,
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.code === "perspective" && issue.slideNumber === 2,
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.code === "product_timing" && issue.slideNumber === 4,
    ),
  );
  assert.ok(issues.some((issue) => issue.code === "generic_copy"));
  assert.ok(issues.some((issue) => issue.code === "unsupported_claim"));
});

test("validation rejects a generic CTA that does not mirror the story", () => {
  const plan = clonePlan(
    buildDeterministicCarouselStructure2StoryPlan({
      analysis,
      assignment: {
        candidateIndex: 1,
        slotIndex: 1,
        storyFormatId: "perfect_plan_breaks",
      },
    }),
  );
  plan.slides[4]!.ctaText = "download now and unlock efficiency";

  const issues = validateCarouselStructure2StoryPlan(plan, { analysis });

  assert.ok(issues.some((issue) => issue.code === "cta_mismatch"));
  assert.ok(issues.some((issue) => issue.code === "generic_copy"));
});

test("recent-history validation uses only compact Structure 2 fingerprints", () => {
  const plan = buildDeterministicCarouselStructure2StoryPlan({
    analysis,
    assignment: {
      candidateIndex: 2,
      slotIndex: 2,
      storyFormatId: "stopped_behavior",
    },
  });
  const issues = validateCarouselStructure2StoryPlan(plan, {
    analysis,
    recentHistory: [{ ...plan.historySummary }],
  });

  assert.ok(issues.some((issue) => issue.code === "recent_repetition"));
  assert.deepEqual(Object.keys(plan.historySummary).sort(), [
    "centralProblem",
    "ctaAngle",
    "hookIdea",
    "productMechanism",
    "storyAngle",
    "storyFormatId",
    "summary",
  ]);
});

test("repair instructions preserve the selected format and include history for every failure", () => {
  const assignment: CarouselStructure2StoryAssignment = {
    candidateIndex: 0,
    slotIndex: 0,
    storyFormatId: "wrong_villain",
  };
  const messages = buildCarouselStructure2RepairMessages({
    analysis,
    assignment,
    issues: [
      {
        code: "word_count",
        message: "too short",
        slideNumber: 2,
      },
    ],
    rawPlan: {},
    recentHistory: [
      {
        centralProblem: "constant reprioritization",
        storyFormatId: "wrong_belief",
      },
    ],
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /storyFormatId wrong_villain/i);
  assert.match(prompt, /Recent compact Structure 2 history only/i);
  assert.match(prompt, /constant reprioritization/i);
  assert.match(prompt, /Never use Structure 1 formats/i);
});

test("deterministic batch mode returns five retry-safe validated plans", async () => {
  const previousMode = process.env.CAROUSEL_STRUCTURE_2_PLANNER_MODE;
  process.env.CAROUSEL_STRUCTURE_2_PLANNER_MODE = "deterministic";

  try {
    const assignments = makeAssignments(
      CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5),
    );
    const results = await buildCarouselStructure2StoryPlanBatch({
      analysis,
      assignments,
    });

    assert.equal(results.length, 5);
    assert.deepEqual(
      results.map((result) => result.slotIndex),
      [0, 1, 2, 3, 4],
    );
    assert.ok(
      results.every(
        (result) =>
          result.source === "deterministic-fallback" &&
          result.validationResult.ok &&
          result.validationResult.fallbackUsed &&
          result.plannerVersion === CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
      ),
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.CAROUSEL_STRUCTURE_2_PLANNER_MODE;
    } else {
      process.env.CAROUSEL_STRUCTURE_2_PLANNER_MODE = previousMode;
    }
  }
});

test("controlled business context exposes saved product mechanisms without another profile", () => {
  const context = buildCarouselStructure2StoryBusinessContext(analysis);

  assert.deepEqual(context.productMechanisms, [
    "prioritizes tasks around changing constraints",
    "automatic task prioritization",
    "a clearer next step",
    "Todaywise prioritizes a changing task list",
    "finish important work with fewer repeated decisions",
  ]);
  assert.equal(context.brand.businessName, "Todaywise");
});

function makeAssignments(
  formatIds: readonly (typeof CAROUSEL_STRUCTURE_2_FORMAT_IDS)[number][],
) {
  return formatIds.map((storyFormatId, slotIndex) => ({
    candidateIndex: slotIndex,
    slotIndex,
    storyFormatId,
  }));
}

function toRawPlan(plan: CarouselStructure2StoryPlan) {
  return {
    slides: plan.slides.map((slide) => ({
      ctaText: slide.ctaText,
      slideNumber: slide.slideNumber,
      storyRole: slide.storyRole,
      storyText: slide.storyText,
      visualContext: slide.visualContext,
    })),
    strategy: {
      angle: plan.strategy.angle,
      audienceId: plan.strategy.audienceId,
      centralProblem: plan.strategy.centralProblem,
      ctaAngle: plan.strategy.ctaAngle,
      customerGoalId: plan.strategy.customerGoalId,
      problemId: plan.strategy.problemId,
      productMechanism: plan.strategy.productMechanism,
      reframe: plan.strategy.reframe,
      storyFormatId: plan.strategy.storyFormatId as string,
      topicId: plan.strategy.topicId,
      visibleBehavior: plan.strategy.visibleBehavior,
    },
  };
}

function clonePlan(plan: CarouselStructure2StoryPlan) {
  return structuredClone(plan);
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
