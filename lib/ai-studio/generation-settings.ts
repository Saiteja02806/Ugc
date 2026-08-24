export const AI_STUDIO_IMAGE_ASPECT_RATIOS = [
  "4:5",
  "1:1",
  "9:16",
  "16:9",
] as const;

export const AI_STUDIO_VIDEO_ASPECT_RATIOS = ["9:16", "16:9"] as const;
export const AI_STUDIO_GENERATION_QUANTITIES = [1, 2, 4] as const;
export const AI_STUDIO_IMAGE_MODELS = ["nano_banana_2", "gpt_image"] as const;
export const AI_STUDIO_VIDEO_MODELS = ["google_omni"] as const;
export const AI_STUDIO_VIDEO_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10] as const;

export type AIStudioImageAspectRatio =
  (typeof AI_STUDIO_IMAGE_ASPECT_RATIOS)[number];
export type AIStudioVideoAspectRatio =
  (typeof AI_STUDIO_VIDEO_ASPECT_RATIOS)[number];
export type AIStudioGenerationQuantity =
  (typeof AI_STUDIO_GENERATION_QUANTITIES)[number];
export type AIStudioImageModel = (typeof AI_STUDIO_IMAGE_MODELS)[number];
export type AIStudioVideoModel = (typeof AI_STUDIO_VIDEO_MODELS)[number];
export type AIStudioVideoDuration =
  (typeof AI_STUDIO_VIDEO_DURATIONS)[number];

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
  return AI_STUDIO_IMAGE_MODELS.includes(value as AIStudioImageModel)
    ? (value as AIStudioImageModel)
    : "gpt_image";
}

export function parseAIStudioVideoModel(value: unknown): AIStudioVideoModel {
  return AI_STUDIO_VIDEO_MODELS.includes(value as AIStudioVideoModel)
    ? (value as AIStudioVideoModel)
    : "google_omni";
}

export function parseAIStudioVideoDuration(
  value: unknown,
): AIStudioVideoDuration {
  return AI_STUDIO_VIDEO_DURATIONS.includes(value as AIStudioVideoDuration)
    ? (value as AIStudioVideoDuration)
    : 4;
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
