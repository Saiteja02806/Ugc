export const AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH = 10_000;
export const AI_STUDIO_KLING_PROMPT_MAX_LENGTH = 2_500;
export { getVideoPromptCharacterLimit as getAIStudioVideoPromptMaxLength } from "../../worker/src/lib/video-prompt-policy";

export function normalizeAIStudioPrompt(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAIStudioPromptLengthError(
  prompt: string,
  maxLength: number | undefined,
) {
  return maxLength !== undefined && prompt.length > maxLength
    ? "This prompt is too long for the selected model. Shorten it and try again."
    : null;
}
