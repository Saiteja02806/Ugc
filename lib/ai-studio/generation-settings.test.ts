import assert from "node:assert/strict";
import test from "node:test";

import {
  getAIStudioVideoResolutions,
  getAIStudioVideoDurations,
  getAIStudioVideoModelLabel,
  isAIStudioVideoModelAvailable,

  getAIStudioRatioLabel,
  isAIStudioVideoResolutionSupported,
  parseAIStudioGenerationQuantity,
  parseAIStudioImageAspectRatio,
  parseAIStudioImageModel,
  parseAIStudioVideoAspectRatio,
  parseAIStudioVideoDuration,
  parseAIStudioVideoModel,
  parseAIStudioVideoResolution,
} from "./generation-settings.ts";

test("accepts only supported AI Studio settings", () => {
  assert.equal(parseAIStudioImageAspectRatio("1:1"), "1:1");
  assert.equal(parseAIStudioImageAspectRatio("3:2"), "9:16");
  assert.equal(parseAIStudioVideoAspectRatio("16:9"), "16:9");
  assert.equal(parseAIStudioVideoAspectRatio("4:5"), "9:16");
  assert.equal(parseAIStudioGenerationQuantity(4), 4);
  assert.equal(parseAIStudioGenerationQuantity(3), 1);
  assert.equal(parseAIStudioImageModel("seedream_5_pro"), "seedream_5_pro");
  assert.equal(parseAIStudioImageModel("nano_banana_2"), "nano_banana_2");
  assert.equal(parseAIStudioImageModel("unknown"), "nano_banana_2");

  assert.equal(parseAIStudioVideoModel("google_omni"), "google_omni");
  assert.equal(parseAIStudioVideoModel("kling_3_0"), "kling_3_0");
  assert.equal(parseAIStudioVideoModel("unknown"), "kling_3_0");
  assert.equal(parseAIStudioVideoDuration(10), 10);
  assert.equal(parseAIStudioVideoDuration(30), 30);
  assert.equal(parseAIStudioVideoDuration(11), 11);
  assert.equal(parseAIStudioVideoDuration(31), 5);
  assert.equal(parseAIStudioVideoResolution("1080p"), "1080p");
  assert.equal(parseAIStudioVideoResolution("4k"), "720p");
});

test("Seedance uses its own capabilities and is gated until the provider is ready", () => {
  assert.equal(parseAIStudioVideoModel("seedance_2_5"), "seedance_2_5");
  assert.equal(getAIStudioVideoModelLabel("seedance_2_5"), "Seedance 2.5");
  assert.deepEqual(getAIStudioVideoResolutions("seedance_2_5"), ["480p", "720p"]);
  assert.equal(isAIStudioVideoResolutionSupported("seedance_2_5", "1080p"), false);
  assert.deepEqual(getAIStudioVideoDurations("seedance_2_5"), Array.from({ length: 27 }, (_, i) => i + 4));
  assert.ok(getAIStudioVideoDurations("kling_3_0").every((seconds) => seconds >= 3 && seconds <= 15));
  assert.ok(getAIStudioVideoDurations("google_omni").every((seconds) => seconds <= 10));
  assert.equal(isAIStudioVideoModelAvailable("seedance_2_5", false), false);
  assert.equal(isAIStudioVideoModelAvailable("seedance_2_5", true), true);
  assert.equal(isAIStudioVideoModelAvailable("kling_3_0", false), true);
  assert.equal(isAIStudioVideoModelAvailable("google_omni", false), true);
});

test("limits video quality choices to each provider's supported resolutions", () => {
  assert.deepEqual(getAIStudioVideoResolutions("kling_3_0"), ["720p"]);
  assert.deepEqual(getAIStudioVideoResolutions("google_omni"), ["720p", "1080p"]);
  assert.equal(
    isAIStudioVideoResolutionSupported("kling_3_0", "1080p"),
    false,
  );
  assert.equal(
    isAIStudioVideoResolutionSupported("google_omni", "1080p"),
    true,
  );
});

test("provides clear labels for supported ratios", () => {
  assert.equal(getAIStudioRatioLabel("4:5"), "4:5 portrait");
  assert.equal(getAIStudioRatioLabel("9:16"), "9:16 vertical");
});
