import assert from "node:assert/strict";
import test from "node:test";

import type { ReservedCarouselRoleAssetRow } from "../types.js";
import { createCarouselStructure2SlideInserts } from "./carousel-structure-2-persistence.js";
import {
  buildCarouselStructure2RenderSpecs,
  CAROUSEL_STRUCTURE_2_LAYOUT_VARIANTS,
} from "./carousel-structure-2-render-spec.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  type CarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import {
  CAROUSEL_STRUCTURE_2_POSITION_KEYS,
  parseCarouselStructure2StoryPlan,
} from "./carousel-structure-2-story-plan.js";

test("all eight Structure 2 formats resolve the same isolated three-layout contract", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const specs = makeSpecs(storyFormatId);

    assert.equal(specs.length, 5);
    assert.deepEqual(
      new Set(specs.map((spec) => spec.layoutVariant)),
      new Set(CAROUSEL_STRUCTURE_2_LAYOUT_VARIANTS),
    );
    assert.equal(specs[0]!.layoutVariant, "story_pill_overlay");
    assert.equal(specs[0]!.visualRole, "hook");
    assert.equal(specs[4]!.layoutVariant, "story_product_reveal");
    assert.equal(specs[4]!.visualRole, "product_asset");
    assert.equal(specs[4]!.productVisualEligibility, "allowed");
    assert.ok(specs.every((spec) => spec.storyFormatId === storyFormatId));
  }
});

test("the flexible story renderer accepts a product asset wherever reservation places it", () => {
  const storyPlan = makeStoryPlan("wrong_belief");
  const assets = makeAssets(["hook", "product_asset", "human", "static", "human"]);

  const specs = buildCarouselStructure2RenderSpecs({ assets, storyPlan });
  assert.equal(specs[1]!.layoutVariant, "story_product_reveal");
});

test("the persistence adapter stores Structure 2 identity without borrowing Structure 1 fields", () => {
  const specs = makeSpecs("wrong_belief");
  const rows = createCarouselStructure2SlideInserts({
    carouselGenerationId: "00000000-0000-0000-0000-000000000001",
    renderedSlides: specs.map((spec) => ({
      renderedS3Key: `carousel/slide-${spec.slideNumber}.webp`,
      renderedUrl: `https://example.test/slide-${spec.slideNumber}.webp`,
      slideNumber: spec.slideNumber,
    })),
    renderSpecs: specs,
    structureVersion: 1,
  });

  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.structure_id === "structure_2"));
  assert.ok(rows.every((row) => row.story_format_id === "wrong_belief"));
  assert.deepEqual(
    rows.map((row) => row.headline),
    specs.map((spec) => spec.storyText),
  );
  assert.deepEqual(
    rows.map((row) => row.story_layout_variant),
    specs.map((spec) => spec.layoutVariant),
  );
  assert.equal(rows[0]!.subtext, null);
  assert.equal(rows[4]!.visual_role, "product_asset");
  assert.equal(rows[4]!.status, "ready");
});

function makeSpecs(storyFormatId: CarouselStructure2FormatId) {
  return buildCarouselStructure2RenderSpecs({
    assets: makeAssets(["hook", "human", "static", "human", "product_asset"]),
    storyPlan: makeStoryPlan(storyFormatId),
  });
}

function makeStoryPlan(storyFormatId: CarouselStructure2FormatId) {
  const slideValues = [
    { storyRole: "recognition", storyText: "i'd plan the perfect week every sunday night", visualContext: "a weekly plan" },
    { storyRole: "failure_scene", storyText: "i mapped every task before monday, then one changing priority made me rebuild the schedule and second guess each choice.", visualContext: "a changing task list" },
    { storyRole: "reframe", storyText: "i realized the plan needed flexibility instead of another complete rebuild whenever normal work changed during the week.", visualContext: "a flexible weekly plan" },
    { storyRole: "product_turning_point", storyText: "then i tried Todaywise; it helped me work from the changing task list without rebuilding everything.", visualContext: "Todaywise with a task list" },
    { storyRole: "proof_reflection_cta", storyText: "i'm still adjusting, but important work now feels easier to finish on ordinary days.", visualContext: "one clearer next task" },
  ];
  const slides = Object.fromEntries(
    CAROUSEL_STRUCTURE_2_POSITION_KEYS.map((positionKey, index) => [
      positionKey,
      {
        ...slideValues[index],
        ctaText:
          index === 4
            ? "if your priorities keep changing, test a smaller planning change."
            : null,
      },
    ]),
  );

  return parseCarouselStructure2StoryPlan(
    {
      slides,
      strategy: {
        angle: "a rigid weekly plan that could not adapt to real work",
      },
    },
    {
      businessDescription: "Todaywise is a productivity planning application.",
      storyFormatId,
    },
  );
}

function makeAssets(
  roles: ReservedCarouselRoleAssetRow["asset_role"][],
): ReservedCarouselRoleAssetRow[] {
  return roles.map((assetRole, index) => ({
    asset_id: `00000000-0000-0000-0000-00000000000${index + 1}`,
    asset_role: assetRole,
    base_s3_key: `carousel/${assetRole}-${index + 1}.webp`,
    base_url: `https://example.test/${assetRole}-${index + 1}.webp`,
    category_slug: "productivity",
    cycle_number: 1,
    library_asset_id: `productivity_${assetRole}_${index + 1}`,
    slide_number: index + 1,
    source_file_sha256: `${index + 1}`.repeat(64),
  }));
}
