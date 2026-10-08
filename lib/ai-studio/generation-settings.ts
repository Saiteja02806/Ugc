export const AI_STUDIO_IMAGE_ASPECT_RATIOS = [
  "4:5",
  "1:1",
  "9:16",
  "16:9",
] as const;

export const AI_STUDIO_VIDEO_ASPECT_RATIOS = ["9:16", "16:9"] as const;
export const AI_STUDIO_GENERATION_QUANTITIES = [1, 2, 4] as const;
export const AI_STUDIO_IMAGE_MODELS = ["nano_banana_2", "seedream_5_pro"] as const;
export const SLIDESHOW_IMAGE_MODELS = ["gpt_image_2_5", "nano_banana_2"] as const;
export const AI_STUDIO_VIDEO_MODELS = ["kling_3_0", "google_omni", "seedance_2_5"] as const;
export const AI_STUDIO_VIDEO_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30] as const;
const SEEDANCE_VIDEO_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;
export const AI_STUDIO_VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;


export type AIStudioImageAspectRatio =
  (typeof AI_STUDIO_IMAGE_ASPECT_RATIOS)[number];
export type AIStudioVideoAspectRatio =
  (typeof AI_STUDIO_VIDEO_ASPECT_RATIOS)[number];
export type AIStudioGenerationQuantity =
  (typeof AI_STUDIO_GENERATION_QUANTITIES)[number];
export type AIStudioImageModel =
  | (typeof AI_STUDIO_IMAGE_MODELS)[number]
  | (typeof SLIDESHOW_IMAGE_MODELS)[number];
export const DEFAULT_AI_STUDIO_IMAGE_MODEL: AIStudioImageModel = "nano_banana_2";
export const DEFAULT_SLIDESHOW_IMAGE_MODEL: AIStudioImageModel = "gpt_image_2_5";
export type AIStudioVideoModel = (typeof AI_STUDIO_VIDEO_MODELS)[number];
export type AIStudioVideoDuration =
  (typeof AI_STUDIO_VIDEO_DURATIONS)[number] | (typeof SEEDANCE_VIDEO_DURATIONS)[number];
export type AIStudioVideoResolution =
  (typeof AI_STUDIO_VIDEO_RESOLUTIONS)[number];

const AI_STUDIO_VIDEO_RESOLUTIONS_BY_MODEL: Record<
  AIStudioVideoModel,
  readonly AIStudioVideoResolution[]
> = {
  google_omni: ["720p", "1080p"],
  kling_3_0: ["720p"],
  seedance_2_5: ["480p", "720p"],
};

export function getAIStudioVideoModelLabel(model: AIStudioVideoModel) {
  return { kling_3_0: "Kling 3.0", google_omni: "Omni Flash 1.1", seedance_2_5: "Seedance 2.5" }[model];
}

export function isAIStudioVideoModelAvailable(
  model: AIStudioVideoModel,
  seedanceEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE === "true",
) {
  return model !== "seedance_2_5" || seedanceEnabled;
}

export function getAIStudioVideoDurations(model: AIStudioVideoModel): readonly AIStudioVideoDuration[] {
  if (model === "seedance_2_5") return SEEDANCE_VIDEO_DURATIONS;
  return AI_STUDIO_VIDEO_DURATIONS.filter((duration) => duration <= (model === "kling_3_0" ? 15 : 10));
}

export function parseAIStudioImageAspectRatio(
  value: unknown,
): AIStudioImageAspectRatio {
  return AI_STUDIO_IMAGE_ASPECT_RATIOS.includes(
    value as AIStudioImageAspectRatio,
  )
    ? (value as AIStudioImageAspectRatio)
    : "9:16";
}

export function parseAIStudioImageModel(value: unknown): AIStudioImageModel {
  return [...AI_STUDIO_IMAGE_MODELS, ...SLIDESHOW_IMAGE_MODELS].includes(value as AIStudioImageModel)
    ? (value as AIStudioImageModel)
    : DEFAULT_AI_STUDIO_IMAGE_MODEL;
}

export function getAIStudioImageModelLabel(model: AIStudioImageModel) {
  return {
    nano_banana_2: "Nano Banana 2.1",
    seedream_5_pro: "Seedream 5.0 Pro",
    gpt_image_2_5: "GPT Image 2.5",
  }[model];
}

export function parseAIStudioVideoModel(value: unknown): AIStudioVideoModel {
  return AI_STUDIO_VIDEO_MODELS.includes(value as AIStudioVideoModel)
    ? (value as AIStudioVideoModel)
    : "kling_3_0";
}

export function parseAIStudioVideoDuration(
  value: unknown,
): AIStudioVideoDuration {
  return [...AI_STUDIO_VIDEO_DURATIONS, ...SEEDANCE_VIDEO_DURATIONS].includes(value as AIStudioVideoDuration)
    ? (value as AIStudioVideoDuration)
    : 5;
}

export function parseAIStudioVideoResolution(
  value: unknown,
): AIStudioVideoResolution {
  return AI_STUDIO_VIDEO_RESOLUTIONS.includes(value as AIStudioVideoResolution)
    ? (value as AIStudioVideoResolution)
    : "720p";
}

export function getAIStudioVideoResolutions(model: AIStudioVideoModel) {
  return AI_STUDIO_VIDEO_RESOLUTIONS_BY_MODEL[model];
}

export function isAIStudioVideoResolutionSupported(
  model: AIStudioVideoModel,
  resolution: AIStudioVideoResolution,
) {
  return getAIStudioVideoResolutions(model).includes(resolution);
}

export function parseAIStudioVideoAspectRatio(
  value: unknown,
): AIStudioVideoAspectRatio {
  return AI_STUDIO_VIDEO_ASPECT_RATIOS.includes(
    value as AIStudioVideoAspectRatio,
  )
    ? (value as AIStudioVideoAspectRatio)
    : "9:16";
}

export function parseAIStudioGenerationQuantity(
  value: unknown,
): AIStudioGenerationQuantity {
  return AI_STUDIO_GENERATION_QUANTITIES.includes(
    value as AIStudioGenerationQuantity,
  )
    ? (value as AIStudioGenerationQuantity)
    : 1;
}

export function getAIStudioRatioLabel(
  ratio: AIStudioImageAspectRatio | AIStudioVideoAspectRatio,
) {
  switch (ratio) {
    case "4:5":
      return "4:5 portrait";
    case "1:1":
      return "1:1 square";
    case "9:16":
      return "9:16 vertical";
    case "16:9":
      return "16:9 landscape";
  }
}
