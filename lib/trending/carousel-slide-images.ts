import "server-only";

import { getMediaAssetForOwner, type MediaAssetRow } from "@/lib/media/media-storage";
import { TrendingCreativeEditAccessError } from "@/lib/trending/creative-edits";
import { CAROUSEL_SLIDE_IMAGE_PROJECT, CAROUSEL_SLIDE_IMAGE_TYPES } from "./carousel-slide-image-selection";

/** Original and catalogue images use their existing resolvers. Manual slide
 * uploads are verified under the authenticated owner on every save. */
export async function getOwnedCarouselSlideImages(assetIds: string[], userId: string) {
  const assets = await Promise.all([...new Set(assetIds)].map(assetId => getMediaAssetForOwner({ assetId, userId })));
  const images = new Map<string, MediaAssetRow>();
  for (const asset of assets) {
    if (!asset) continue;
    if (asset.user_id !== userId || asset.deleted_at || asset.collection !== "image" ||
        asset.status !== "ready" || asset.source_type !== "upload" ||
        asset.project_id !== CAROUSEL_SLIDE_IMAGE_PROJECT ||
        !CAROUSEL_SLIDE_IMAGE_TYPES.includes(asset.mime_type) ||
        !Number.isInteger(asset.width) || !Number.isInteger(asset.height) ||
        (asset.width ?? 0) <= 0 || (asset.height ?? 0) <= 0 ||
        !asset.storage_key || !asset.url.startsWith("https://")) {
      throw new TrendingCreativeEditAccessError("One of the uploaded slide images is no longer available. Upload it again before saving.", 409);
    }
    images.set(asset.id, asset);
  }
  return images;
}
