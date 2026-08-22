export const AI_STUDIO_IMAGE_ASPECT_RATIOS = [
  "4:5",
  "1:1",
  "9:16",
  "16:9",
] as const;

export const AI_STUDIO_VIDEO_ASPECT_RATIOS = ["9:16", "16:9"] as const;
export const AI_STUDIO_GENERATION_QUANTITIES = [1, 2, 4] as const;

export type AIStudioImageAspectRatio =
  (typeof AI_STUDIO_IMAGE_ASPECT_RATIOS)[number];
export type AIStudioVideoAspectRatio =
  (typeof AI_STUDIO_VIDEO_ASPECT_RATIOS)[number];
export type AIStudioGenerationQuantity =
  (typeof AI_STUDIO_GENERATION_QUANTITIES)[number];

export function parseAIStudioImageAspectRatio(
  value: unknown,
): AIStudioImageAspectRatio {
  return AI_STUDIO_IMAGE_ASPECT_RATIOS.includes(
    value as AIStudioImageAspectRatio,
  )
    ? (value as AIStudioImageAspectRatio)
    : "4:5";
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
