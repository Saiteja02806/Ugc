import assert from "node:assert/strict";
import test from "node:test";

import { buildCarouselSlideImagePlan } from "./carousel-image-library-relevance.js";

function createSlides(values: Partial<Record<number, string>>) {
  return [1, 2, 3, 4, 5, 6].map((slideNumber) => ({
    slideNumber,
    supportingText: [],
    visibleText: [values[slideNumber] ?? `Primary message ${slideNumber}`],
  }));
}

test("worker routes a protein gym slide to food_static deterministically", () => {
  const input = {
    carouselId: "worker-gym-protein",
    primaryCategory: "gym" as const,
    slides: createSlides({
      3: "You train every day, but you're barely eating enough protein.",
    }),
  };
  const first = buildCarouselSlideImagePlan(input);
  const retry = buildCarouselSlideImagePlan(input);

  assert.deepEqual(retry, first);
  assert.equal(first[0]?.assetRole, "hook");
  assert.equal(first[0]?.categorySlug, "gym");
  assert.equal(first[2]?.assetRole, "static");
  assert.equal(first[2]?.categorySlug, "food");
  assert.equal(first[2]?.relevanceLevel, "strong");
  assert.equal(
    first.filter((slide) => slide.selectionType === "related").every(
      (slide) => slide.assetRole === "static",
    ),
    true,
  );
});

test("worker uses no probabilistic light exploration", () => {
  const plan = buildCarouselSlideImagePlan({
    carouselId: "worker-light-related",
    primaryCategory: "gym",
    slides: createSlides({
      2: "Protect your energy through the morning",
      4: "Keep recovery easy to repeat",
    }),
  });

  assert.equal(
    plan.filter((slide) => slide.relevanceLevel === "light").length,
    1,
  );
});
