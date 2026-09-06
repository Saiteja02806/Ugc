import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_STRUCTURE_2_BACKBONE_VERSION,
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY,
  CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  getCarouselStructure2Format,
  resolveCarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";

test("Structure 2 exposes eight formats with one strict six-slide runtime backbone", () => {
  assert.equal(CAROUSEL_STRUCTURE_2_FORMAT_IDS.length, 8);
  assert.equal(CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats.length, 8);
  assert.equal(CAROUSEL_STRUCTURE_2_FORMATS_VERSION, "carousel-structure-2-formats-v5-six-slide-story-runtime");
  assert.equal(CAROUSEL_STRUCTURE_2_BACKBONE_VERSION, "carousel-structure-2-strict-six-slide-product-story-v1");

  for (const format of CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats) {
    assert.deepEqual(
      format.slides.map((slide) => slide.storyRole),
      CAROUSEL_STRUCTURE_2_STORY_ROLES,
    );
    assert.deepEqual(format.slides.map((slide) => slide.slideNumber), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(
      format.slides.map((slide) => slide.ctaPolicy),
      ["none", "none", "none", "none", "none", "native_experiment"],
    );
    assert.deepEqual(format.exampleFlows, [CAROUSEL_STRUCTURE_2_STORY_ROLES]);
  }
});

test("Structure 2 preserves the turns_out alias", () => {
  assert.equal(resolveCarouselStructure2FormatId("turns_out"), "wrong_villain");
  assert.equal(getCarouselStructure2Format("wrong_villain").aliases.includes("turns_out"), true);
});
