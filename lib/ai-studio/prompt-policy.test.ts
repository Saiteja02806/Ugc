import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "./prompt-policy.ts";

test("normalizes AI Studio prompts without silently truncating them", () => {
  const prompt = `  ${"x".repeat(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1)}  `;

  assert.equal(
    normalizeAIStudioPrompt(prompt).length,
    AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1,
  );
});

test("reports mode-specific AI Studio prompt limits", () => {
  assert.equal(
    getAIStudioPromptLengthError(
      "x".repeat(AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH),
      AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
    ),
    null,
  );
  assert.match(
    getAIStudioPromptLengthError(
      "x".repeat(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH + 1),
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    ) ?? "",
    /1,000 characters or fewer/,
  );
});
