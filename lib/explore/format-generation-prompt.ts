import { AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH } from "@/lib/ai-studio/prompt-policy";

export const WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS = "Create the moving background only. Do not add text, captions, subtitles, letters, or logos; the user adds their own text in the editor.";

// Video references and provider fallback use Runway's 1,000-character limit.
// Reserve room for the background instruction so it cannot be truncated.
export const EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH = Math.min(AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, 1_000);
export const WALL_TEXT_VIDEO_PROMPT_MAX_LENGTH = EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH - WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS.length - 1;
