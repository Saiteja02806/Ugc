export const AUDIO_BUCKET = "private-audio";
export const AUDIO_MAX_CHARACTERS = 1500;
export const AUDIO_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const AUDIO_MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
export const AUDIO_UPLOAD_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm"];
export const AUDIO_MODEL_IDS = ["eleven_flash_v2_5", "eleven_multilingual_v2"] as const;
export type AudioRequestKind = "speech" | "clone" | "upload";
export type AudioVoice = { id: string; name: string; description: string; previewUrl: string | null; labels: Record<string, string>; category: string; private: boolean; available: boolean; profileId?: string };
export type AudioModel = { id: string; name: string; languages: string[] };
export type AudioAccount = { tier: string; paid: boolean; remaining: number; resetAt: number | null; cloning: boolean; voiceSlotsUsed: number; voiceLimit: number; operationsUsed: number; operationsLimit: number | null };
export type AudioAsset = { id: string; name: string; purpose: "generated" | "exact" | "reference"; status: string; duration: number | null; createdAt: string; generationId: string | null; testOnly: boolean };
export type AudioRequest = { id: string; user_id: string; job_id: string; kind: AudioRequestKind; request_key: string; fingerprint: string; status: string; script: string; voice_id: string | null; model_id: string | null; speed: number; name: string; source_asset_id: string | null; output_asset_id: string | null; voice_profile_id: string | null; provider_request_id: string | null; provider_started_at: string | null; chunk_count: number; byte_count: number; error_message: string | null; test_only: boolean; quota_period: string; characters: number; cost_micros: number; credits: number; usage_released: boolean; created_at: string };

export class AudioError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "audio_error") { super(message); this.name = "AudioError"; }
}
export function parseAudioSpeech(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const script = typeof input.script === "string" ? input.script.trim() : "";
  const voiceId = typeof input.voiceId === "string" ? input.voiceId : "";
  const modelId = typeof input.modelId === "string" ? input.modelId : "";
  const speed = input.speed === undefined ? 1 : input.speed;
  if (!script || script.length > AUDIO_MAX_CHARACTERS) throw new AudioError(`Enter between 1 and ${AUDIO_MAX_CHARACTERS} characters.`);
  if (!/^[\w-]{1,100}$/.test(voiceId)) throw new AudioError("Choose an available voice.");
  if (!(AUDIO_MODEL_IDS as readonly string[]).includes(modelId)) throw new AudioError("Choose an available speech model.");
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.8 || speed > 1.2) throw new AudioError("Speech speed must be between 0.8 and 1.2.");
  return { script, voiceId, modelId, speed, name: typeof input.name === "string" ? input.name.trim().slice(0, 100) || "Untitled audio" : "Untitled audio" };
}
export function isAudioUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function parseAudioRequestKey(value: unknown) { if (!isAudioUuid(value)) throw new AudioError("A valid generation request ID is required."); return value; }
export function resolveAudioAccount(value: Record<string, unknown>): AudioAccount {
  const tier = typeof value.tier === "string" ? value.tier : "free";
  const paid = tier !== "free" && value.status === "active";
  return { tier, paid, remaining: Math.max(0, Number(value.character_limit ?? 0) - Number(value.character_count ?? 0)), resetAt: typeof value.next_character_count_reset_unix === "number" ? value.next_character_count_reset_unix : null, cloning: paid && value.can_use_instant_voice_cloning === true, voiceSlotsUsed: Number(value.voice_slots_used ?? 0), voiceLimit: Number(value.voice_limit ?? 0), operationsUsed: Number(value.voice_add_edit_counter ?? 0), operationsLimit: typeof value.max_voice_add_edits === "number" ? value.max_voice_add_edits : null };
}
export function isVoiceEligible(voice: Record<string, unknown>, account: AudioAccount, now = Date.now()) {
  const sharing = voice.sharing as Record<string, unknown> | null;
  const verification = voice.voice_verification as Record<string, unknown> | null;
  if (verification?.requires_verification === true || sharing?.live_moderation_enabled === true) return false;
  if (Number(sharing?.disable_at_unix ?? 0) > 0 && Number(sharing?.disable_at_unix) * 1000 <= now) return false;
  if (sharing?.review_status && sharing.review_status !== "allowed") return false;
  if (Number(sharing?.rate ?? 0) > 0) return false; // Custom-rate voices require a separately reviewed quote.
  const tiers = Array.isArray(voice.available_for_tiers) ? voice.available_for_tiers : [];
  return tiers.length === 0 || tiers.includes(account.tier);
}
export function audioCostMicros(model: string, characters: number) { return characters * (model === "eleven_flash_v2_5" ? 50 : 100); }
export function audioObjectPrefix(userId: string, id: string) { return `${encodeURIComponent(userId)}/${id}`; }
