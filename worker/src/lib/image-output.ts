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
  options: { preserveComposition?: boolean; cropNearRatioPadding?: boolean } = {},
) {
  const dimensions = getAIStudioImageDimensions(ratio);
  const image = sharp(imageBuffer);
  let cropNearRatioPadding = false;
  if (options.preserveComposition && options.cropNearRatioPadding) {
    const { width, height } = await image.metadata();
    if (width && height) {
      // Some providers return a nominal 9:16 image on a nearby pixel grid.
      // Remove the resulting thin margins without stretching facial proportions.
      // A larger mismatch retains the complete image and the legacy contain fit.
      const scale = Math.max(dimensions.width / width, dimensions.height / height);
      const scaledWidth = Math.max(dimensions.width, Math.ceil(width * scale));
      const scaledHeight = Math.max(dimensions.height, Math.ceil(height * scale));
      // Round the estimated covered canvas up so even the pixel-grid boundary
      // cannot opt into a crop exceeding one percent of either image extent.
      const croppedFraction = 1 - Math.min(dimensions.width / scaledWidth, dimensions.height / scaledHeight);
      cropNearRatioPadding = croppedFraction <= 0.01;
    }
  }

  return image
    .resize({
      fit: options.preserveComposition && !cropNearRatioPadding ? "contain" : "cover",
      ...(options.preserveComposition && !cropNearRatioPadding ? { background: "#ffffff" } : {}),
      height: dimensions.height,
      position: cropNearRatioPadding ? "centre" : "attention",
      width: dimensions.width,
    })
    .png()
    .toBuffer();
}
