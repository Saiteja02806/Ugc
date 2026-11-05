import "server-only";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { resolveOwnedPrivateMediaUrl } from "@/worker/src/lib/private-media.ts";
import { downloadReferenceImageBytes } from "@/worker/src/lib/reference-image-download.ts";

/** Missing legacy size metadata is verified from bytes before planning/credit admission. */
export async function validateVideoImage(asset: MediaAssetRow | null | undefined, owner: string, url: string, maxBytes: number) {
  if (!asset || asset.user_id !== owner || asset.url !== url || asset.deleted_at !== null || asset.status !== "ready" ||
      !["image", "influencer"].includes(asset.collection) || !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(asset.mime_type)) return false;
  if (asset.file_size_bytes != null) return Number.isSafeInteger(asset.file_size_bytes) && asset.file_size_bytes > 0 && asset.file_size_bytes <= maxBytes;
  try {
    const readable = await resolveOwnedPrivateMediaUrl(url, owner);
    const bytes = await downloadReferenceImageBytes(readable, maxBytes);
    return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(bytes.contentType);
  } catch { return false; }
}
