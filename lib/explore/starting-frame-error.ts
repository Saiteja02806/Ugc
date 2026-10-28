/** Only expose the reason the provider actually supplied; never infer a trigger. */
export function startingFrameErrorMessage(message: string | null): string | null {
  if (message && /image generation blocked due to safety violations|image was filtered out|PROVIDER_CONTENT_MODERATION/i.test(message)) {
    return "Google couldn't return this image because its content checks blocked the result. Google did not tell us which part triggered the block. Review your photos and instructions before making another generation request.";
  }
  if (message && /^402(?:\s|:)/i.test(message.trim())) {
    return "The image provider rejected this attempt (402), so no starting frame was returned. You can choose another image model or try again.";
  }
  return message;
}
