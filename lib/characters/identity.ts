import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner, type MediaAssetRow } from "@/lib/media/media-storage";
import { gatewayRetryFetch } from "@/lib/supabase/gateway-retry-fetch";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { parseCharacterHistoryCursor } from "./history";
import type { CharacterHistoryPage } from "./types";
import type { CharacterSourceJob } from "./identity-service";
import {
  CHARACTER_SOURCE,
  createCharacterIdentityService,
  serializeCharacterHistoryImage,
  type CharacterIdentityStore,
} from "./identity-service.ts";

export { CharacterIdentityError, CharacterSelectionRequestSchema } from "./identity-service.ts";
export type { PublicCharacter, TrustedCharacter } from "./identity-service.ts";

type MediaDatabase = {
  public: {
    Tables: {
      background_jobs: {
        Row: { id: string; user_id: string; job_type: CharacterSourceJob["jobType"]; status: CharacterSourceJob["status"]; input_json: CharacterSourceJob["input"]; output_json: CharacterSourceJob["output"]; output_reference: string | null; created_at: string };
        Insert: Record<string, never>; Update: Record<string, never>; Relationships: [];
      };
      media_assets: {
        Row: MediaAssetRow;
        Insert: Partial<MediaAssetRow>;
        Update: Partial<MediaAssetRow>;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<MediaDatabase> | null = null;

function getClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Character storage is not configured.");
  client ??= createClient<MediaDatabase>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: gatewayRetryFetch },
  });
  return client;
}

const store: CharacterIdentityStore = {
  getJob: (jobId, userId) => getBackgroundJobForUser({ jobId, userId }),
  getAsset: (assetId, userId) => getMediaAssetForOwner({ assetId, userId }),
  async getCandidateAsset(jobId, userId) {
    const { data, error } = await getClient().from("media_assets")
      .select("*")
      .eq("user_id", userId)
      .eq("source_type", "generated_image")
      .eq("source_record_id", jobId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(`Could not load character reference: ${error.message}`);
    return data;
  },
  async listSelectedAssets(userId) {
    const { data, error } = await getClient().from("media_assets")
      .select("*")
      .eq("user_id", userId)
      .eq("collection", "influencer")
      .eq("source_type", "generated_image")
      .eq("status", "ready")
      .is("deleted_at", null)
      .contains("metadata", { characterIdentity: { source: CHARACTER_SOURCE, version: 1 } })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`Could not list saved characters: ${error.message}`);
    return data ?? [];
  },
  async promoteCandidate({ asset, marker, name, userId }) {
    const metadata = asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
      ? asset.metadata
      : {};
    const { data, error } = await getClient().from("media_assets")
      .update({
        collection: "influencer",
        title: name,
        metadata: { ...metadata, characterIdentity: marker },
        updated_at: marker.selectedAt,
      })
      .eq("id", asset.id)
      .eq("user_id", userId)
      .eq("source_type", "generated_image")
      .eq("source_record_id", marker.jobId)
      .eq("collection", "image")
      .eq("status", "ready")
      .eq("updated_at", asset.updated_at)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`Could not save character: ${error.message}`);
    return Boolean(data);
  },
};

const service = createCharacterIdentityService(store);

export const selectCharacterForUser = service.select;
export const listCharactersForUser = service.list;
export const getCharacterForUser = service.get;

export async function listCharacterHistoryForUser(userId: string, cursorValue: string | null): Promise<CharacterHistoryPage> {
  const cursor = parseCharacterHistoryCursor(cursorValue);
  const pageSize = 25;
  let query = getClient().from("background_jobs")
    .select("id,user_id,job_type,status,input_json,output_json,output_reference,created_at")
    .eq("user_id", userId).eq("job_type", "generate_image").eq("status", "completed")
    .contains("input_json", { characterSource: CHARACTER_SOURCE })
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw new Error(`Could not list character history: ${error.message}`);
  const rows = (data ?? []).slice(0, pageSize);
  if (!rows.length) return { ok: true, images: [], nextCursor: null };
  const assets = await getClient().from("media_assets").select("*")
    .eq("user_id", userId).eq("source_type", "generated_image").eq("status", "ready")
    .in("source_record_id", rows.map((row) => row.id)).in("collection", ["image", "influencer"]).is("deleted_at", null);
  if (assets.error) throw new Error(`Could not load character history images: ${assets.error.message}`);
  const byJob = new Map((assets.data ?? []).map((asset) => [asset.source_record_id, asset]));
  const images = rows.flatMap((row) => {
    const asset = byJob.get(row.id);
    if (!asset || !isTrustedStorageUrl(asset.url)) return [];
    const image = serializeCharacterHistoryImage({
      id: row.id, userId: row.user_id, jobType: row.job_type, status: row.status,
      input: row.input_json, output: row.output_json, outputReference: row.output_reference,
    }, asset, userId);
    return image ? [image] : [];
  });
  const last = rows[rows.length - 1];
  return { ok: true, images, nextCursor: data!.length > pageSize ? JSON.stringify({ createdAt: last.created_at, id: last.id }) : null };
}
