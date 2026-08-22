import assert from "node:assert/strict";
import test from "node:test";

import {
  getAIStudioRatioLabel,
  parseAIStudioGenerationQuantity,
  parseAIStudioImageAspectRatio,
  parseAIStudioVideoAspectRatio,
} from "./generation-settings.ts";

test("accepts only supported AI Studio settings", () => {
  assert.equal(parseAIStudioImageAspectRatio("1:1"), "1:1");
  assert.equal(parseAIStudioImageAspectRatio("3:2"), "4:5");
  assert.equal(parseAIStudioVideoAspectRatio("16:9"), "16:9");
  assert.equal(parseAIStudioVideoAspectRatio("4:5"), "9:16");
  assert.equal(parseAIStudioGenerationQuantity(4), 4);
  assert.equal(parseAIStudioGenerationQuantity(3), 1);
});

test("provides clear labels for supported ratios", () => {
  assert.equal(getAIStudioRatioLabel("4:5"), "4:5 portrait");
  assert.equal(getAIStudioRatioLabel("9:16"), "9:16 vertical");
});
