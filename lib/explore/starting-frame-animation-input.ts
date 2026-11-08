import { hookStartingFrameFaceReferenceLimit, hookStartingFrameFaceReferenceRoute } from "../../worker/src/lib/hook-starting-frame-video.ts";

type StartingFrameIdentity = { assetId: string; jobId?: string; referenceId?: string; url: string };
type FacePhoto = { asset: { id: string; url: string } };

export const UNSUPPORTED_STARTING_FRAME_PHOTOS = "Identity photos can't be attached with this starting-frame model. Use the starting frame only, or choose a model that supports identity references. Your selections are kept.";

/** Client readiness only; the API independently verifies ownership and roles. */
export function startingFrameFaceReferenceError(model: unknown, frame: StartingFrameIdentity, photos: readonly FacePhoto[], mode?: "first_frame_with_identity") {
  if (mode && model !== "google_omni") return "Choose Omni Flash for the direct Gemini starting-frame and identity-photo route.";
  if (!photos.length) return null;
  const limit = hookStartingFrameFaceReferenceLimit(model, mode);
  if (!limit) return UNSUPPORTED_STARTING_FRAME_PHOTOS;
  if (photos.length > limit) return `Use up to ${limit} face references with your starting frame. Remove an extra photo before generating.`;
  if (photos.some(photo => photo.asset.id === frame.assetId || photo.asset.url === frame.url)) return "Choose a separate clear face photo; the starting frame already supplies the opening scene.";
  if (new Set(photos.map(photo => photo.asset.id)).size !== photos.length || new Set(photos.map(photo => photo.asset.url)).size !== photos.length) return "Remove duplicate face references before generating.";
  return null;
}

/** True when the selected route can carry the approved frame and the photos together. */
export function startingFrameForwardsPhotos(model: unknown, mode?: "first_frame_with_identity") {
  return hookStartingFrameFaceReferenceRoute(model, mode) === "frame_and_references";
}

/** Freeze the first-frame identity separately from optional appearance photos.
 * Kling 3.0 has one first-frame and one last-frame slot and no reference mode,
 * so it receives the approved frame alone; the photos shaped that frame. */
export function startingFrameAnimationInput(frame: StartingFrameIdentity, photos: readonly FacePhoto[], mode?: "first_frame_with_identity", model?: unknown) {
  const forwardsPhotos = photos.length > 0 && (model === undefined || startingFrameForwardsPhotos(model, mode));
  return {
    ...(mode ? { startingFrameMode: mode } : {}),
    startingFrameAssetId: frame.assetId,
    ...(frame.jobId ? { startingFrameJobId: frame.jobId, referenceId: frame.referenceId } : {}),
    ...(forwardsPhotos ? { referenceImageUrls: photos.map(photo => photo.asset.url), imageReferencePurpose: "person" as const } : {}),
  };
}
