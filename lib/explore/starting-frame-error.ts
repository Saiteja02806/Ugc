/** Only expose the reason the provider actually supplied; never infer a trigger. */
export function startingFrameErrorMessage(message: string | null): string | null {
  if (message && /image generation blocked due to safety violations|image was filtered out|PROVIDER_CONTENT_MODERATION/i.test(message)) {
    return "Google couldn't return this image because its content checks blocked the result. Google did not tell us which part triggered the block. Review your photos and instructions before making another generation request.";
  }
  return message;
}
