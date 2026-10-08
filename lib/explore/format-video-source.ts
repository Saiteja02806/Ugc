import type { AIStudioVideoResult } from "../ai-studio/media-results.ts";
import type { MediaAsset } from "../media/types.ts";
import { workflowSourceVideoError } from "./workflow-source-video.ts";

export type FormatVideoSource = AIStudioVideoResult & { width?: number | null; height?: number | null };

/** The owned-media endpoint verifies ownership; every ready video source can be edited. */
export function formatVideoFromAsset(asset: MediaAsset): FormatVideoSource {
  const problem = workflowSourceVideoError(asset);
  if (problem) throw new Error(problem);
  if (asset.durationSeconds !== null && asset.durationSeconds < 1) throw new Error("Choose a video at least 1 second long.");
  return { id: asset.id, mediaAssetId: asset.id, createdAt: asset.createdAt, durationSeconds: asset.durationSeconds,
    ratio: asset.ratio === "other" ? "9:16" : asset.ratio, width: asset.width, height: asset.height,
    modelLabel: null, resolution: null, thumbnailUrl: asset.thumbnailUrl, status: "Ready", title: asset.title || "Your video", prompt: "", url: asset.url };
}
