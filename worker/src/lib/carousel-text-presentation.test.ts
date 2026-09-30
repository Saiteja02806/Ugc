import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { getCarouselBodyBlocks, hasCarouselSemanticHeading, normalizeCarouselText } from "./carousel-text-presentation.js";
import { inspectCarouselSlideLayout } from "./carousel-render-slide.js";
import { inspectCarouselStructure2SlideLayout, renderCarouselStructure2SlideFromBuffer } from "./carousel-structure-2-render-slide.js";
import type { CarouselStructure2RenderSpec } from "./carousel-structure-2-render-spec.js";
import { createCarouselStructure2SlideInserts } from "./carousel-structure-2-persistence.js";
import { buildCarouselStructure2StoryPlanSchema, parseCarouselStructure2StoryPlan, validateCarouselStructure2StoryPlan } from "./carousel-structure-2-story-plan.js";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES, type CarouselStructure2StoryRole } from "./carousel-structure-2-formats.js";

const body = "i used to wait until i felt ready\n\nnow i show up for ten minutes every morning";
function spec(overrides: Partial<CarouselStructure2RenderSpec> = {}): CarouselStructure2RenderSpec {
  return { assetId: "asset-1", assetUrl: "https://example.test/photo.jpg", ctaText: null, headline: "i stopped waiting for motivation", layoutVariant: "story_overlay_only", productVisualEligibility: "forbidden", slideNumber: 2, storyFormatId: "wrong_belief", storyRole: "failure_scene", storyText: body, textPosition: "center", textTreatment: "overlay", visualContext: "existing scene", visualRole: "human", ...overrides };
}

test("normalization preserves intentional lines and separate body thoughts", () => {
  assert.equal(normalizeCarouselText("  first  line\r\nnext line\r\n\r\nsecond thought "), "first line\nnext line\n\nsecond thought");
  assert.deepEqual(getCarouselBodyBlocks(body), ["i used to wait until i felt ready", "now i show up for ten minutes every morning"]);
});

test("editor heading metadata distinguishes legacy transport text from a real heading", () => {
  assert.equal(hasCarouselSemanticHeading({ slides: [{ slideNumber: 2, headline: null, textMode: "body_only" }] }, 2, "structure_1", false), false);
  assert.equal(hasCarouselSemanticHeading({ slides: [{ slideNumber: 2, storyText: body }] }, 2, "structure_2", false), false);
  assert.equal(hasCarouselSemanticHeading({ slides: [{ slideNumber: 2, headline: "real heading" }] }, 2, "structure_2", true), true);
});

test("new strict story output keeps optional heading, authored body breaks and final CTA", () => {
  const texts = [
    "why my weekly plan kept falling apart",
    "i mapped out every task before starting my week\n\none changed priority made me rebuild the whole list",
    "i thought being organized meant planning everything in advance\n\nthe rigid plan was making ordinary changes harder",
    "Todaywise let me adjust the next task in my plan\n\ni could respond without rebuilding my whole week",
    "my schedule still changed when something unexpected came up\n\nbut i stopped treating each shift as a reset",
    "i keep the next decision visible beside its context\n\nthat gives each changed priority a practical next step",
  ];
  const keys = ["first", "second", "third", "fourth", "fifth", "sixth"];
  const raw = { strategy: { angle: "a plan that responds to ordinary changes" }, slides: Object.fromEntries(keys.map((key, index) => [key, {
    headline: index === 0 || index === 2 ? null : "i changed how i planned",
    storyText: texts[index], storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index],
    ctaText: index === 5 ? "try one small step today" : null, visualContext: "existing reserved scene",
  }])) };
  const plan = parseCarouselStructure2StoryPlan(raw, { storyFormatId: "wrong_belief", businessDescription: "Todaywise is an application for planning work when priorities change." });
  assert.equal(plan.slides[1]!.storyText, texts[1]);
  assert.equal(plan.slides[2]!.headline, null);
  assert.equal(plan.slides[5]!.ctaText, "try one small step today");
  assert.ok(buildCarouselStructure2StoryPlanSchema().properties.slides.properties.second.required.includes("headline"));
  assert.deepEqual(validateCarouselStructure2StoryPlan(plan), []);
});

