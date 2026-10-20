import type { MediaAsset } from "./types.ts";

export const IMAGE_LIBRARY_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_LIBRARY_MAX_BYTES = 25 * 1024 * 1024;

/** Reusable user media, rather than copied catalogue references or render internals. */
export function isLibraryImage(asset: MediaAsset) {
  return asset.collection === "image" && asset.status === "ready" &&
    ["upload", "generated_image"].includes(asset.sourceType) &&
    asset.projectId !== "explore-catalog-reference" &&
    asset.metadata?.libraryVisibility !== "hook_videos_only" &&
    IMAGE_LIBRARY_TYPES.includes(asset.mimeType) && asset.url.startsWith("https://") &&
    Number.isInteger(asset.width) && Number.isInteger(asset.height) &&
    (asset.width ?? 0) > 0 && (asset.height ?? 0) > 0;
}

export function isAvailableLibraryImage(asset: MediaAsset) {
  return isLibraryImage(asset) && asset.metadata?.imageLibraryArchived !== true;
}

export type BackgroundAssignment = { slideId: string; assetId: string };

/** Freeze an explicit, deterministic plan. Repeated assets retain distinct slide IDs. */
export function planSlideshowBackgrounds(slideIds: readonly string[], imageIds: readonly string[]): BackgroundAssignment[] {
  if (!slideIds.length || slideIds.length > 10 || new Set(slideIds).size !== slideIds.length ||
    !imageIds.length || slideIds.some(id => !id) || imageIds.some(id => !id)) {
    throw new Error("Choose at least one image and a valid slideshow.");
  }
  return slideIds.map((slideId, index) => ({ slideId, assetId: imageIds[index % imageIds.length] }));
}

export function sameBackgroundTargets(current: readonly string[], captured: readonly string[]) {
  return current.length === captured.length && current.every((id, index) => id === captured[index]);
}
