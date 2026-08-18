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
import { buildDeterministicCarouselStructure2StoryPlan } from "./carousel-structure-2-story-plan.js";

const analysis = {
  businessName: "Todaywise",
  category: "productivity",
  differentiators: ["prioritizes tasks around changing constraints"],
  mainProblem: "constant task reprioritization",
  mainPromise: "finish important work with fewer repeated decisions",
  painPoints: ["rebuilding the task list whenever priorities change"],
  productSummary: "Todaywise prioritizes a changing task list",
  targetAudience: ["busy professionals"],
  valueProps: ["automatic task prioritization"],
};

test("all eight Structure 2 formats resolve the same isolated three-layout contract", () => {
  for (const [candidateIndex, storyFormatId] of
    CAROUSEL_STRUCTURE_2_FORMAT_IDS.entries()) {
    const specs = makeSpecs(storyFormatId, candidateIndex);

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

test("the render adapter rejects a product asset before the story permits it", () => {
  const storyPlan = buildDeterministicCarouselStructure2StoryPlan({
    analysis,
    assignment: { candidateIndex: 0, slotIndex: 0, storyFormatId: "wrong_belief" },
  });
  const assets = makeAssets(["hook", "product_asset", "human", "static", "human"]);

  assert.throws(
    () => buildCarouselStructure2RenderSpecs({ assets, storyPlan }),
    /product assets are not eligible for slide 2/i,
  );
});

test("the persistence adapter stores Structure 2 identity without borrowing Structure 1 fields", () => {
  const specs = makeSpecs("wrong_belief", 0);
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

function makeSpecs(storyFormatId: CarouselStructure2FormatId, candidateIndex: number) {
  return buildCarouselStructure2RenderSpecs({
    assets: makeAssets(["hook", "human", "static", "human", "product_asset"]),
    storyPlan: buildDeterministicCarouselStructure2StoryPlan({
      analysis,
      assignment: { candidateIndex, slotIndex: candidateIndex % 5, storyFormatId },
    }),
  });
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
