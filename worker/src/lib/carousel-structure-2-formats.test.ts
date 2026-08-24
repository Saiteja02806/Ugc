import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_STRUCTURE_2_BACKBONE_VERSION,
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY,
  CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  getCarouselStructure2Format,
  isCarouselStructure2FormatId,
  resolveCarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import { CAROUSEL_CONTENT_FORMAT_IDS } from "./carousel-content-grammar.js";

test("defines exactly the eight canonical Structure 2 formats", () => {
  assert.deepEqual(CAROUSEL_STRUCTURE_2_FORMAT_IDS, [
    "wrong_belief",
    "perfect_plan_breaks",
    "stopped_behavior",
    "terrible_at",
    "result_without_sacrifice",
    "identity_transformation",
    "new_rule",
    "wrong_villain",
  ]);
  assert.equal(CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats.length, 8);
  assert.equal(
    new Set(
      CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats.map((format) => format.id),
    ).size,
    8,
  );
  assert.equal(
    CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
    "carousel-structure-2-formats-v2-flexible-flow",
  );
  assert.equal(
    CAROUSEL_STRUCTURE_2_BACKBONE_VERSION,
    "carousel-structure-2-story-reference-v2",
  );
});

test("never imports a Structure 1 informational format id", () => {
  for (const formatId of CAROUSEL_CONTENT_FORMAT_IDS) {
    assert.equal(isCarouselStructure2FormatId(formatId), false);
  }

  assert.equal(isCarouselStructure2FormatId("wrong_belief"), true);
});

test("keeps turns_out as an alias instead of creating a ninth format", () => {
  assert.equal(isCarouselStructure2FormatId("turns_out"), false);
  assert.equal(resolveCarouselStructure2FormatId("turns_out"), "wrong_villain");
  assert.equal(
    getCarouselStructure2Format("wrong_villain").aliases.includes("turns_out"),
    true,
  );
});

test("keeps five-role references while allowing format-specific story flow", () => {
  for (const format of CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats) {
    assert.deepEqual(
      format.slides.map((slide) => slide.storyRole),
      CAROUSEL_STRUCTURE_2_STORY_ROLES,
    );
    assert.deepEqual(
      format.slides.map((slide) => slide.slideNumber),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      format.slides.map((slide) => slide.productMention),
      ["forbidden", "forbidden", "forbidden", "required", "optional"],
    );
    assert.deepEqual(
      format.slides.map((slide) => slide.ctaPolicy),
      ["none", "none", "none", "none", "native_experiment"],
    );
    assert.deepEqual(
      format.slides.map((slide) => [slide.minimumWords, slide.maximumWords]),
      [
        [6, 14],
        [18, 30],
        [18, 30],
        [18, 30],
        [18, 32],
      ],
    );
    assert.ok(format.allowedCtaPositions.length > 0);
    assert.ok(format.exampleFlows.length > 0);

    for (const flow of format.exampleFlows) {
      assert.equal(flow.length, 5);
      assert.deepEqual(
        [...new Set(flow)].sort(),
        [...CAROUSEL_STRUCTURE_2_STORY_ROLES].sort(),
      );
    }
  }
});
