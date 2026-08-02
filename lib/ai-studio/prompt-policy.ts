export const AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH = 2_000;
export const AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH = 1_000;

export function normalizeAIStudioPrompt(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAIStudioPromptLengthError(
  prompt: string,
  maxLength: number,
) {
  return prompt.length > maxLength
    ? `Keep the prompt to ${maxLength.toLocaleString("en-US")} characters or fewer.`
    : null;
}
