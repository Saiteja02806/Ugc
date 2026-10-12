import "server-only";

import { downloadVideoReference, readMp4DurationSeconds, OMNI_EDIT_MAX_VIDEO_SECONDS } from "../../worker/src/lib/video-reference-input";

/** Resolve a registered clip on the server; a client URL is never an authority. */
export async function resolveGalleryGenerationVideo(referenceId: unknown, format: unknown) {
  const { getRecreateReferences } = await import("./recreate-catalog");
  const reference = getRecreateReferences().find(item => item.id === referenceId && item.format === format && item.videoUrl);
  if (!reference?.videoUrl) throw new Error("Choose a published video from this workflow's gallery.");
  const { buffer } = await downloadVideoReference(reference.videoUrl);
  const durationSeconds = readMp4DurationSeconds(buffer);
  if (durationSeconds > OMNI_EDIT_MAX_VIDEO_SECONDS) {
    throw new Error("This gallery video is longer than 10 seconds. Upload a trimmed clip up to 10 seconds to use it for generation.");
  }
  return { url: reference.videoUrl, durationSeconds };
}
