import "server-only";
import * as mediaStore from "@/lib/media/media-storage";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { validPrivateStorageKey } from "@/lib/media/private-media-storage";

export function privateKeyForMediaUrl(value: string) {
  const bucket = process.env.GCP_PRIVATE_MEDIA_BUCKET?.trim();
  if (!bucket) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const prefix = `/${bucket}/`;
  const key = url.hostname === "storage.googleapis.com" && url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.hostname === `${bucket}.storage.googleapis.com` ? url.pathname.slice(1) : null;
  return key ? validPrivateStorageKey(decodeURIComponent(key)) : null;
}

export function isTrustedMediaReferenceUrl(value: string) {
  try { return isTrustedStorageUrl(value) || privateKeyForMediaUrl(value) !== null; }
  catch { return false; }
}

/** Resolve browser links to durable owned IDs/keys before freezing a job's input.
 * Never enqueue a five-minute bearer URL. Authentication is checked by the caller.
 */
export async function canonicalMediaReference(value: unknown, owner: string) {
  if (typeof value !== "string" || !value) return value;
  const url = new URL(value);
  const app = new URL(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://getugcpilot.com");
  const delivery = /^\/api\/media\/delivery\/([0-9a-f-]{36})$/i.exec(url.pathname);
  if (url.origin === app.origin && delivery && !url.username && !url.password) {
    if (url.searchParams.has("variant") && url.searchParams.get("variant") !== "original") {
      throw new Error("Choose the original reference, not its thumbnail.");
    }
    const row = await mediaStore.getMediaAssetForOwner({ assetId: delivery[1], userId: owner });
    if (!row || row.user_id !== owner || row.deleted_at !== null || row.status !== "ready" ||
        !isPrivateUserMedia(row) || privateKeyForMediaUrl(row.url) !== row.storage_key) throw new Error("Reference unavailable.");
    return row.url;
  }
  const key = privateKeyForMediaUrl(value);
  if (!key) return value;
  const row = await mediaStore.getReadyMediaAssetByKeyForOwner(key, owner);
  if (!row || row.user_id !== owner || row.deleted_at !== null || row.status !== "ready" ||
      !isPrivateUserMedia(row) || row.storage_key !== key || privateKeyForMediaUrl(row.url) !== key) throw new Error("Reference unavailable.");
  return row.url;
}
