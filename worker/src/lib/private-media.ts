import { Storage } from "@google-cloud/storage";
import { createClient } from "@supabase/supabase-js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";

export type PrivateMediaRow = {
  user_id: string; status: string; deleted_at: string | null;
  metadata: unknown; storage_key: string; url: string;
};

export function isPrivateMedia(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).storageLocation === "private_user_media");
}

export function privateMediaBucket() {
  const bucket = process.env.GCP_PRIVATE_MEDIA_BUCKET?.trim();
  const primary = process.env.GCP_STORAGE_BUCKET?.trim() || process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim();
  if (!bucket || bucket === primary) throw new Error("A separate private-media bucket must be configured.");
  return bucket;
}

export function validatePrivateMediaKey(key: string) {
  if (!key || key !== key.trim() || key.startsWith("/") || /[:\\\u0000-\u001f]/.test(key) ||
    key.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid private-media key.");
  return key;
}

export function privateKeyFromUrl(raw: string) {
  const bucket = process.env.GCP_PRIVATE_MEDIA_BUCKET?.trim();
  if (!bucket) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const prefix = `/${bucket}/`;
  const key = url.hostname === "storage.googleapis.com" && url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.hostname === `${bucket}.storage.googleapis.com` ? url.pathname.slice(1) : null;
  return key ? validatePrivateMediaKey(decodeURIComponent(key)) : null;
}

/** Invoke at execution, not enqueue time; never persist this bearer URL. */
export async function workerMediaReadUrl(row: PrivateMediaRow, owner: string,
  sign = async (bucket: string, key: string) => {
    const [url] = await new Storage().bucket(bucket).file(key).getSignedUrl({
      action: "read", version: "v4", expires: Date.now() + 6 * 60 * 60 * 1000,
    });
    return url;
  }) {
  if (!owner || row.user_id !== owner || row.status !== "ready" || row.deleted_at !== null) {
    throw new Error("The selected media is no longer available to this account.");
  }
  if (!isPrivateMedia(row.metadata)) return row.url;
  return sign(privateMediaBucket(), validatePrivateMediaKey(row.storage_key));
}

/** Old queue payloads retain canonical URLs; reload the owned row before signing. */
export async function resolveOwnedPrivateMediaUrl(url: string, owner: string) {
  try { return await resolvePrivateUrl(url, owner); }
  catch {
    throw new ProviderRequestNotSubmittedError("The selected private reference could not be read. No generation request was sent.");
  }
}

async function resolvePrivateUrl(url: string, owner: string) {
  const key = privateKeyFromUrl(url);
  if (!key) return url; // Existing public/catalog sources are deliberately unchanged.
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !secret || !owner) throw new Error("Owned private-media lookup is not configured.");
  const db = createClient(endpoint, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("media_assets")
    .select("user_id,status,deleted_at,metadata,storage_key,url")
    .eq("user_id", owner).eq("storage_key", key).eq("status", "ready").is("deleted_at", null).maybeSingle();
  if (error || !data || !isPrivateMedia(data.metadata)) throw new Error("The private reference is unavailable.");
  return workerMediaReadUrl(data, owner);
}
