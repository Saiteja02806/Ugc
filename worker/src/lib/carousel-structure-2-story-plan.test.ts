import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2StoryBatchSchema,
  buildCarouselStructure2StoryTextRepairSchema,
  CAROUSEL_STRUCTURE_2_COVER_HOOK_PREFERRED_MAX_CHARACTERS,
  CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS,
  CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS,
  CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS,
  buildCarouselStructure2StoryPlanSchema,
  parseCarouselStructure2StoryBatch,
  parseCarouselStructure2StoryPlan,
  parseCarouselStructure2StoryTextRepair,
  partitionCarouselStructure2ValidationIssues,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2StoryAssignment,
} from "./carousel-structure-2-story-plan.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  type CarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import {
  CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE,
  getCarouselStructure2StoryMaxLines,
} from "./carousel-structure-2-layout.js";

const businessDescription =
  "Todaywise is an application for planning work when priorities change.";

test("Structure 2 rejects template placeholders and unsupported multiplier promises", () => {
  for (const [hook, code] of [["The real reason [topic] feels hard", "hook_template_placeholder"], ["This small switch brings 10x results", "unsupported_claim"]]) {
    const raw = makeRawStoryPlan();
    raw.slides.first!.storyText = hook!;
    const plan = parseCarouselStructure2StoryPlan(raw, { businessDescription, storyFormatId: "wrong_belief" });
    assert.ok(validateCarouselStructure2StoryPlan(plan, { businessDescription }).some(issue => issue.code === code));
  }
});

test("Structure 2 plans exactly the required six-slide product story", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
      businessDescription,
      storyFormatId,
    });

    assert.equal(plan.slides.length, 6);
    assert.deepEqual(
      plan.slides.map((slide) => slide.storyRole),
      CAROUSEL_STRUCTURE_2_STORY_ROLES,
    );
    assert.equal(plan.slides[5]!.ctaText, null);
    assert.deepEqual(
      partitionCarouselStructure2ValidationIssues(
        validateCarouselStructure2StoryPlan(plan, { businessDescription }),
      ).blockingIssues,
      [],
    );
  }
});

test("Structure 2 rejects reordering story roles or placing a CTA on any slide", () => {
  const reordered = makeRawStoryPlan();
  [reordered.slides.second, reordered.slides.third] = [
    reordered.slides.third!,
    reordered.slides.second!,
  ];
  assert.throws(
    () => parseCarouselStructure2StoryPlan(reordered, { businessDescription, storyFormatId: "wrong_belief" }),
    /must use the failure_scene role/i,
  );

  const earlyCta = makeRawStoryPlan();
  Reflect.set(earlyCta.slides.third!, "ctaText", "Try this today.");
  assert.throws(
    () => parseCarouselStructure2StoryPlan(earlyCta, { businessDescription, storyFormatId: "wrong_belief" }),
    /cannot include a CTA/i,
  );

  const finalCta = makeRawStoryPlan();
  Reflect.set(finalCta.slides.sixth!, "ctaText", "Try this today.");
  assert.throws(
    () => parseCarouselStructure2StoryPlan(finalCta, { businessDescription, storyFormatId: "wrong_belief" }),
    /cannot include a CTA/i,
  );
});

test("Structure 2 leaves creative cover wording to the prompt and uses a larger cover treatment", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText = "Does your content plan fall apart when life gets busy?";
  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.equal(CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE, 96);
  assert.equal(getCarouselStructure2StoryMaxLines(1), 3);
  assert.ok(!issues.some((issue) => issue.code === "perspective"));
});

test("Structure 2 keeps five batch plan keys separate from six slide keys", () => {
  const assignments = makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5));
  const schema = buildCarouselStructure2StoryBatchSchema({ assignments });
  const rawBatch = {
    plans: Object.fromEntries(
      CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((positionKey) => [
        positionKey,
        makeRawStoryPlan(),
      ]),
    ),
  };
  const parsed = parseCarouselStructure2StoryBatch(rawBatch, assignments);

  assert.deepEqual(
    Object.keys(schema.properties.plans.properties),
    CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS,
  );
  assert.equal(parsed.size, 5);
  assert.deepEqual([...parsed.keys()], [0, 1, 2, 3, 4]);
  assert.equal(CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.length, 6);
});

