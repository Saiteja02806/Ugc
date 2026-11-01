import {
  AI_STUDIO_VIDEO_MODELS,
  getDefaultAIStudioVideoModel,
  getAIStudioVideoDurations,
  getAIStudioVideoModelLabel,
  getAIStudioVideoResolutions,
  isAIStudioVideoModelAvailable,
  parseAIStudioGenerationQuantity,
  parseAIStudioVideoAspectRatio,
  parseAIStudioVideoDuration,
  parseAIStudioVideoModel,
  parseAIStudioVideoResolution,
  type AIStudioGenerationQuantity,
  type AIStudioVideoAspectRatio,
  type AIStudioVideoDuration,
  type AIStudioVideoModel,
  type AIStudioVideoResolution,
} from "../ai-studio/generation-settings";

export type WorkflowGenerationSettings = {
  model: AIStudioVideoModel;
  duration: AIStudioVideoDuration;
  quantity: AIStudioGenerationQuantity;
  resolution: AIStudioVideoResolution;
  aspectRatio: AIStudioVideoAspectRatio;
};

const seedanceIsEnabled = () => process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE === "true";
const wanIsEnabled = () => process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN === "true";

/** Application integration limits, not a claim about every provider capability. */
export function getWorkflowVideoModels(seedanceEnabled = seedanceIsEnabled(), wanEnabled = wanIsEnabled()) {
  return AI_STUDIO_VIDEO_MODELS
    .filter((model) => isAIStudioVideoModelAvailable(model, seedanceEnabled, wanEnabled))
    .map((model) => ({ value: model, label: getAIStudioVideoModelLabel(model) }));
}

/** Change model and incompatible settings together; never leave an invalid draft. */
export function normalizeWorkflowGenerationSettings(
  draft: Partial<WorkflowGenerationSettings> = {},
  seedanceEnabled = seedanceIsEnabled(),
  wanEnabled = wanIsEnabled(),
): WorkflowGenerationSettings {
  const requestedModel = draft.model ?? getDefaultAIStudioVideoModel(seedanceEnabled);
  const parsedModel = parseAIStudioVideoModel(requestedModel);
  const model = isAIStudioVideoModelAvailable(parsedModel, seedanceEnabled, wanEnabled) ? parsedModel : "kling_3_0";
  const duration = parseAIStudioVideoDuration(draft.duration);
  const resolution = parseAIStudioVideoResolution(draft.resolution);
  const supportedDurations = getAIStudioVideoDurations(model);

  return {
    model,
    duration: supportedDurations.includes(duration) ? duration : supportedDurations.includes(5) ? 5 : supportedDurations[0],
    resolution: getAIStudioVideoResolutions(model).includes(resolution) ? resolution : "720p",
    quantity: parseAIStudioGenerationQuantity(draft.quantity),
    aspectRatio: parseAIStudioVideoAspectRatio(draft.aspectRatio),
  };
}

export function createWorkflowGenerationSettings(initialDuration = 5, initialModel?: AIStudioVideoModel) {
  return normalizeWorkflowGenerationSettings({ model: initialModel, duration: parseAIStudioVideoDuration(initialDuration) });
}
