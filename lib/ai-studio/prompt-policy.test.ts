import assert from "node:assert/strict";
import test from "node:test";
import { getExploreVideoPromptMaxLength } from "../explore/format-generation-prompt.ts";
import { buildExploreGenerationInstructions } from "../explore/generation-input-instructions.ts";

import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  getAIStudioVideoPromptMaxLength,
  normalizeAIStudioPrompt,
} from "./prompt-policy.ts";

test("normalizes AI Studio prompts without silently truncating them", () => {
  const prompt = `  ${"x".repeat(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1)}  `;

  assert.equal(
    normalizeAIStudioPrompt(prompt).length,
    AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1,
  );
});

test("reports video validation errors without numeric limit text", () => {
  assert.equal(
    getAIStudioPromptLengthError(
      "x".repeat(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH),
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    ),
    null,
  );
  assert.match(
    getAIStudioPromptLengthError(
      "x".repeat(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1),
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    ) ?? "",
    /too long for the selected model/,
  );
});

test("Omni accepts a long prompt while reference-video and other model safeguards stay separate", () => {
  const prompt = "Precise scene and spoken dialogue. ".repeat(300);
  const omniLimit = getAIStudioVideoPromptMaxLength({ model: "google_omni" });
  assert.equal(omniLimit, undefined, "Omni's token window is not a character limit");
  assert.equal(getAIStudioPromptLengthError(prompt, omniLimit), null);
  assert.equal(
    getAIStudioVideoPromptMaxLength({ model: "google_omni", hasReferenceVideo: true }),
    1000,
  );
  assert.equal(getAIStudioVideoPromptMaxLength({ model: "seedance_2_5" }), 10000);
});

test("Kling 4 uses its own application budget rather than the legacy 1000-character fallback", () => {
  for (const provider of [undefined, "reapi"]) {
    const limit = getAIStudioVideoPromptMaxLength({ model: "kling_4_0", provider });
    assert.equal(limit, 10_000);
    for (const length of [1001, 4001, 6000, 10_000]) assert.equal(getAIStudioPromptLengthError("x".repeat(length), limit), null);
    assert.match(getAIStudioPromptLengthError("x".repeat(10_001), limit) ?? "", /too long/);
  }
  assert.equal(getAIStudioVideoPromptMaxLength({ model: "kling_3_0" }), 2500);
  assert.equal(getAIStudioVideoPromptMaxLength({ provider: "runway" }), 1000);
  assert.equal(getAIStudioVideoPromptMaxLength({ model: "google_omni", provider: "reapi" }), 2000);
});

test("the editor's budget reserves appended guidance without dropping the end of Kling 4 instructions", () => {
  const options = { model: "kling_4_0", personPhotos: false, imageCount: 0, generateAudio: false } as const;
  const budget = getExploreVideoPromptMaxLength(options)!;
  const { instructions } = buildExploreGenerationInstructions({ ...options, hasVideo: false });
  const suffix = "Keep the final requested action.";
  const authored = "x".repeat(budget - suffix.length) + suffix;
  assert.ok(budget > 4000);
  assert.equal(`${instructions}\n\n${authored}`.length, 10_000);
  assert.ok(`${instructions}\n\n${authored}`.endsWith(suffix));
});
