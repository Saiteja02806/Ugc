import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, getAIStudioVideoPromptMaxLength } from "@/lib/ai-studio/prompt-policy";
import { buildExploreGenerationInstructions } from "./generation-input-instructions.ts";

export const WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS = "Return moving footage without creator-added text, captions, subtitles or overlay logos. Remove existing overlays and reconstruct the background; preserve text naturally present on physical objects. The user adds their own overlay text in the editor.";

// Legacy video references and provider fallback use Runway's 1,000-character limit.
// Reserve room for the background instruction so it cannot be truncated.
export const EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH = Math.min(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, 1_000);
export const WALL_TEXT_VIDEO_PROMPT_MAX_LENGTH = EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH - WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length - 1;

export function getExploreVideoPromptMaxLength({ model, hasReferenceVideo = false, referenceVideoMode, format, personPhotos = false, imageCount = personPhotos ? 1 : 0, generateAudio }: {
  model: AIStudioVideoModel;
  hasReferenceVideo?: boolean;
  referenceVideoMode?: "edit";
  format?: "hook" | "wall_text";
  personPhotos?: boolean;
  imageCount?: number;
  generateAudio?: boolean;
}) {
  const limit = getAIStudioVideoPromptMaxLength({ model, hasReferenceVideo, referenceVideoMode });
  const { instructions } = buildExploreGenerationInstructions({ model, personPhotos, imageCount, hasVideo: hasReferenceVideo, generateAudio, referenceVideoMode });
  return limit === undefined ? undefined : Math.max(0, limit
    - (format === "wall_text" ? WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length + 1 : 0)
    - (instructions ? instructions.length + 2 : 0));
}
