import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVeoGenerationConfig,
  VEO_DURATION_SECONDS,
  VEO_MODEL,
} from "./veo-video.js";

test("uses the low-cost portrait Veo configuration accepted by Gemini API", () => {
  const config = buildVeoGenerationConfig();

  assert.equal(VEO_MODEL, "veo-3.1-lite-generate-preview");
  assert.equal(VEO_DURATION_SECONDS, 4);
  assert.equal(config.aspectRatio, "9:16");
  assert.equal(config.durationSeconds, 4);
  assert.equal(config.numberOfVideos, 1);
  assert.equal(config.resolution, "720p");
  assert.equal(Object.hasOwn(config, "enhancePrompt"), false);
  assert.equal(Object.hasOwn(config, "generateAudio"), false);
  assert.equal(Object.hasOwn(config, "negativePrompt"), false);
});
