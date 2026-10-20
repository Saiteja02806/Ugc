import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gatewayRetryFetch } from "@/lib/supabase/gateway-retry-fetch";
import { createCharacterPreferenceService, type CharacterPreferenceRow, type CharacterPreferenceStore } from "./preferences-service.ts";

export { CharacterPreferenceError, CharacterPreferenceRequestSchema } from "./preferences-service.ts";
export type { CharacterPreference, CharacterPreferenceRequest } from "./preferences-service.ts";

type PreferenceDatabase = {
  public: {
    Tables: {
      character_preferences: {
        Row: CharacterPreferenceRow;
        Insert: { user_id: string; gender?: "male" | "female" | null; seen_at?: string };
        Update: { gender?: "male" | "female" | null; seen_at?: string };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<PreferenceDatabase> | null = null;

function getClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Character preferences are not configured.");
  client ??= createClient<PreferenceDatabase>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: gatewayRetryFetch },
  });
  return client;
}

const store: CharacterPreferenceStore = {
  async get(userId) {
    const { data, error } = await getClient().from("character_preferences")
      .select("user_id,gender,seen_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Could not read character preference: ${error.message}`);
    return data;
  },
  async markSeen(userId) {
    // A delayed skip from another tab must never erase an already saved gender.
    const { error } = await getClient().from("character_preferences")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`Could not mark character preference seen: ${error.message}`);
  },
  async saveGender(userId, gender) {
    // Omitting seen_at retains the initial onboarding timestamp on conflict.
    const { error } = await getClient().from("character_preferences")
      .upsert({ user_id: userId, gender }, { onConflict: "user_id" });
    if (error) throw new Error(`Could not save character gender: ${error.message}`);
  },
};

const service = createCharacterPreferenceService(store);
export const getCharacterPreferenceForUser = service.get;
export const saveCharacterPreferenceForUser = service.save;
