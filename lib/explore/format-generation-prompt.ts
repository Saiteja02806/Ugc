import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { getAIStudioVideoPromptMaxLength } from "@/lib/ai-studio/prompt-policy";

export const WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS = "Create the moving background only. Do not add text, captions, subtitles, letters, or logos; the user adds their own text in the editor.";

export function getExploreVideoPromptMaxLength({
  model,
  hasReferenceVideo,
  format,
}: {
  model: AIStudioVideoModel;
  hasReferenceVideo: boolean;
  format?: string;
}) {
  const maxLength = getAIStudioVideoPromptMaxLength({ model, hasReferenceVideo });
  // Reserve space for the appended instruction on character-limited paths.
  // Omni validates the complete input, including this instruction, in tokens.
  return maxLength !== undefined && format === "wall_text"
    ? maxLength - WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length - 1
    : maxLength;
}
