import type { MediaSourceType } from "@/lib/media/types";

type MediaLibraryVisibilityCandidate = {
  metadata: unknown;
  sourceType: MediaSourceType;
};

export function isMediaAssetVisibleInMediaList(
  asset: MediaLibraryVisibilityCandidate & { status: string },
  purpose: string | null,
) {
  return (purpose === "scheduling" && ["reaction_render", "demo_upload"].includes(asset.sourceType) && asset.status === "ready") ||
    isMediaAssetVisibleInCreativeLibrary(asset);
}

export function isMediaAssetVisibleInCreativeLibrary(
  asset: MediaLibraryVisibilityCandidate,
) {
  if (
    asset.sourceType === "catalog_influencer" ||
    asset.sourceType === "demo_upload" ||
    asset.sourceType === "combined_render" ||
    asset.sourceType === "wall_text_render" ||
    asset.sourceType === "reaction_render"
  ) {
    return false;
  }

  const metadata =
    asset.metadata &&
    typeof asset.metadata === "object" &&
    !Array.isArray(asset.metadata)
      ? (asset.metadata as Record<string, unknown>)
      : null;

  return metadata?.libraryVisibility !== "hook_videos_only" && metadata?.imageLibraryArchived !== true;
}
