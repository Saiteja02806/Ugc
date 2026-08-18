import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
  renderCarouselStructure2SlideFromBuffer,
} from "./carousel-structure-2-render-slide.js";
import type { CarouselStructure2RenderSpec } from "./carousel-structure-2-render-spec.js";

test("the dedicated renderer produces all three native layouts inside the safe area", async () => {
  const background = await sharp({
    create: {
      background: { alpha: 1, b: 90, g: 130, r: 170 },
      channels: 4,
      height: 1600,
      width: 1200,
    },
  })
    .png()
    .toBuffer();
  const specs = [
    makeSpec({
      layoutVariant: "story_pill_overlay",
      slideNumber: 1,
      textPosition: "center",
      textTreatment: "pill",
      visualRole: "hook",
    }),
    makeSpec({
      layoutVariant: "story_overlay_only",
      slideNumber: 3,
      textPosition: "upper",
      textTreatment: "outlined_overlay",
      visualRole: "static",
    }),
    makeSpec({
      ctaText: "Try your own list and see what it prioritizes first.",
      layoutVariant: "story_product_reveal",
      slideNumber: 5,
      textPosition: "upper",
      textTreatment: "overlay",
      visualRole: "product_asset",
    }),
  ];

  for (const format of ["1:1", "4:5"] as const) {
    for (const spec of specs) {
      const result = await renderCarouselStructure2SlideFromBuffer({
        assetBuffer: background,
        format,
        spec,
      });
      const metadata = await sharp(result.buffer).metadata();

      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, format === "1:1" ? 1080 : 1350);
      assert.equal(result.diagnostics.safeAreaContained, true);
      assert.equal(
        result.diagnostics.rendererVersion,
        CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
      );
      assert.equal(result.diagnostics.layoutVariant, spec.layoutVariant);
      assert.ok(result.diagnostics.storyFontSize >= 40);
    }
  }
});

test("the renderer rejects story copy that cannot fit without unsafe shrinking", async () => {
  const background = await sharp({
    create: {
      background: "#456789",
      channels: 3,
      height: 1080,
      width: 1080,
    },
  })
    .png()
    .toBuffer();
  const spec = makeSpec({
    layoutVariant: "story_overlay_only",
    slideNumber: 2,
    storyText: "unbreakable".repeat(200),
    textPosition: "lower",
    textTreatment: "overlay",
    visualRole: "human",
  });

  await assert.rejects(
    () =>
      renderCarouselStructure2SlideFromBuffer({
        assetBuffer: background,
        format: "4:5",
        spec,
      }),
    /unrenderable word/i,
  );
});

function makeSpec(
  overrides: Partial<CarouselStructure2RenderSpec>,
): CarouselStructure2RenderSpec {
  return {
    assetId: "00000000-0000-0000-0000-000000000001",
    assetUrl: "https://example.test/image.webp",
    ctaText: null,
    layoutVariant: "story_overlay_only",
    productVisualEligibility: "forbidden",
    slideNumber: 2,
    storyFormatId: "wrong_belief",
    storyRole: "failure_scene",
    storyText:
      "i kept rebuilding the same task list whenever priorities changed, then checked it again before every small decision.",
    textPosition: "lower",
    textTreatment: "overlay",
    visualContext: "a person checking a changing plan",
    visualRole: "human",
    ...overrides,
  };
}
