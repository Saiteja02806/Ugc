import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PUBLISHING_PREFERENCES, type PublishingPreferences } from "./publishing-preferences";

function preferencesClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Publishing preferences storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublishingPreferences(userId: string): Promise<PublishingPreferences> {
  const { data, error } = await preferencesClient().from("user_publishing_preferences")
    .select("contains_synthetic_media").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load publishing preferences.");
  return data ? { containsSyntheticMedia: data.contains_synthetic_media === true } : { ...DEFAULT_PUBLISHING_PREFERENCES };
}

export async function savePublishingPreferences(userId: string, preferences: PublishingPreferences): Promise<PublishingPreferences> {
  const { data, error } = await preferencesClient().from("user_publishing_preferences")
    .upsert({ user_id: userId, contains_synthetic_media: preferences.containsSyntheticMedia, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("contains_synthetic_media").single();
  if (error || !data) throw new Error("Could not save publishing preferences.");
  return { containsSyntheticMedia: data.contains_synthetic_media === true };
}
