import assert from "node:assert/strict";
import test from "node:test";
import { isStartingFrameReferenceOptions, canonicalStartingFrameReferenceOptions, startingFrameReferenceInstructions, withStartingFrameReferenceOptions } from "../../worker/src/lib/starting-frame-reference-options.ts";
import { hookKeyframeProviderImageLabels } from "../../worker/src/lib/hook-keyframe-image-labels.ts";
import { buildOriginalOpeningImagePrompt, buildHookKeyframeStage2Prompt } from "./hook-keyframe-image-prompt.ts";

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
      if (background === "photo" && outfit === "photo" && hairstyle === "photo") {
        assert.match(startingFrameReferenceInstructions(options), /FULL APPEARANCE: Use Image2 as the complete source of truth for hair, body build, skin tone, outfit and background/);
        assert.doesNotMatch(prompt, /replacing only the person's identity/);
        assert.doesNotMatch(prompt, /Identity photos supply facial features only/);
        assert.doesNotMatch(prompt, /Retain the visible room furniture/);
        const stage2 = buildHookKeyframeStage2Prompt({
          supportingImageCount: 1,
          stage2Version: 2,
          referenceId: "explore-paired-hook-9dfcfdb8bb0d7dc8dcba3353",
          sourceSha256: "ef2341b6d1de7bf3c7e5ac7a24f4e60d67761f12d4b0f0a4805fc4e985d87e2d",
          referenceOptions: options,
        });
        assert.doesNotMatch(stage2, /Retain the visible room furniture/);
      } else {
        assert.doesNotMatch(startingFrameReferenceInstructions(options), /FULL APPEARANCE:/);
      }
    }
  }
});
