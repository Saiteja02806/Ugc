import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_HOOK_VIDEO_PROVIDER } from "./ugc-video-prompt.js";
import { shouldFallbackToRunway } from "./video-provider-fallback.js";

test("uses Runway as the default Hook video provider", () => {
  assert.equal(DEFAULT_HOOK_VIDEO_PROVIDER, "runway");
});

test("does not fall back for an invalid Gemini Developer API parameter", () => {
  assert.equal(
    shouldFallbackToRunway(
      new Error(
        "generateAudio parameter is only supported in Gemini Enterprise Agent Platform mode, not in Gemini Developer API mode.",
      ),
    ),
    false,
  );
});

test("falls back for retryable provider failures", () => {
  assert.equal(shouldFallbackToRunway({ status: 429 }), true);
  assert.equal(shouldFallbackToRunway({ statusCode: 503 }), true);
  assert.equal(shouldFallbackToRunway({ code: "ETIMEDOUT" }), true);
  assert.equal(shouldFallbackToRunway(new Error("fetch failed")), true);
});

test("does not fall back for permanent request failures", () => {
  assert.equal(shouldFallbackToRunway({ status: 400 }), false);
  assert.equal(shouldFallbackToRunway(new Error("Invalid reference image")), false);
});
