import assert from "node:assert/strict";
import test from "node:test";

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
