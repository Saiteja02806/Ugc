import assert from "node:assert/strict";
import test from "node:test";

import { resolveCarouselImageLibraryCategory } from "./image-library-category.ts";

test("resolves the six role-library categories", () => {
  assert.equal(resolveCarouselImageLibraryCategory({ category: "Gym" }), "gym");
  assert.equal(
    resolveCarouselImageLibraryCategory({
      categorySlug: "fitness-nutrition",
      productSummary: "A calorie and meal tracking app",
    }),
    "food",
  );
  assert.equal(
    resolveCarouselImageLibraryCategory({ category: "Productivity SaaS" }),
    "productivity",
  );
  assert.equal(resolveCarouselImageLibraryCategory({ category: "Dating" }), "dating");
  assert.equal(resolveCarouselImageLibraryCategory({ category: "Travel" }), "travel");
  assert.equal(
    resolveCarouselImageLibraryCategory({ category: "Beauty skincare" }),
    "skin",
  );
});

test("defaults unsupported businesses to the productivity library", () => {
  assert.equal(
    resolveCarouselImageLibraryCategory({ category: "Legal services" }),
    "productivity",
  );
  assert.equal(
    resolveCarouselImageLibraryCategory({ category: "Education consultancy" }),
    "productivity",
  );
});
