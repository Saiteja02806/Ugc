import assert from "node:assert/strict";
import test from "node:test";

import type { ReservedCarouselRoleAssetRow } from "../types.js";
import { createCarouselStructure2SlideInserts } from "./carousel-structure-2-persistence.js";
import { buildCarouselStructure2RenderSpecs } from "./carousel-structure-2-render-spec.js";
import { CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS } from "./carousel-structure-2-story-plan.js";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES, type CarouselStructure2FormatId } from "./carousel-structure-2-formats.js";
import { parseCarouselStructure2StoryPlan } from "./carousel-structure-2-story-plan.js";

test("Structure 2 reserves six assets and uses the app screenshot on Slide 6", () => {
  const specs = buildCarouselStructure2RenderSpecs({
    assets: makeAssets(["hook", "human", "static", "human", "static", "product_asset"]),
    storyPlan: makeStoryPlan("wrong_belief"),
  });

  assert.equal(specs.length, 6);
  assert.equal(specs[0]!.visualRole, "hook");
  assert.equal(specs[5]!.visualRole, "product_asset");
  assert.equal(specs[5]!.storyRole, "takeaway_cta");
  assert.equal(specs[5]!.layoutVariant, "story_product_reveal");
  assert.equal(specs[5]!.productVisualEligibility, "preferred");
});

test("Structure 2 accepts a static fallback on Slide 6 but rejects a human there", () => {
  assert.doesNotThrow(() =>
    buildCarouselStructure2RenderSpecs({
      assets: makeAssets(["hook", "human", "static", "human", "static", "static"]),
      storyPlan: makeStoryPlan("wrong_belief"),
    }),
  );
  assert.throws(
    () =>
      buildCarouselStructure2RenderSpecs({
        assets: makeAssets(["hook", "human", "static", "human", "static", "human"]),
        storyPlan: makeStoryPlan("wrong_belief"),
      }),
    /Slide 6 must use the product screenshot.*static visual/i,
  );
});

test("Structure 2 persistence stores all six ordered slides", () => {
  const specs = buildCarouselStructure2RenderSpecs({
    assets: makeAssets(["hook", "human", "static", "human", "static", "product_asset"]),
    storyPlan: makeStoryPlan("wrong_belief"),
  });
  const rows = createCarouselStructure2SlideInserts({
    carouselGenerationId: "00000000-0000-0000-0000-000000000001",
    renderSpecs: specs,
    structureVersion: 1,
  });

  assert.equal(rows.length, 6);
  assert.equal(rows[5]!.story_role, "takeaway_cta");
  assert.equal(rows[5]!.visual_role, "product_asset");
});

function makeStoryPlan(storyFormatId: CarouselStructure2FormatId) {
  const copy = [
    "Why weekly plans collapse by Tuesday",
    "On Monday, one changed priority made me rebuild every task, delay the first decision, and lose the context I had already collected.",
    "I realized the problem was not effort; my plan assumed that ordinary work would never change after I wrote it down.",
    "Todaywise let me work from the changing task list, so I could update the next action without rebuilding the entire week from scratch.",
    "The week still changed, but I stopped treating each shift as a reset and finished the important work with a clearer next decision.",
    "Keep the next decision visible, then try the same approach with one changing priority.",
  ];
  return parseCarouselStructure2StoryPlan(
    {
      slides: Object.fromEntries(
        CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey, index) => [
          positionKey,
          {
            ctaText: index === 5 ? "Try the same approach with one changing priority." : null,
            storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index]!,
            storyText: copy[index]!,
            visualContext: `planning scene ${index + 1}`,
          },
        ]),
      ),
      strategy: { angle: "a weekly plan that could not adapt to real work" },
    },
    {
      businessDescription: "Todaywise is an application for planning work when priorities change.",
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
