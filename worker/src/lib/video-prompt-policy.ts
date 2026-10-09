// Google Omni has a token limit, checked against live model metadata before
// submission. A character limit cannot accurately represent its context window.
// Keep the existing character safeguards for the other generation paths until
// their provider-specific limits are verified. Video guidance routes to Runway.
export const LEGACY_VIDEO_PROMPT_MAX_LENGTH = 1_000;

export function getVideoPromptCharacterLimit({
  model,
  hasReferenceVideo = false,
  provider,
}: {
  model?: "google_omni" | "seedance_2_5" | "wan_3_0" | "kling_3_0";
  hasReferenceVideo?: boolean;
  provider?: string;
}) {
  if (
    !hasReferenceVideo &&
    (model === "google_omni" || (!model && provider === "gemini"))
  ) {
    return undefined;
  }

  if (model === "kling_3_0") return 2_500;
  if (model === "seedance_2_5" || model === "wan_3_0") return 10_000;
  return LEGACY_VIDEO_PROMPT_MAX_LENGTH;
}
