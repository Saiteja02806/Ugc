import { createClient } from "@supabase/supabase-js";
import { workerMediaReadUrl } from "./private-media.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { SlideshowFaceSwap } from "./slideshow-face-swap-contract.js";

/** Reload exact owned IDs at execution, including public images; sign private media only now. */
export async function resolveSlideshowFacePhotos(selection: SlideshowFaceSwap, owner: string) {
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !secret || !owner) throw new ProviderRequestNotSubmittedError("Face photo ownership verification is unavailable.");
  const db = createClient(endpoint, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("media_assets")
    .select("id,user_id,status,deleted_at,collection,mime_type,file_size_bytes,metadata,storage_key,url")
    .eq("user_id", owner).in("id", selection.identityAssetIds).eq("status", "ready").is("deleted_at", null);
  if (error || !data || data.length !== selection.identityAssetIds.length) throw new ProviderRequestNotSubmittedError("A selected face photo is no longer available. No face replacement was submitted.");
  const ordered = selection.identityAssetIds.map((id, index) => {
    const row = data.find(row => row.id === id);
    if (!row || row.user_id !== owner || row.deleted_at !== null || row.status !== "ready" ||
        !["image", "influencer"].includes(row.collection) || !["image/png", "image/jpeg", "image/webp"].includes(row.mime_type) ||
        row.file_size_bytes != null && (!Number.isSafeInteger(row.file_size_bytes) || row.file_size_bytes <= 0 || row.file_size_bytes > 25 * 1024 * 1024) || row.url !== selection.referenceImageUrls[index]) {
      throw new ProviderRequestNotSubmittedError("A selected face photo changed or is unavailable. No face replacement was submitted.");
    }
    return row;
  });
  if (ordered.reduce((sum, row) => sum + (row.file_size_bytes ?? 0), 0) > 50 * 1024 * 1024) throw new ProviderRequestNotSubmittedError("Use face photos up to 50 MB combined.");
  return Promise.all(ordered.map(row => workerMediaReadUrl(row, owner)));
}
