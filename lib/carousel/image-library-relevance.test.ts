import assert from "node:assert/strict";
import test from "node:test";

import { buildCarouselSlideImagePlan } from "./image-library-relevance.ts";

function slides(values: Partial<Record<number, string>>) {
  return [1, 2, 3, 4, 5].map((slideNumber) => ({
    slideNumber,
    supportingText: [],
    visibleText: [values[slideNumber] ?? `Primary message ${slideNumber}`],
  }));
}

test("uses food_static for a strongly food-related gym slide", () => {
  const plan = buildCarouselSlideImagePlan({
    carouselId: "gym-protein-example",
    primaryCategory: "gym",
    slides: slides({
      3: "You train every day, but you're barely eating enough protein.",
    }),
  });

  assert.deepEqual(
    plan.map(({ assetRole, categorySlug }) => ({ assetRole, categorySlug })),
    [
      { assetRole: "hook", categorySlug: "gym" },
      { assetRole: "human", categorySlug: "gym" },
      { assetRole: "static", categorySlug: "food" },
      { assetRole: "human", categorySlug: "gym" },
      { assetRole: "static", categorySlug: "gym" },
    ],
  );
  assert.equal(plan[2]?.relevanceLevel, "strong");
  assert.match(plan[2]?.relevanceReason ?? "", /eating/);
  assert.match(plan[2]?.relevanceReason ?? "", /protein/);
});

test("secondary categories are static-only and never replace the primary hook or humans", () => {
  const plan = buildCarouselSlideImagePlan({
    carouselId: "all-food-signals",
    primaryCategory: "gym",
    slides: slides({
      1: "Protein meals for recovery",
      2: "Eat a protein meal before training",
      3: "Plan a nutritious dinner",
      4: "Use simple meal prep",
      5: "Keep a grocery list",
    }),
  });

  assert.equal(plan[0]?.categorySlug, "gym");
  assert.equal(plan[0]?.assetRole, "hook");
  assert.equal(
    plan.filter((slide) => slide.assetRole === "human").every(
      (slide) => slide.categorySlug === "gym",
    ),
    true,
  );
  assert.equal(
    plan.filter((slide) => slide.selectionType === "related").length,
    2,
  );
  assert.equal(
    plan.filter((slide) => slide.selectionType === "related").every(
      (slide) => slide.assetRole === "static" && slide.categorySlug === "food",
    ),
    true,
  );
});

test("uses at most one deterministic light related static when no stronger match exists", () => {
  const plan = buildCarouselSlideImagePlan({
    carouselId: "light-food-signals",
    primaryCategory: "gym",
    slides: slides({
      2: "Protect your energy during a busy morning",
      4: "Make recovery easier to repeat",
    }),
  });

  const related = plan.filter((slide) => slide.selectionType === "related");
  assert.equal(related.length, 1);
  assert.equal(related[0]?.categorySlug, "food");
  assert.equal(related[0]?.assetRole, "static");
  assert.equal(related[0]?.relevanceLevel, "light");
});

test("supports food to gym and travel to food only", () => {
  const foodPlan = buildCarouselSlideImagePlan({
    carouselId: "food-workout",
    primaryCategory: "food",
    slides: slides({ 4: "A strength workout supports the routine" }),
  });
  const travelPlan = buildCarouselSlideImagePlan({
    carouselId: "travel-dining",
    primaryCategory: "travel",
    slides: slides({ 2: "Try the local cuisine before leaving" }),
  });
  const productivityPlan = buildCarouselSlideImagePlan({
    carouselId: "productivity-meal",
    primaryCategory: "productivity",
    slides: slides({ 3: "Plan your meals for the week" }),
  });

  assert.equal(
    foodPlan.some(
      (slide) => slide.categorySlug === "gym" && slide.assetRole === "static",
    ),
    true,
  );
  assert.equal(
    travelPlan.some(
      (slide) => slide.categorySlug === "food" && slide.assetRole === "static",
    ),
    true,
  );
  assert.equal(
    productivityPlan.every(
      (slide) => slide.categorySlug === "productivity",
    ),
    true,
  );
});

test("ignores misleading idioms and validates the five-slide contract", () => {
  const plan = buildCarouselSlideImagePlan({
    carouselId: "idiom-guard",
    primaryCategory: "gym",
    slides: slides({ 3: "Here is some food for thought" }),
  });

  assert.equal(plan.some((slide) => slide.selectionType === "related"), false);
  assert.throws(
    () =>
      buildCarouselSlideImagePlan({
        carouselId: "invalid",
        primaryCategory: "gym",
        slides: slides({}).slice(0, 4),
      }),
    /slide numbers 1 through 5/i,
  );
});
