import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import { getBackgroundJobById } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { AudioError, audioCostMicros, isAudioUuid, isVoiceEligible, parseAudioRequestKey, parseAudioSpeech, type AudioAccount, type AudioModel, type AudioRequest, type AudioVoice } from "@/worker/src/lib/audio-contract";
import { audioDb, audioRpc, privateAudioConfigured } from "@/worker/src/lib/audio-store";
import { ElevenLabsAudio, getElevenLabsApiKey, toAudioVoice } from "@/worker/src/lib/elevenlabs-audio";
import type { AudioBootstrap, AudioHistory } from "./types";
import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";
import { setPrivateAudioCredentials } from "@/worker/src/lib/audio-storage";
setPrivateAudioCredentials(() => getGoogleServiceAccountCredentials() ?? undefined);
import { publicElevenLabsCatalogue } from "./public-voice-catalogue";
import { AUDIO_UPGRADE_MESSAGE, hasAudioGenerationSubscription, type AudioGenerationAccess } from "@/worker/src/lib/audio-access-policy";

export const audioProvider = new ElevenLabsAudio();
type Catalogue = { expires: number; account: AudioAccount; voices: Awaited<ReturnType<ElevenLabsAudio["voices"]>>; defaults: Set<string>; models: AudioModel[] };
let catalogue: Catalogue | null = null;
let loadingCatalogue: Promise<Catalogue> | null = null;
function envNumber(key: string, fallback: number) { const value = Number(process.env[key]); return Number.isSafeInteger(value) && value > 0 ? value : fallback; }
export function invited(userId: string) { return process.env.NODE_ENV !== "production" || (process.env.AUDIO_GENERATION_ALLOWED_USER_IDS ?? "").split(",").map(s => s.trim()).includes(userId); }
export function enabled() { return process.env.AUDIO_GENERATION_ENABLED === "true"; }
export function assertAvailability(userId: string) {
  if (!enabled()) throw new AudioError("Audio generation is not available yet.", 503);
  if (!invited(userId) && process.env.AUDIO_GENERATION_PUBLIC_ENABLED !== "true") throw new AudioError("Audio testing is available to invited accounts.", 403);
}
async function generationAccess(userId: string): Promise<AudioGenerationAccess> {
  try {
    const subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false });
    return hasAudioGenerationSubscription(subscription) ? "allowed" : "upgrade_required";
  } catch { return "unavailable"; }
}
export async function assertPlanAccess(userId: string) {
  const access = await generationAccess(userId);
  if (access === "upgrade_required") throw new AudioError(AUDIO_UPGRADE_MESSAGE, 403);
  if (access !== "allowed") throw new AudioError("Your audio plan could not be checked. Try again shortly.", 503);
}
function canUse(userId: string, account: AudioAccount | null, access: AudioGenerationAccess) {
  return access === "allowed" && (invited(userId) || Boolean(account?.paid && process.env.AUDIO_GENERATION_PUBLIC_ENABLED === "true"));
}
export function assertRolloutAccess(userId: string, account: AudioAccount | null = null) {
  if (!enabled()) throw new AudioError("Audio generation is not available yet.", 503);
  if (!canUse(userId, account, "allowed")) throw new AudioError("Audio testing is available to invited accounts.", 403);
}
export async function getCatalogue(refresh = false): Promise<Catalogue> {
  if (!refresh && catalogue && catalogue.expires > Date.now()) return catalogue;
  if (loadingCatalogue) return loadingCatalogue;
  loadingCatalogue = (async () => {
    const [account, voices, defaultVoices, models] = await Promise.all([audioProvider.account(), audioProvider.voices(), audioProvider.voices("default"), audioProvider.models()]);
    return catalogue = { expires: Date.now() + 60000, account, voices, defaults: new Set(defaultVoices.map(v => v.voice_id)), models };
  })();
  try { return await loadingCatalogue; } finally { loadingCatalogue = null; }
}
export async function userVoices(userId: string, data: Catalogue, refreshVerification = true) {
  const { data: profiles, error } = await audioDb().from("audio_voice_profiles").select("id,name,provider_voice_id,status").eq("user_id", userId).in("status", ["ready", "verification_required"]);
  if (error) throw new AudioError("Private voices could not be loaded. Check the audio database setup.", 503);
  let verificationUpdated = false;
  const records = [...data.voices];
  if (data.account.cloning && refreshVerification) {
    await Promise.all((profiles ?? []).map(async profile => {
      const providerVoiceId = profile.provider_voice_id;
      if (profile.status !== "verification_required" || !providerVoiceId) return;
      const listedIndex = records.findIndex(voice => voice.voice_id === providerVoiceId); const listed = records[listedIndex];
      if (!listed || listed.category !== "cloned" || !isVoiceEligible({ ...listed, voice_verification: undefined }, data.account)) return;
      // Full GET metadata is fresh and read-only. An absent verification flag
      // must never be interpreted as a successfully verified private voice.
      let checked: Awaited<ReturnType<ElevenLabsAudio["voice"]>>;
      try { checked = await audioProvider.voice(providerVoiceId); } catch { return; }
      if (!checked || typeof checked !== "object") return;
      const verification = checked.voice_verification as { is_verified?: unknown; requires_verification?: unknown } | null;
      if (checked.voice_id !== providerVoiceId || checked.category !== "cloned" || verification?.is_verified !== true || verification.requires_verification !== false || !isVoiceEligible(checked, data.account)) return;
      const updated = await audioDb().from("audio_voice_profiles").update({ status: "ready", updated_at: new Date().toISOString() })
        .eq("id", profile.id).eq("user_id", userId).eq("provider_voice_id", providerVoiceId).eq("status", "verification_required").select("id").maybeSingle();
      if (!updated.error && updated.data) { profile.status = "ready"; records[listedIndex] = checked; verificationUpdated = true; }
    }));
  }
  const privateNames = new Map<string, string>((profiles ?? []).filter(p => p.status === "ready" && p.provider_voice_id).map(p => [p.provider_voice_id, p.name]));
  const approved = new Set((process.env.ELEVENLABS_ALLOWED_VOICE_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean));
  const list: AudioVoice[] = [];
  for (const voice of records) {
    const privateVoice = privateNames.has(voice.voice_id);
    if (privateVoice && !data.account.cloning) continue;
    if (!privateVoice && voice.category === "cloned") continue;
    const sharing = voice.sharing as Record<string, unknown> | null;
    const publicLibraryVoice = sharing?.status === "enabled" && sharing.enabled_in_library === true;
    if (!privateVoice && !data.defaults.has(voice.voice_id) && !(data.account.paid && approved.has(voice.voice_id) && publicLibraryVoice)) continue;
    if (voice.is_legacy === true && !privateVoice) continue;
    const item = toAudioVoice(voice, data.account, privateVoice);
    if (privateVoice) { item.name = privateNames.get(voice.voice_id)!; item.profileId = profiles?.find(p => p.provider_voice_id === voice.voice_id)?.id; }
    if (item.available) list.push(item);
  }
  return { voices: list, verificationUpdated };
}
export async function history(userId: string, requestKey?: string): Promise<AudioHistory> {
  let requests = audioDb().from("audio_generation_requests").select("id,request_key,kind,name,status,error_message,created_at,output_asset_id,voice_profile_id,test_only,credits").eq("user_id", userId);
  if (requestKey) requests = requests.eq("request_key", parseAudioRequestKey(requestKey));
  const [assetsResult, requestsResult, profilesResult] = await Promise.all([
    audioDb().from("audio_assets").select("id,name,purpose,status,duration_seconds,created_at,generation_id,test_only,cleanup_completed_at").eq("user_id", userId).or("status.neq.deleted,cleanup_completed_at.is.null").order("created_at", { ascending: false }).limit(100),
    requests.order("created_at", { ascending: false }).limit(50),
    audioDb().from("audio_voice_profiles").select("id,name,status,provider_voice_id").eq("user_id", userId),
  ]);
  if (assetsResult.error || requestsResult.error || profilesResult.error) throw new AudioError("Audio history is unavailable. Check the audio database setup.", 503);
  return { assets: (assetsResult.data ?? []).filter(a => a.status !== "deleted").map(a => ({ id: a.id, name: a.name, purpose: a.purpose, status: a.status, duration: a.duration_seconds === null ? null : Number(a.duration_seconds), createdAt: a.created_at, generationId: a.generation_id, testOnly: a.test_only })), requests: (requestsResult.data ?? []).map(r => ({ id: r.id, requestKey: r.request_key, kind: r.kind, name: r.name, status: r.status, error: r.error_message, createdAt: r.created_at, outputAssetId: r.output_asset_id, voiceProfileId: r.voice_profile_id, voiceStatus: profilesResult.data?.find(p => p.id === r.voice_profile_id)?.status ?? null, testOnly: r.test_only, credits: r.credits })), cleanupPending: [...(assetsResult.data ?? []).filter(a => a.status === "deleted" && !a.cleanup_completed_at).map(a => ({ id: a.id, name: a.name, kind: "asset" as const })), ...(profilesResult.data ?? []).filter(p => p.status === "deleted" && p.provider_voice_id).map(p => ({ id: p.id, name: p.name, kind: "voice" as const }))] };
}
export function invalidateAudioCatalogue() { catalogue=null; }
export async function getAudioBootstrapForOwner(userId: string, options: {refresh?: boolean; refreshVerification?: boolean} = {}): Promise<AudioBootstrap> {
    const planAccess = await generationAccess(userId);
    let saved: AudioHistory = { assets: [], requests: [] }; let message: string | null = null; let storageReady = false;
    try { saved = await history(userId); storageReady = privateAudioConfigured(); } catch (error) { message = error instanceof AudioError ? error.message : "Audio storage is unavailable."; }
    const configured = Boolean(getElevenLabsApiKey());
    let account: AudioAccount | null = null; let voices: AudioVoice[] = []; let models: AudioModel[] = [];
    if (configured && enabled() && storageReady) {
      try {
        const data = await getCatalogue(options.refresh === true); account = data.account; models = data.models;
        const selected = await userVoices(userId, data, options.refreshVerification !== false); voices = selected.voices;
        if (selected.verificationUpdated) saved = await history(userId);
      }
      catch (error) { message = error instanceof AudioError ? error.message : "The voice catalogue could not be loaded."; }
    }
    if (!enabled() || !configured) message = "Audio generation has not been connected yet.";
    const access = canUse(userId, account, planAccess);
    if (!access && enabled()) message = "Audio testing is available to invited accounts.";
    const canGenerate = enabled() && configured && storageReady && account !== null && access && voices.some(voice => voice.available) && models.length > 0;
    if (!message && access && configured && enabled() && account && !voices.length) message = "No eligible voices are available. Check the ElevenLabs voice catalogue and refresh.";
    let catalogueSource: AudioBootstrap["catalogueSource"] = "account";
    if (!voices.length) { voices = await publicElevenLabsCatalogue.voices(); catalogueSource = "public-preview"; }
    if (planAccess === "upgrade_required") message = AUDIO_UPGRADE_MESSAGE;
    if (planAccess === "unavailable") message = "Your audio plan could not be checked. You can still browse voices and listen to samples.";
    const result: AudioBootstrap = { ...saved, configured, enabled: enabled(), generationAccess: planAccess, storageReady, canGenerate, canClone: enabled() && configured && storageReady && access && account?.cloning === true, canUpload: enabled() && storageReady && access, message, account, voices, models, catalogueSource, creditCostPer1000: access && account?.paid && !invited(userId) ? envNumber("AUDIO_GENERATION_CREDITS_PER_1000_CHARS", 1) : 0 };
    return result;
}
export async function createRequest(userId: string, kind: string, key: string, payload: Record<string, unknown>, account: AudioAccount | null) {
  if (getMissingJobQueueEnvVars(["generate_audio"]).length) throw new AudioError("The audio worker has not been configured yet.", 503);
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind, ...payload, testOnly: undefined })).digest("hex");
  const characters = kind === "speech" ? String(payload.script).length : 0;
  const credits = account?.paid && !invited(userId) && kind === "speech" ? Math.ceil(characters / 1000) * envNumber("AUDIO_GENERATION_CREDITS_PER_1000_CHARS", 1) : 0;
  const result = await audioRpc<AudioRequest>("create_audio_generation_request", {
    p_id: randomUUID(), p_user_id: userId, p_request_key: key, p_fingerprint: fingerprint, p_kind: kind, p_payload: payload,
    p_period: account?.resetAt ? String(account.resetAt) : new Date().toISOString().slice(0, 7), p_characters: characters,
    p_cost_micros: account?.paid ? audioCostMicros(String(payload.modelId), characters) : 0,
    p_global_character_limit: envNumber("AUDIO_GENERATION_CHARACTER_LIMIT", 9000), p_user_character_limit: envNumber("AUDIO_GENERATION_USER_CHARACTER_LIMIT", 3000),
    p_cost_limit_micros: envNumber("AUDIO_GENERATION_SPEND_LIMIT_MICROS", 5000000), p_request_limit: envNumber("AUDIO_GENERATION_USER_REQUEST_LIMIT", 30), p_credits: credits,
  });
  const job = await getBackgroundJobById(result.job_id);
  if (!job || job.userId !== userId || job.jobType !== "generate_audio") throw new AudioError("The audio job could not be read.", 503);
  await dispatchQueuedBackgroundJobForRecovery(job);
  return result;
}
export async function replayRequest(userId: string, key: string, kind: string, payload: Record<string, unknown>) {
  const { data, error } = await audioDb().from("audio_generation_requests").select("*").eq("user_id", userId).eq("request_key", key).maybeSingle();
  if (error) throw new AudioError("Audio history is unavailable.", 503);
  if (!data) return null;
  const replayPayload = kind === "speech" && data.voice_profile_id ? { ...payload, privateVoiceProfileId: data.voice_profile_id } : payload;
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind, ...replayPayload, testOnly: undefined })).digest("hex");
  if (data.fingerprint !== fingerprint) throw new AudioError("This request ID was already used for different audio.", 409);
  const job = await getBackgroundJobById(data.job_id);
  if (job && (job.userId !== userId || job.jobType !== "generate_audio")) throw new AudioError("The audio job could not be read.", 503);
  if (job && enabled()) await dispatchQueuedBackgroundJobForRecovery(job);
  return data as AudioRequest;
}
export async function generateAudioForOwner(userId: string, inputBody: Record<string, unknown> | (() => Promise<Record<string, unknown>>)) {
    await assertPlanAccess(userId);
    const body = typeof inputBody === "function" ? await inputBody() : inputBody;
    const key = parseAudioRequestKey(body.requestKey); const input = parseAudioSpeech(body);
    const previous = await replayRequest(userId, key, "speech", input);
    if (previous) return { id: previous.id, status: previous.status, testOnly: previous.test_only, credits: previous.credits };
    assertAvailability(userId);
    const data = await getCatalogue(true); assertRolloutAccess(userId, data.account);
    const selectedVoice = (await userVoices(userId, data)).voices.find(v => v.id === input.voiceId);
    if (!selectedVoice) throw new AudioError("Choose one of your available voices.", 403);
    if (selectedVoice.private && !isAudioUuid(selectedVoice.profileId)) throw new AudioError("This private voice is unavailable. Refresh your voices.", 503);
    if (!data.models.some(m => m.id === input.modelId)) throw new AudioError("This speech model is unavailable.");
    if (data.account.remaining < input.script.length) throw new AudioError("The ElevenLabs allowance is too low for this script.", 429);
    const result = await createRequest(userId, "speech", key, { ...input, privateVoiceProfileId: selectedVoice.private ? selectedVoice.profileId : undefined, testOnly: !data.account.paid }, data.account);
    return { id: result.id, status: result.status, testOnly: result.test_only, credits: result.credits };
}
