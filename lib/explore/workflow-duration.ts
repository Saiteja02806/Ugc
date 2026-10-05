import { getAIStudioVideoDurations, type AIStudioVideoDuration, type AIStudioVideoModel } from "../ai-studio/generation-settings.ts";

const PRESETS = [5, 10, 15, 20, 30] as const;

export function workflowDurationPresets(model: AIStudioVideoModel) {
  const supported = getAIStudioVideoDurations(model);
  return PRESETS.filter((seconds) => supported.includes(seconds));
}

/** Never round, clamp, or substitute a duration the user entered. */
export function customWorkflowDuration(model: AIStudioVideoModel, raw: string): AIStudioVideoDuration | null {
  if (!/^\d+$/.test(raw)) return null;
  const seconds = Number(raw);
  return getAIStudioVideoDurations(model).includes(seconds as AIStudioVideoDuration)
    ? seconds as AIStudioVideoDuration : null;
}
