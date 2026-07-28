import sharp from "sharp";

export const AI_STUDIO_IMAGE_HEIGHT = 1_280;
export const AI_STUDIO_IMAGE_RATIO = "4:5";
export const AI_STUDIO_IMAGE_WIDTH = 1_024;

export async function prepareAIStudioImageOutput(imageBuffer: Buffer) {
  return sharp(imageBuffer)
    .resize({
      fit: "cover",
      height: AI_STUDIO_IMAGE_HEIGHT,
      position: "attention",
      width: AI_STUDIO_IMAGE_WIDTH,
    })
    .png()
    .toBuffer();
}
