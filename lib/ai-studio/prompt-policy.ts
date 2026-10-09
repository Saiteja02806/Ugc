import { LEGACY_VIDEO_PROMPT_MAX_LENGTH } from "../../worker/src/lib/video-prompt-policy.ts";

export { getVideoPromptCharacterLimit as getAIStudioVideoPromptMaxLength } from "../../worker/src/lib/video-prompt-policy.ts";

export const AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH = 2_000;
export const AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH = LEGACY_VIDEO_PROMPT_MAX_LENGTH;

export function normalizeAIStudioPrompt(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAIStudioPromptLengthError(
  prompt: string,
  maxLength: number | undefined,
) {
  return maxLength !== undefined && prompt.length > maxLength
    ? `Keep the prompt to ${maxLength.toLocaleString("en-US")} characters or fewer.`
    : null;
}
