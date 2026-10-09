import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, getAIStudioVideoPromptMaxLength } from "@/lib/ai-studio/prompt-policy";

export const WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS = "Create the moving background only. Do not add text, captions, subtitles, letters, or logos; the user adds their own text in the editor.";

// Video references and provider fallback use Runway's 1,000-character limit.
// Reserve room for the background instruction so it cannot be truncated.
export const EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH = Math.min(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, 1_000);
export const WALL_TEXT_VIDEO_PROMPT_MAX_LENGTH = EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH - WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length - 1;

export function getExploreVideoPromptMaxLength({ model, hasReferenceVideo = false, format }: {
  model: AIStudioVideoModel;
  hasReferenceVideo?: boolean;
  format?: "hook" | "wall_text";
}) {
  const limit = getAIStudioVideoPromptMaxLength({ model, hasReferenceVideo });
  return limit !== undefined && format === "wall_text"
    ? limit - WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length - 1
    : limit;
}
