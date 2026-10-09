import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
  renderCarouselStructure2SlideFromBuffer,
} from "./carousel-structure-2-render-slide.js";
import type { CarouselStructure2RenderSpec } from "./carousel-structure-2-render-spec.js";

test("the dedicated renderer keeps all layouts fixed and inside the safe area", async () => {
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
      storyText: "Why weekly plans collapse by Tuesday",
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
      ctaText: "This legacy CTA must never render as a second text block.",
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
      assert.equal(
        result.diagnostics.storyFontSize,
        spec.slideNumber === 1 ? 84 : 48,
      );
      assert.equal(result.diagnostics.ctaFontSize, spec.ctaText ? 48 : null);
      assert.equal(result.diagnostics.ctaLineCount > 0, Boolean(spec.ctaText));
      assert.equal(
        result.diagnostics.bubbleShapeStrategy,
        spec.slideNumber === 1
          ? "plain-white-text"
          : "plain-white-text-with-outline",
      );
      assert.equal(result.diagnostics.whiteBackgroundGroupCount, 0);
      assert.equal(result.diagnostics.textTreatment, "overlay");
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
    /could not fit/i,
  );
});

test("a legacy hook image replacement renders at its original 72px without weakening new covers", async () => {
  const assetBuffer = await sharp({ create: { width: 1080, height: 1350,
    channels: 3, background: "#47617d" } }).png().toBuffer();
  const spec = makeSpec({
    slideNumber: 1, headline: null, ctaText: null,
    storyText: "stop feeling the pressure to always be 'on'. your well-being matters too.",
    textPosition: "center", visualRole: "hook", coverFontSize: 72,
  });
  const legacy = await renderCarouselStructure2SlideFromBuffer({ assetBuffer, format: "4:5", spec });
  assert.equal(legacy.diagnostics.storyFontSize, 72);
  assert.ok(legacy.diagnostics.storyLineCount <= 4);
  assert.equal(legacy.diagnostics.safeAreaContained, true);
  const current = await renderCarouselStructure2SlideFromBuffer({ assetBuffer, format: "4:5",
    spec: { ...spec, coverFontSize: undefined, storyText: "Why being available keeps draining you" } });
  assert.equal(current.diagnostics.storyFontSize, 84);
});

for (const source of [
  { ratio: "16:9", width: 1600, height: 900 },
  { ratio: "4:5", width: 1080, height: 1350 },
  { ratio: "9:16", width: 900, height: 1600 },
]) {
  for (const format of ["4:5", "1:1"] as const) {
    for (const manualUpload of [false, true]) {
    test(`${manualUpload ? "manual uploads" : "product screenshots"} fill ${format} slides without stretching a ${source.ratio} source`, async () => {
      const assetBuffer = await sharp(Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}">
          <rect width="100%" height="100%" fill="#2867ef"/>
          <rect width="50%" height="50%" fill="#f2b63d"/>
          <rect x="50%" y="50%" width="50%" height="50%" fill="#24c981"/>
        </svg>`,
      )).png().toBuffer();
      const result = await renderCarouselStructure2SlideFromBuffer({
        assetBuffer,
        format,
        spec: makeSpec({
          ctaText: null,
          headline: null,
          backgroundCrop: manualUpload ? "centre" : undefined,
          layoutVariant: manualUpload ? "story_overlay_only" : "story_product_reveal",
          productVisualEligibility: manualUpload ? "forbidden" : "preferred",
          slideNumber: 5,
          storyText: "See your app clearly",
          visualRole: manualUpload ? "human" : "product_asset",
        }),
      });
      const height = format === "4:5" ? 1350 : 1080;
      const actual = await sharp(result.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const expected = await sharp(assetBuffer).rotate()
        .resize(1080, height, { fit: "cover", position: "centre" })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(actual.info.width, 1080);
      assert.equal(actual.info.height, height);
      // Sample the uncovered slide perimeter against a proportional centre crop.
      // The old padded foreground over a blurred, dimmed duplicate fails here.
      for (const x of [24, 270, 810, 1056]) {
        for (const y of [24, height - 24]) {
          for (let channel = 0; channel < 3; channel += 1) {
            const actualValue = actual.data[(y * 1080 + x) * actual.info.channels + channel]!;
            const expectedValue = expected.data[(y * 1080 + x) * expected.info.channels + channel]!;
            assert.ok(Math.abs(actualValue - expectedValue) <= 15,
              `Screenshot must reach (${x}, ${y}) in its original colours without blurred margins`);
          }
        }
      }
      assert.equal(result.diagnostics.safeAreaContained, true);
    });
    }
  }
}

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