test("Structure 2 prompt and schema describe the strict six-slide contract", () => {
  const messages = buildCarouselStructure2BatchMessages({
    assignments: makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5)),
    businessDescription,
  });
  const prompt = messages.map((message) => message.content).join("\n");
  const schema = JSON.stringify(buildCarouselStructure2StoryPlanSchema());

  assert.match(prompt, /exactly six slides/i);
  assert.match(prompt, /only Slide 1 may lead with direct reader wording/i);
  assert.match(prompt, /normally 5-8 words/i);
  assert.match(prompt, /42 characters or fewer/i);
  assert.match(prompt, /aim for 16-22 words/i);
  assert.match(prompt, /natural or sentence case/i);
  assert.match(prompt, /Inter Tight Bold at 700 weight/i);
  assert.match(prompt, /Slides 1-6 must return ctaText: null/i);
  assert.match(prompt, /Slide 4 must explain a real product capability/i);
  assert.doesNotMatch(prompt, /CTA presence and slide position are your creative choice/i);
  assert.match(schema, /sixth/);
  assert.doesNotMatch(schema, /slideNumber|storyFormatId/);
  assert.match(
    schema,
    new RegExp(
      `"maxLength":${CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS}`,
    ),
  );

  const schemaObject = buildCarouselStructure2StoryPlanSchema();
  const firstStoryText = schemaObject.properties.slides.properties.first
    .properties.storyText;
  const secondStoryText = schemaObject.properties.slides.properties.second
    .properties.storyText;
  // gpt-4o-mini ends constrained generation before emitting output when these
  // word-count regexes appear in strict Structured Outputs. Prompt guidance
  // and publishing validation remain the authoritative count contract.
  assert.equal("pattern" in firstStoryText, false);
  assert.equal("pattern" in secondStoryText, false);
});

test("Structure 2 rejects a cover that ends in a lone truncated letter", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText = "Are you overwhelmed by changing audience f";
  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.ok(
    issues.some(
      (issue) => issue.code === "hook_incomplete" && issue.slideNumber === 1,
    ),
  );
});

test("Structure 2 accepts a complete unpunctuated cover at the writing target", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText = "Your next task needs a simple plan quickly";
  assert.equal(raw.slides.first!.storyText.length, 42);
  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.equal(
    issues.some(
      (issue) => issue.code === "hook_incomplete" && issue.slideNumber === 1,
    ),
    false,
  );
});

test("Structure 2 rejects a shorter cover that ends in an unmistakable hanging phrase", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText = "Are you feeling pressured to constantly";
  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.ok(
    issues.some(
      (issue) => issue.code === "hook_incomplete" && issue.slideNumber === 1,
    ),
  );
});

test("Structure 2 rejects a cover hook that cannot safely fit the fixed three-line area", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText =
    "Every delayed approval quietly stalls the next important campaign decision";

  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, {
    businessDescription,
  });

  assert.ok(
    issues.some(
      (issue) => issue.code === "render_fit" && issue.slideNumber === 1,
    ),
  );
});

test("Structure 2 sends writing-quality failures back through the repair path", () => {
  const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  plan.slides[1]!.storyText = "One platform helped me work smarter.";
  const partitioned = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription }),
  );

  assert.ok(partitioned.blockingIssues.some((issue) => issue.code === "generic_copy"));
  assert.ok(partitioned.blockingIssues.some((issue) => issue.code === "word_count"));
});

test("Structure 2 targeted repair accepts replacements for every invalid slide only", () => {
  const schema = buildCarouselStructure2StoryTextRepairSchema([1, 5, 6]);
  const replacements = parseCarouselStructure2StoryTextRepair(
    {
      storyTextBySlide: {
        slide1: "When campaign work keeps shifting",
        slide5:
          "The work still changed, but I kept each campaign decision visible and moved forward without rebuilding the entire plan from scratch.",
        slide6:
          "Keep the next decision visible so changing priorities still have a clear owner, useful context, and one practical step to continue.",
      },
    },
    [1, 5, 6],
  );

  assert.deepEqual(
    Object.keys(schema.properties.storyTextBySlide.properties),
    ["slide1", "slide5", "slide6"],
  );
  assert.equal(
    schema.properties.storyTextBySlide.properties.slide1.maxLength,
    CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS,
  );
  assert.equal(
    schema.properties.storyTextBySlide.properties.slide5.maxLength,
    720,
  );
  assert.equal(replacements.get(1), "When campaign work keeps shifting");
  assert.equal(replacements.get(5)?.startsWith("The work still changed"), true);
  assert.equal(replacements.get(6)?.startsWith("Keep the next decision"), true);
});

