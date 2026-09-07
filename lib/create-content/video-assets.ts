import type { MediaAsset } from "@/lib/media/types";

/**
 * Create Content deliberately works from the user's ready vertical videos.
 * It does not use Trending source selections or the daily content plan.
 */
export function isCreateContentVideo(asset: MediaAsset): boolean {
  return (
    asset.status === "ready" &&
    asset.ratio === "9:16" &&
    asset.mimeType.startsWith("video/")
  );
}

export function getCreateContentVideos(
  assets: readonly MediaAsset[],
): MediaAsset[] {
  return assets.filter(isCreateContentVideo);
}
