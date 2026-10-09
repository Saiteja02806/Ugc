import assert from "node:assert/strict";
import test from "node:test";
import { getCarouselEditHookFontSize } from "./carousel-edit-cover-typography.js";

const original = {
  headline: "stop feeling the pressure to always be 'on'. your well-being matters too.",
  subtext: "", slideNumber: 1,
  originalHeadline: "stop feeling the pressure to always be 'on'. your well-being matters too.",
  originalSubtext: "",
  sourceRendererVersion: "story-native-tiktok-text-blocks-inter-tight-v11",
};

test("image-only changes retain the known original 72px hook instead of forcing 84px", () => {
  assert.equal(getCarouselEditHookFontSize(original), 72);
  assert.equal(getCarouselEditHookFontSize({ ...original,
    sourceRendererVersion: "social-tiktok-text-blocks-inter-tight-v25" }), 72);
});

test("changed copy, current renderers, unknown sources and body slides keep the current contract", () => {
  for (const slide of [
    { ...original, headline: "Why being constantly available keeps draining you" },
    { ...original, subtext: "New explanation" },
    { ...original, slideNumber: 2 },
    { ...original, sourceRendererVersion: "story-native-full-frame-product-inter-tight-v13" },
    { ...original, sourceRendererVersion: "unknown" },
    { ...original, originalHeadline: undefined },
  ]) assert.equal(getCarouselEditHookFontSize(slide), 84);
});
