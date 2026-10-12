import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PUBLISHING_PREFERENCES, parsePublishingPreferences, type PublishingPreferences, type PublishingPreferencesUpdate } from "./publishing-preferences";

const preferenceColumns = "contains_synthetic_media,tiktok_privacy_level,tiktok_allow_comments,youtube_privacy_status,youtube_made_for_kids,youtube_notify_subscribers";

function readPreferences(data: Record<string, unknown>): PublishingPreferences {
  return parsePublishingPreferences({
    containsSyntheticMedia: data.contains_synthetic_media,
    tiktokPrivacyLevel: data.tiktok_privacy_level,
    tiktokAllowComments: data.tiktok_allow_comments,
    youtubePrivacyStatus: data.youtube_privacy_status,
    youtubeMadeForKids: data.youtube_made_for_kids,
    youtubeNotifySubscribers: data.youtube_notify_subscribers,
  });
}

function preferencesClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Publishing preferences storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublishingPreferences(userId: string): Promise<PublishingPreferences> {
  const { data, error } = await preferencesClient().from("user_publishing_preferences")
    .select(preferenceColumns).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load publishing preferences.");
  return data ? readPreferences(data) : { ...DEFAULT_PUBLISHING_PREFERENCES };
}

export async function savePublishingPreferences(userId: string, preferences: PublishingPreferencesUpdate): Promise<PublishingPreferences> {
  // Only update submitted columns so an older AI-only client cannot reset
  // visibility or audience choices saved in the new Settings screen.
  const values = {
    user_id: userId,
    ...(preferences.containsSyntheticMedia !== undefined ? { contains_synthetic_media: preferences.containsSyntheticMedia } : {}),
    ...(preferences.tiktokPrivacyLevel !== undefined ? { tiktok_privacy_level: preferences.tiktokPrivacyLevel } : {}),
    ...(preferences.tiktokAllowComments !== undefined ? { tiktok_allow_comments: preferences.tiktokAllowComments } : {}),
    ...(preferences.youtubePrivacyStatus !== undefined ? { youtube_privacy_status: preferences.youtubePrivacyStatus } : {}),
    ...(preferences.youtubeMadeForKids !== undefined ? { youtube_made_for_kids: preferences.youtubeMadeForKids } : {}),
    ...(preferences.youtubeNotifySubscribers !== undefined ? { youtube_notify_subscribers: preferences.youtubeNotifySubscribers } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await preferencesClient().from("user_publishing_preferences")
    .upsert(values, { onConflict: "user_id", defaultToNull: false })
    .select(preferenceColumns).single();
  if (error || !data) throw new Error("Could not save publishing preferences.");
  return readPreferences(data);
}
