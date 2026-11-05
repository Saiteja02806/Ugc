import { createClient } from "@supabase/supabase-js";
import * as privateMedia from "./private-media.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { OwnedVideoImages } from "./video-image-reference-contract.js";

/** New submissions only. Already accepted paid tasks recover without needing input media again. */
export async function resolveOwnedVideoImages(input: OwnedVideoImages, owner: string) {
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !key || !owner) throw new ProviderRequestNotSubmittedError("Image ownership verification is unavailable. No video request was submitted.");
  const db = createClient(endpoint, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("media_assets")
    .select("id,user_id,status,deleted_at,collection,mime_type,file_size_bytes,metadata,storage_key,url")
    .eq("user_id", owner).in("id", input.images.map(image => image.assetId)).eq("status", "ready").is("deleted_at", null);
  if (error || !data || data.length !== input.images.length) throw new ProviderRequestNotSubmittedError("A selected image is no longer available. No video request was submitted.");
  return Promise.all(input.images.map(async image => {
    const row = data.find(row => row.id === image.assetId);
    if (!row || row.user_id !== owner || row.status !== "ready" || row.deleted_at !== null || row.url !== image.url ||
        !["image", "influencer"].includes(row.collection) || !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(row.mime_type) ||
        row.file_size_bytes != null && (!Number.isSafeInteger(row.file_size_bytes) || row.file_size_bytes <= 0 || row.file_size_bytes > input.maxImageBytes)) throw new ProviderRequestNotSubmittedError("A selected image changed or is unavailable. No video request was submitted.");
    return privateMedia.workerMediaReadUrl(row, owner);
  }));
}
