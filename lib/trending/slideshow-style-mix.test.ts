import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateTrendingSlideshowStyles,
  allocateTrendingSlideshowStylesForPack,
  buildTrendingSlideshowStructureBatchPlan,
  buildTrendingSlideshowStyleBatchPlan,
  DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
  getCarouselStructureForTrendingSlideshowStyle,
  validateTrendingSlideshowStyleMix,
} from "./slideshow-style-mix.ts";

test("recovery targets the structure owed by open positions instead of restarting the percentage mix", () => {
  assert.deepEqual(
    buildTrendingSlideshowStructureBatchPlan({
      requestedCandidateCount: 25,
      requestedStructureIds: Array.from({ length: 25 }, () => "structure_1"),
    }),
    Array.from({ length: 5 }, () => "structure_1"),
  );
});

test("recovery preserves an existing product-story batch before appending helpful-tip work", () => {
  assert.deepEqual(
    buildTrendingSlideshowStructureBatchPlan({
      existingBatchStructureIds: ["structure_2"],
      requestedCandidateCount: 10,
      requestedStructureIds: Array.from({ length: 5 }, () => "structure_1"),
    }),
    ["structure_2", "structure_1"],
  );
});

test("the default mixer allocates a 50-card Growth pack as 25 helpful tips and 25 product stories", () => {
  assert.deepEqual(
    allocateTrendingSlideshowStyles({
      localDate: "2026-10-14",
      mix: DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
      slideshowCount: 50,
    }),
    { helpful_tips: 25, product_stories_cta: 25 },
  );

  const batches = buildTrendingSlideshowStyleBatchPlan({
    carouselCount: 50,
    localDate: "2026-10-14",
    mix: DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
  });

  assert.equal(batches.length, 10);
  assert.equal(batches.filter((style) => style === "helpful_tips").length, 5);
  assert.equal(
    batches.filter((style) => style === "product_stories_cta").length,
    5,
  );
  assert.equal(
    batches.filter((style) => getCarouselStructureForTrendingSlideshowStyle(style) === "structure_1").length,
    5,
  );
});

test("the default mixer allocates a 20-card Starter pack as ten cards of each style", () => {
  assert.deepEqual(
    allocateTrendingSlideshowStyles({
      localDate: "2026-10-14",
      mix: DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
      slideshowCount: 20,
    }),
    { helpful_tips: 10, product_stories_cta: 10 },
  );
  assert.equal(
    buildTrendingSlideshowStyleBatchPlan({
      carouselCount: 20,
      localDate: "2026-10-14",
      mix: DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
    }).length,
    4,
  );
});

test("the mixer rejects invalid percentages", () => {
  assert.equal(
    validateTrendingSlideshowStyleMix({ helpfulTips: 55, productStoriesCta: 44 }),
    false,
  );
});

test("the UI reports the visible allocation produced by complete writer batches", () => {
  assert.deepEqual(
    allocateTrendingSlideshowStylesForPack({
      carouselCount: 50,
      localDate: "2026-10-14",
      mix: { helpfulTips: 53, productStoriesCta: 47 },
    }),
    { helpful_tips: 25, product_stories_cta: 25 },
  );
  assert.deepEqual(
    allocateTrendingSlideshowStylesForPack({
      carouselCount: 20,
      localDate: "2026-10-14",
      mix: DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX,
    }),
    { helpful_tips: 10, product_stories_cta: 10 },
  );
});
