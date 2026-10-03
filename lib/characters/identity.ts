import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner, type MediaAssetRow } from "@/lib/media/media-storage";
import { gatewayRetryFetch } from "@/lib/supabase/gateway-retry-fetch";
import {
  CHARACTER_SOURCE,
  createCharacterIdentityService,
  type CharacterIdentityStore,
} from "./identity-service.ts";

export { CharacterIdentityError, CharacterSelectionRequestSchema } from "./identity-service.ts";
export type { PublicCharacter, TrustedCharacter } from "./identity-service.ts";

type MediaDatabase = {
  public: {
    Tables: {
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
