import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVideoGenerationPrompt,
  DEFAULT_HOOK_VIDEO_PROVIDER,
} from "./ugc-video-prompt.js";
import { shouldFallbackToRunway } from "./video-provider-fallback.js";

test("uses Runway as the default Hook video provider", () => {
  assert.equal(DEFAULT_HOOK_VIDEO_PROVIDER, "runway");
});

test("AI Studio direct mode sends only the user's video prompt", () => {
  assert.equal(
    buildVideoGenerationPrompt({
      hookIdea: "  A paper boat crossing a rain puddle at sunset.  ",
      promptMode: "direct",
    }),
    "A paper boat crossing a rain puddle at sunset.",
  );
});

test("legacy Hook generation keeps its UGC template", () => {
  const prompt = buildVideoGenerationPrompt({
    cameraStyle: "iphone_selfie",
    emotion: "curious",
    hookIdea: "Show the result before explaining it.",
    promptMode: "ugc_template",
  });

  assert.match(prompt, /UGC-style short video/);
  assert.match(prompt, /Show the result before explaining it\./);
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
