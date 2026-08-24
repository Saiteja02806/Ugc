import sharp from "sharp";

export const AI_STUDIO_IMAGE_HEIGHT = 1_280;
export const AI_STUDIO_IMAGE_RATIO = "9:16";
export const AI_STUDIO_IMAGE_WIDTH = 1_024;

export const AI_STUDIO_IMAGE_RATIOS = ["4:5", "1:1", "9:16", "16:9"] as const;
export type AIStudioImageRatio = (typeof AI_STUDIO_IMAGE_RATIOS)[number];

export function getAIStudioImageDimensions(ratio: AIStudioImageRatio) {
  switch (ratio) {
    case "1:1":
      return { height: 1_024, width: 1_024 };
    case "9:16":
      return { height: 1_280, width: 720 };
    case "16:9":
      return { height: 720, width: 1_280 };
    case "4:5":
      return { height: AI_STUDIO_IMAGE_HEIGHT, width: AI_STUDIO_IMAGE_WIDTH };
  }
}

export async function prepareAIStudioImageOutput(
  imageBuffer: Buffer,
  ratio: AIStudioImageRatio = AI_STUDIO_IMAGE_RATIO,
) {
  const dimensions = getAIStudioImageDimensions(ratio);

  return sharp(imageBuffer)
    .resize({
      fit: "cover",
      height: dimensions.height,
      position: "attention",
      width: dimensions.width,
    })
    .png()
    .toBuffer();
}
