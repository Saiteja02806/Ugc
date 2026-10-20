import type { MediaAsset } from "@/lib/media/types";

export type WorkflowVideoMode = "generate" | "upload" | "assets";

/** Match the owned, playable videos shown in Creative Assets, including legacy footage. */
export function isWorkflowSourceVideo(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<MediaAsset>;
  return typeof asset.id === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(asset.id) &&
    asset.status === "ready" && (asset.collection === "video" || asset.collection === "influencer") &&
    typeof asset.mimeType === "string" && asset.mimeType.startsWith("video/") &&
    typeof asset.url === "string" && asset.url.length > 0;
}

export function workflowSourceVideoError(asset: MediaAsset): string | null {
  if (!isWorkflowSourceVideo(asset)) return "Choose a ready video from Creative Assets.";
  if (asset.fileSizeBytes !== null && asset.fileSizeBytes > 250 * 1024 * 1024) return "Choose a video up to 250 MB.";
  if (asset.durationSeconds !== null && (!Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0 || asset.durationSeconds > 120)) return "Choose a video up to 120 seconds long.";
  return null;
}
