import type { HookStartingFrameSelection } from "./hook-keyframe-client";
import type { MediaAsset } from "../media/types";

export const UPLOADED_STARTING_FRAME_PROJECT = "explore-starting-frame";

export type UploadedStartingFrameSelection = Pick<HookStartingFrameSelection,
  "ownerId" | "assetId" | "url" | "width" | "height" | "durationSeconds" | "motionInstructions" | "generateAudio"> & {
  jobId?: undefined;
  draftId?: undefined;
  referenceId?: undefined;
  sourceSha256?: undefined;
  sourceDurationSeconds?: undefined;
  identityAssetIds?: undefined;
};

export type StartingFrameSelection = HookStartingFrameSelection | UploadedStartingFrameSelection;

export function uploadedStartingFrameRatio(width: number | null, height: number | null) {
  if (width == null || height == null || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width > 8192 || height > 8192) return null;
  return width > height ? "16:9" : "9:16";
}

export function isUploadedStartingFrame(asset: MediaAsset): asset is MediaAsset & { width: number; height: number } {
  return asset.collection === "image" && asset.status === "ready" && asset.sourceType === "upload" &&
    asset.projectId === UPLOADED_STARTING_FRAME_PROJECT && ["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType) &&
    Boolean(uploadedStartingFrameRatio(asset.width, asset.height));
}

export function uploadedStartingFrameSelection(asset: MediaAsset, ownerId: string): UploadedStartingFrameSelection {
  if (!isUploadedStartingFrame(asset)) throw new Error("This uploaded starting frame is unavailable.");
  return { ownerId, assetId: asset.id, url: asset.url, width: asset.width, height: asset.height,
    durationSeconds: 4, motionInstructions: "", generateAudio: false };
}
