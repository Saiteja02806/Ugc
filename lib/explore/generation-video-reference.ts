import "server-only";

import { downloadVideoReference, readMp4DurationSeconds, OMNI_EDIT_MAX_VIDEO_SECONDS } from "../../worker/src/lib/video-reference-input";

/** Resolve a registered clip on the server; a client URL is never an authority. */
export async function resolveGalleryGenerationVideo(referenceId: unknown, format: unknown, maxDurationSeconds: 10 | 15 | 30 = OMNI_EDIT_MAX_VIDEO_SECONDS) {
  const { getRecreateReference } = await import("./recreate-catalog");
  const reference = getRecreateReference(referenceId);
  if (!reference?.videoUrl || reference.format !== format) throw new Error("Choose a published video from this workflow's gallery.");
  const { buffer } = await downloadVideoReference(reference.videoUrl);
  const durationSeconds = readMp4DurationSeconds(buffer);
  if (durationSeconds > maxDurationSeconds) {
    throw new Error(`This gallery video is longer than ${maxDurationSeconds} seconds. Upload a trimmed clip up to ${maxDurationSeconds} seconds to use it for generation.`);
  }
  return { url: reference.videoUrl, durationSeconds };
}
