import "server-only";
import type { EditableVideo } from "@/lib/edit/video-library";
import { privateKeyForMediaUrl } from "@/lib/media/media-reference";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { getMediaAssetForOwner, serializeMediaAsset } from "@/lib/media/media-storage";

/** Persist canonical source URLs; mint browser links only in authenticated responses. */
export async function withPrivateEditDelivery(video: EditableVideo, owner: string): Promise<EditableVideo> {
  if (!video.videoUrl || !privateKeyForMediaUrl(video.videoUrl)) return video;
  const asset = await getMediaAssetForOwner({ assetId: video.id, userId: owner });
  if (!asset || asset.user_id !== owner || asset.status !== "ready" || asset.deleted_at !== null ||
      !isPrivateUserMedia(asset) || privateKeyForMediaUrl(video.videoUrl) !== asset.storage_key) {
    // A removed/private source must not leak a stale URL or be replaced with a public fallback.
    return { ...video, videoUrl: null, thumbnailUrl: null };
  }
  const display = serializeMediaAsset(asset);
  return { ...video, videoUrl: display.url, thumbnailUrl: display.thumbnailUrl };
}