test("both slideshow sizes and structures render heading-only pills, two body blocks and plain CTA", async () => {
  for (const format of ["1:1", "4:5"] as const) {
    const first = await inspectCarouselSlideLayout({ format, slide: { body, ctaText: "try one small step today", headline: "i stopped waiting for motivation", imageDirection: "existing still life", layoutPreset: "middle-statement", listItems: [], slideNumber: 6, slideType: "cta", subtext: body, textMode: "headline_body", textPosition: "center" } });
    const second = await inspectCarouselStructure2SlideLayout({ format, spec: spec({ slideNumber: 6, storyRole: "takeaway_cta", ctaText: "try one small step today" }) });
    for (const layout of [first, second]) {
      assert.equal(layout.whiteBackgroundGroupCount, 1);
      assert.equal(layout.bodyBlockCount, 2);
      assert.ok(layout.bodyBlockLineCounts!.every((count) => count <= 3));
      assert.ok(layout.ctaLineCount! > 0);
    }
    assert.equal(second.safeAreaContained, true);
  }
});

test("Structure 2 does not infer a pill from an old story or a body-only slide", async () => {
  for (const headline of [undefined, null]) {
    const layout = await inspectCarouselStructure2SlideLayout({ format: "4:5", spec: spec({ headline }) });
    assert.equal(layout.whiteBackgroundGroupCount, 0);
    assert.equal(layout.bodyBlockCount, 2);
  }
  const cover = await inspectCarouselStructure2SlideLayout({ format: "4:5", spec: spec({ slideNumber: 1, headline: null, storyText: "five shifts that made learning feel easier" }) });
  assert.equal(cover.whiteBackgroundGroupCount, 0);
  assert.equal(cover.storyFontSize, 72);
});

test("overflow and orphan lines fail explicitly instead of shrinking or flattening", async () => {
  for (const storyText of ["a meaningful first line\nand\na meaningful third line", "first thought\n\nsecond thought\n\nthird thought", "extraordinarily".repeat(100)]) {
    await assert.rejects(() => inspectCarouselStructure2SlideLayout({ format: "1:1", spec: spec({ storyText }) }));
  }
});

test("new Structure 2 headings and bodies round-trip without changing asset assignments", () => {
  const specs = Array.from({ length: 6 }, (_, index) => spec({ slideNumber: index + 1, storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index] as CarouselStructure2StoryRole, headline: index === 0 ? null : index === 2 ? null : "a real optional heading", storyText: index === 0 ? "five shifts that made learning feel easier" : body }));
  const rows = createCarouselStructure2SlideInserts({ carouselGenerationId: "generation", renderSpecs: specs, structureVersion: 1 });
  assert.equal(rows[0]!.headline, specs[0]!.storyText);
  assert.equal(rows[0]!.subtext, null);
  assert.equal(rows[1]!.headline, "a real optional heading");
  assert.equal(rows[1]!.subtext, body);
  assert.equal(rows[2]!.headline, "");
  assert.equal(rows[2]!.subtext, body);
  assert.ok(rows.every((row) => row.category_image_asset_id === "asset-1"));
});

test("the screenshot composition remains contained and both output dimensions stay unchanged", async () => {
  const source = await sharp({ create: { width: 500, height: 900, channels: 3, background: "#48764c" } }).png().toBuffer();
  for (const format of ["1:1", "4:5"] as const) {
    const result = await renderCarouselStructure2SlideFromBuffer({ assetBuffer: source, format, spec: spec({ slideNumber: 6, storyRole: "takeaway_cta", layoutVariant: "story_product_reveal", visualRole: "product_asset", productVisualEligibility: "preferred", ctaText: "try one small step today" }) });
    const metadata = await sharp(result.buffer).metadata();
    assert.equal(metadata.width, 1080);
    assert.equal(metadata.height, format === "1:1" ? 1080 : 1350);
    assert.equal(result.diagnostics.layoutVariant, "story_product_reveal");
    assert.equal(result.diagnostics.visualRole, "product_asset");
    assert.ok(result.diagnostics.ctaLineCount > 0);
  }
});
