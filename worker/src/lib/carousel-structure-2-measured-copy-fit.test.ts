import assert from "node:assert/strict";
import test from "node:test";
import { getCarouselStructure2MeasuredCopyIssues } from "./carousel-structure-2-measured-copy-fit.js";
import { parseCarouselStructure2StoryPlan, validateCarouselStructure2StoryPlan } from "./carousel-structure-2-story-plan.js";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES } from "./carousel-structure-2-formats.js";

function makePlan() {
  const positions = ["first", "second", "third", "fourth", "fifth", "sixth"];
  return parseCarouselStructure2StoryPlan({ strategy: { angle: "a changing plan" },
    slides: Object.fromEntries(positions.map((position, index) => [position, {
      ctaText: null, storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index], visualContext: "a person planning",
      storyText: index === 0 ? "i kept making plans that fell apart" : "I kept the next task visible while priorities changed.\n\nA clear owner helped me keep moving without starting over.",
      headline: null,
    }])) }, { businessDescription: "Todaywise helps me plan my work.", storyFormatId: "wrong_belief" });
}

test("real font metrics reject a valid word-count body that would overflow its rendering block", async () => {
  const plan = makePlan();
  plan.slides[5]!.storyText = "I used WWWWWWWWWWWWWWWW for planning.\n\nMy next task had an owner and context so I could continue.";
  assert.ok(!validateCarouselStructure2StoryPlan(plan, { businessDescription: "Todaywise helps me plan my work." }).some(issue => issue.slideNumber === 6 && issue.code === "word_count"));
  assert.ok(!validateCarouselStructure2StoryPlan(plan, { businessDescription: "Todaywise helps me plan my work." }).some(issue => issue.slideNumber === 6 && issue.code === "render_fit"),
    "the previous width estimate misses this real glyph overflow");
  const issues = await getCarouselStructure2MeasuredCopyIssues(plan);
  assert.ok(issues.some(issue => issue.slideNumber === 6 && issue.code === "render_fit"));
  plan.slides[5]!.storyText = "Keep your next task visible as priorities change.\n\nA clear owner and context help you continue without starting over.";
  assert.deepEqual(await getCarouselStructure2MeasuredCopyIssues(plan), []);
});

test("measured preflight includes heading and CTA groups without changing older saved paragraph contracts", async () => {
  const plan = makePlan();
  plan.slides[5]!.ctaText = "unbreakable".repeat(200);
  assert.ok((await getCarouselStructure2MeasuredCopyIssues(plan)).some(issue => issue.slideNumber === 6));
  plan.slides[5]!.ctaText = null;
  plan.slides[2]!.headline = "unbreakable".repeat(200);
  assert.ok((await getCarouselStructure2MeasuredCopyIssues(plan)).some(issue => issue.slideNumber === 3));
  delete plan.slides[2]!.headline;
  plan.slides[2]!.storyText = "planning can be overwhelming, but Todaywise simplifies it. embrace flexibility and let your unique perspective shine.";
  assert.deepEqual(await getCarouselStructure2MeasuredCopyIssues(plan), []);
});
