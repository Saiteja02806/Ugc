import { hookStartingFrameFaceReferenceLimit } from "../../worker/src/lib/hook-starting-frame-video.ts";

type StartingFrameIdentity = { assetId: string; jobId: string; referenceId: string; url: string };
type FacePhoto = { asset: { id: string; url: string } };

/** Client readiness only; the API independently verifies ownership and roles. */
export function startingFrameFaceReferenceError(model: unknown, frame: StartingFrameIdentity, photos: readonly FacePhoto[]) {
  if (!photos.length) return null;
  const limit = hookStartingFrameFaceReferenceLimit(model);
  if (!limit) return "Choose Omni Flash 1.1 to include face references with your starting frame, or remove the face photos. Your selections have been kept.";
  if (photos.length > limit) return `Use up to ${limit} face references with your starting frame. Remove an extra photo before generating.`;
  if (photos.some(photo => photo.asset.id === frame.assetId || photo.asset.url === frame.url)) return "Choose a separate clear face photo; the starting frame already supplies the opening scene.";
  if (new Set(photos.map(photo => photo.asset.id)).size !== photos.length || new Set(photos.map(photo => photo.asset.url)).size !== photos.length) return "Remove duplicate face references before generating.";
  return null;
}

/** Freeze the first-frame identity separately from optional appearance photos. */
export function startingFrameAnimationInput(frame: StartingFrameIdentity, photos: readonly FacePhoto[]) {
  return {
    startingFrameAssetId: frame.assetId,
    startingFrameJobId: frame.jobId,
    referenceId: frame.referenceId,
    ...(photos.length ? { referenceImageUrls: photos.map(photo => photo.asset.url), imageReferencePurpose: "person" as const } : {}),
  };
}