test("Structure 2 treats close recent wording as advisory but blocks exact copy", () => {
  const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const history = [
    {
      contentPlanItemId: null,
      formatId: "wrong_belief",
      generationId: "prior-carousel",
      slides: plan.slides.map((slide) => ({
        ctaText: slide.ctaText,
        headline: slide.storyText,
        slideNumber: slide.slideNumber,
        subtext: null,
      })),
      structureId: "structure_2",
    },
  ] as const;

  const exact = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription, recentHistory: history }),
  );
  assert.ok(
    exact.blockingIssues.some((issue) => issue.code === "recent_exact_duplicate"),
  );

  plan.slides[0]!.storyText = "Why weekly plans collapse by Friday";
  const close = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription, recentHistory: history }),
  );
  assert.ok(close.advisoryIssues.some((issue) => issue.code === "recent_repetition"));
  assert.equal(
    close.blockingIssues.some((issue) => issue.code === "recent_exact_duplicate"),
    false,
  );
});

test("hook and story word-count contracts block invalid output", () => {
  const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  plan.slides[0]!.storyText = "Stop losing approvals";
  plan.slides[1]!.storyText = "I changed tasks once.";

  const partitioned = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription }),
  );

  assert.ok(partitioned.blockingIssues.some((issue) => issue.code === "hook_length"));
  assert.ok(
    partitioned.blockingIssues.some(
      (issue) => issue.code === "word_count" && issue.slideNumber === 2,
    ),
  );
  assert.deepEqual(partitioned.advisoryIssues, []);
});

test("Structure 2 accepts a complete fourteen-word body without forcing a longer sentence", () => {
  const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  plan.slides[1]!.storyText =
    "I stopped rebuilding the week whenever one urgent request moved my next decision late.";

  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.equal(
    issues.some(
      (issue) => issue.code === "word_count" && issue.slideNumber === 2,
    ),
    false,
  );
});

test("reference word counts, overflow, and unsupported claims remain blocking", () => {
  const partitioned = partitionCarouselStructure2ValidationIssues([
    { code: "word_count", slideNumber: 4, message: "13 words instead of the required 14" },
    { code: "render_fit", slideNumber: 1, message: "Cover overflows" },
    { code: "unsupported_claim", slideNumber: 5, message: "Unsupported result" },
  ]);
  assert.deepEqual(partitioned.advisoryIssues, []);
  assert.deepEqual(partitioned.blockingIssues.map((issue) => issue.code), ["word_count", "render_fit", "unsupported_claim"]);
});

function makeAssignments(formatIds: readonly CarouselStructure2FormatId[]) {
  return Array.from({ length: 5 }, (_, slotIndex) => ({
    candidateIndex: slotIndex,
    creativeSeed: `Open creative starting point ${slotIndex + 1}`,
    emotion: "quiet frustration",
    slotIndex,
    storyFormatId: formatIds[slotIndex % formatIds.length]!,
  })) satisfies CarouselStructure2StoryAssignment[];
}

function makeRawStoryPlan() {
  const copy = [
    "Why weekly plans collapse by Tuesday",
    "On Monday, one changed priority made me rebuild every task, delay the first decision, and lose the context I had already collected.",
    "I realized the problem was not effort; my plan assumed that ordinary work would never change after I wrote it down.",
    "Todaywise let me work from the changing task list, so I could update the next action without rebuilding the entire week from scratch.",
    "The week still changed, but I stopped treating each shift as a reset and finished the important work with a clearer next decision.",
    "Keep the next decision visible so each changed priority still has one practical next step, clear owner, and relevant context.",
  ];

  return {
    slides: Object.fromEntries(
      CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey, index) => [
        positionKey,
        {
          ctaText: null,
          storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index]!,
          storyText: copy[index]!,
          visualContext: `ordinary planning scene ${index + 1}`,
        },
      ]),
    ),
    strategy: { angle: "a weekly plan that could not adapt to real work" },
  };
}
