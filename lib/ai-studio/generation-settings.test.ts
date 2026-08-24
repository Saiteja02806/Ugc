import assert from "node:assert/strict";
import test from "node:test";

import {
  getAIStudioRatioLabel,
  parseAIStudioGenerationQuantity,
  parseAIStudioImageAspectRatio,
  parseAIStudioImageModel,
  parseAIStudioVideoAspectRatio,
  parseAIStudioVideoDuration,
  parseAIStudioVideoModel,
} from "./generation-settings.ts";

test("accepts only supported AI Studio settings", () => {
  assert.equal(parseAIStudioImageAspectRatio("1:1"), "1:1");
  assert.equal(parseAIStudioImageAspectRatio("3:2"), "9:16");
  assert.equal(parseAIStudioVideoAspectRatio("16:9"), "16:9");
  assert.equal(parseAIStudioVideoAspectRatio("4:5"), "9:16");
  assert.equal(parseAIStudioGenerationQuantity(4), 4);
  assert.equal(parseAIStudioGenerationQuantity(3), 1);
  assert.equal(parseAIStudioImageModel("nano_banana_2"), "nano_banana_2");
  assert.equal(parseAIStudioImageModel("unknown"), "gpt_image");
  assert.equal(parseAIStudioVideoModel("google_omni"), "google_omni");
  assert.equal(parseAIStudioVideoModel("unknown"), "google_omni");
  assert.equal(parseAIStudioVideoDuration(10), 10);
  assert.equal(parseAIStudioVideoDuration(11), 4);
});

test("provides clear labels for supported ratios", () => {
  assert.equal(getAIStudioRatioLabel("4:5"), "4:5 portrait");
  assert.equal(getAIStudioRatioLabel("9:16"), "9:16 vertical");
});
