import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AudioError, type AudioRequest } from "./audio-contract.ts";

let client: SupabaseClient | null = null;
export function audioDb() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new AudioError("Audio storage has not been configured.", 503);
  return client ??= createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
export async function audioRpc<T>(name: string, args: Record<string, unknown>) {
  const { data, error } = await audioDb().rpc(name, args);
  if (error) {
    const code = error.message;
    if (code.includes("audio_quota_exceeded")) throw new AudioError("The audio testing allowance has been reached.", 429);
    if (code.includes("audio_request_conflict")) throw new AudioError("This request ID was already used for different audio.", 409);
    if (code.includes("audio_voice_not_found")) throw new AudioError("Voice not found.", 404);
    if (code.includes("audio_asset_not_found")) throw new AudioError("Audio not found.", 404);
    if (code.includes("audio_voice_in_use")) throw new AudioError("This voice has an active request or needs review. Check its activity first.", 409);
    if (code.includes("audio_asset_in_use")) throw new AudioError("This recording is still in use or needs review. Remove its voice or finish the active request first.", 409);
    if (code.includes("audio_source_invalid") || code.includes("audio_voice_unavailable")) throw new AudioError("This recording or private voice is no longer available. Refresh your library.", 409);
    if (code.includes("insufficient_billing_credits")) throw new AudioError("There are not enough generation credits.", 402);
    throw new AudioError("Audio could not be saved. Check the audio database setup.", 503, "audio_storage_error");
  }
  return data as T;
}
export async function getAudioRequest(id: string, userId: string) {
  const { data, error } = await audioDb().from("audio_generation_requests").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new AudioError("Audio history could not be loaded.", 503);
  return data as AudioRequest | null;
}
export async function patchAudioRequest(id: string, patch: Record<string, unknown>) {
  const { error } = await audioDb().from("audio_generation_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new AudioError("Audio progress could not be saved.", 503);
}
export { savePrivateAudio, readPrivateAudio, readOptionalPrivateAudio, deletePrivateAudio, privateAudioConfigured } from "./audio-storage.ts";
