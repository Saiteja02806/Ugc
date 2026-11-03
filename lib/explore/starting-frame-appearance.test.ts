import assert from "node:assert/strict";
import test from "node:test";
import { isStartingFrameReferenceOptions, canonicalStartingFrameReferenceOptions, startingFrameReferenceInstructions, withStartingFrameReferenceOptions } from "../../worker/src/lib/starting-frame-reference-options.ts";
import { hookKeyframeProviderImageLabels } from "../../worker/src/lib/hook-keyframe-image-labels.ts";
import { buildOriginalOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";

test("appearance accepts legacy two roles and independent hairstyle values, but rejects malformed roles", () => {
  assert.equal(isStartingFrameReferenceOptions({ background: "source", outfit: "photo" }), true);
  assert.deepEqual(canonicalStartingFrameReferenceOptions({ background: "source", outfit: "photo" }), { background: "source", outfit: "photo" });
  for (const hairstyle of ["source", "photo"] as const) {
    const value = { background: "photo" as const, outfit: "source" as const, hairstyle };
    assert.equal(isStartingFrameReferenceOptions(value), true);
    assert.deepEqual(canonicalStartingFrameReferenceOptions(value), value);
  }
  for (const invalid of [null, [], {}, { background: "source" }, { background: ["source"], outfit: "source" }, { background: "source", outfit: "source", hairstyle: ["photo"] }, { background: "source", outfit: "source", hairstyle: "other" }, { background: "source", outfit: "source", hairstyle: undefined }, { background: "source", outfit: "source", hairstyle: "photo", url: "unowned" }]) {
    assert.equal(isStartingFrameReferenceOptions(invalid), false);
  }
});

test("all eight independent appearance choices fit Seedream's default prompt budget and label every identity role", () => {
  for (const background of ["source", "photo"] as const) for (const outfit of ["source", "photo"] as const) for (const hairstyle of ["source", "photo"] as const) {
    const options = { background, outfit, hairstyle };
    for (const personImageCount of [1, 5]) {
      const base = buildOriginalOpeningImagePrompt({ personImageCount }).prompt;
      const prompt = withStartingFrameReferenceOptions(base, options);
      const labels = hookKeyframeProviderImageLabels(personImageCount, 7, options);
      const length = `${prompt}\n\nIMAGE INPUT ORDER:\n${labels.join("\n")}`.length;
      assert.ok(length <= 4000, `${JSON.stringify(options)} / ${personImageCount} photos: ${length}`);
      assert.equal(labels.length, personImageCount + 1);
      assert.match(labels[0], new RegExp(`hairstyle=${hairstyle === "source" ? "this image" : "Image 2"}`));
      assert.ok(labels.slice(2).every(label => label.includes("no background, outfit, hairstyle")));
      assert.equal(withStartingFrameReferenceOptions(prompt, options), prompt, "Do not append roles twice");
      assert.match(startingFrameReferenceInstructions(options), hairstyle === "photo" ? /HAIRSTYLE: Use Image2's hairstyle, hair color, length, texture, parting and volume/ : /HAIRSTYLE: Keep Image1's hairstyle/);
    }
  }
});
