import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getUserSubscription, BillingAccessError } from "@/lib/billing/subscription-db";
import { getBackgroundJobById } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { AUDIO_MAX_UPLOAD_BYTES, AUDIO_UPLOAD_TYPES, AudioError, audioCostMicros, audioObjectPrefix, isAudioUuid, isVoiceEligible, parseAudioRequestKey, parseAudioSpeech, type AudioAccount, type AudioModel, type AudioRequest, type AudioVoice } from "@/worker/src/lib/audio-contract";
import { audioDb, audioRpc, getAudioRequest, readPrivateAudio, savePrivateAudio } from "@/worker/src/lib/audio-store";
import { ElevenLabsAudio, getElevenLabsApiKey, toAudioVoice } from "@/worker/src/lib/elevenlabs-audio";
import type { AudioBootstrap, AudioHistory } from "./types";
import { publicElevenLabsCatalogue } from "./public-voice-catalogue";
import { AUDIO_UPGRADE_MESSAGE, hasAudioGenerationSubscription, type AudioGenerationAccess } from "@/worker/src/lib/audio-access-policy";

const provider = new ElevenLabsAudio();
type Catalogue = { expires: number; account: AudioAccount; voices: Awaited<ReturnType<ElevenLabsAudio["voices"]>>; defaults: Set<string>; models: AudioModel[] };
let catalogue: Catalogue | null = null;
let loadingCatalogue: Promise<Catalogue> | null = null;
function envNumber(key: string, fallback: number) { const value = Number(process.env[key]); return Number.isSafeInteger(value) && value > 0 ? value : fallback; }
function invited(userId: string) { return process.env.NODE_ENV !== "production" || (process.env.AUDIO_GENERATION_ALLOWED_USER_IDS ?? "").split(",").map(s => s.trim()).includes(userId); }
function enabled() { return process.env.AUDIO_GENERATION_ENABLED === "true"; }
function assertAvailability(userId: string) {
  if (!enabled()) throw new AudioError("Audio generation is not available yet.", 503);
  if (!invited(userId) && process.env.AUDIO_GENERATION_PUBLIC_ENABLED !== "true") throw new AudioError("Audio testing is available to invited accounts.", 403);
}
async function generationAccess(userId: string): Promise<AudioGenerationAccess> {
  try {
    const subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false });
    return hasAudioGenerationSubscription(subscription) ? "allowed" : "upgrade_required";
  } catch { return "unavailable"; }
}
async function assertPlanAccess(userId: string) {
  const access = await generationAccess(userId);
  if (access === "upgrade_required") throw new AudioError(AUDIO_UPGRADE_MESSAGE, 403);
  if (access !== "allowed") throw new AudioError("Your audio plan could not be checked. Try again shortly.", 503);
}
function canUse(userId: string, account: AudioAccount | null, access: AudioGenerationAccess) {
  return access === "allowed" && (invited(userId) || Boolean(account?.paid && process.env.AUDIO_GENERATION_PUBLIC_ENABLED === "true"));
}
function assertRolloutAccess(userId: string, account: AudioAccount | null = null) {
  if (!enabled()) throw new AudioError("Audio generation is not available yet.", 503);
  if (!canUse(userId, account, "allowed")) throw new AudioError("Audio testing is available to invited accounts.", 403);
}
async function getCatalogue(refresh = false): Promise<Catalogue> {
  if (!refresh && catalogue && catalogue.expires > Date.now()) return catalogue;
  if (loadingCatalogue) return loadingCatalogue;
  loadingCatalogue = (async () => {
    const [account, voices, defaultVoices, models] = await Promise.all([provider.account(), provider.voices(), provider.voices("default"), provider.models()]);
    return catalogue = { expires: Date.now() + 60000, account, voices, defaults: new Set(defaultVoices.map(v => v.voice_id)), models };
  })();
  try { return await loadingCatalogue; } finally { loadingCatalogue = null; }
}
async function userVoices(userId: string, data: Catalogue) {
  const { data: profiles, error } = await audioDb().from("audio_voice_profiles").select("id,name,provider_voice_id,status").eq("user_id", userId).in("status", ["ready", "verification_required"]);
  if (error) throw new AudioError("Private voices could not be loaded. Check the audio database setup.", 503);
  let verificationUpdated = false;
  const records = [...data.voices];
  if (data.account.cloning) {
    await Promise.all((profiles ?? []).map(async profile => {
      const providerVoiceId = profile.provider_voice_id;
      if (profile.status !== "verification_required" || !providerVoiceId) return;
      const listedIndex = records.findIndex(voice => voice.voice_id === providerVoiceId); const listed = records[listedIndex];
      if (!listed || listed.category !== "cloned" || !isVoiceEligible({ ...listed, voice_verification: undefined }, data.account)) return;
      // Full GET metadata is fresh and read-only. An absent verification flag
      // must never be interpreted as a successfully verified private voice.
      let checked: Awaited<ReturnType<ElevenLabsAudio["voice"]>>;
      try { checked = await provider.voice(providerVoiceId); } catch { return; }
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
async function history(userId: string): Promise<AudioHistory> {
  const [assetsResult, requestsResult, profilesResult] = await Promise.all([
    audioDb().from("audio_assets").select("id,name,purpose,status,duration_seconds,created_at,generation_id,test_only,cleanup_completed_at").eq("user_id", userId).or("status.neq.deleted,cleanup_completed_at.is.null").order("created_at", { ascending: false }).limit(100),
    audioDb().from("audio_generation_requests").select("id,kind,name,status,error_message,created_at,output_asset_id,voice_profile_id,test_only,credits").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    audioDb().from("audio_voice_profiles").select("id,name,status,provider_voice_id").eq("user_id", userId),
  ]);
  if (assetsResult.error || requestsResult.error || profilesResult.error) throw new AudioError("Audio history is unavailable. Check the audio database setup.", 503);
  return { assets: (assetsResult.data ?? []).filter(a => a.status !== "deleted").map(a => ({ id: a.id, name: a.name, purpose: a.purpose, status: a.status, duration: a.duration_seconds === null ? null : Number(a.duration_seconds), createdAt: a.created_at, generationId: a.generation_id, testOnly: a.test_only })), requests: (requestsResult.data ?? []).map(r => ({ id: r.id, kind: r.kind, name: r.name, status: r.status, error: r.error_message, createdAt: r.created_at, outputAssetId: r.output_asset_id, voiceProfileId: r.voice_profile_id, voiceStatus: profilesResult.data?.find(p => p.id === r.voice_profile_id)?.status ?? null, testOnly: r.test_only, credits: r.credits })), cleanupPending: [...(assetsResult.data ?? []).filter(a => a.status === "deleted" && !a.cleanup_completed_at).map(a => ({ id: a.id, name: a.name, kind: "asset" as const })), ...(profilesResult.data ?? []).filter(p => p.status === "deleted" && p.provider_voice_id).map(p => ({ id: p.id, name: p.name, kind: "voice" as const }))] };
}
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } }); }
export function audioApiError(error: unknown) {
  const known = error instanceof AudioError || error instanceof FirebaseAuthRequestError || error instanceof BillingAccessError;
  return json({ error: known ? error.message : "Audio could not be loaded. Try again shortly." }, known ? error.status : 500);
}
async function bodyObject(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AudioError("Choose valid audio settings.");
  return body as Record<string, unknown>;
}
export async function handleAudioBootstrap(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const planAccess = await generationAccess(user.uid);
    let saved: AudioHistory = { assets: [], requests: [] }; let message: string | null = null; let storageReady = false;
    try { saved = await history(user.uid); storageReady = true; } catch (error) { message = error instanceof AudioError ? error.message : "Audio storage is unavailable."; }
    const configured = Boolean(getElevenLabsApiKey());
    let account: AudioAccount | null = null; let voices: AudioVoice[] = []; let models: AudioModel[] = [];
    if (configured && enabled() && storageReady) {
      try {
        const data = await getCatalogue(new URL(request.url).searchParams.get("refresh") === "1"); account = data.account; models = data.models;
        const selected = await userVoices(user.uid, data); voices = selected.voices;
        if (selected.verificationUpdated) saved = await history(user.uid);
      }
      catch (error) { message = error instanceof AudioError ? error.message : "The voice catalogue could not be loaded."; }
    }
    if (!enabled() || !configured) message = "Audio generation has not been connected yet.";
    const access = canUse(user.uid, account, planAccess);
    if (!access && enabled()) message = "Audio testing is available to invited accounts.";
    const canGenerate = enabled() && configured && storageReady && account !== null && access && voices.some(voice => voice.available) && models.length > 0;
    if (!message && access && configured && enabled() && account && !voices.length) message = "No eligible voices are available. Check the ElevenLabs voice catalogue and refresh.";
    let catalogueSource: AudioBootstrap["catalogueSource"] = "account";
    if (!voices.length) { voices = await publicElevenLabsCatalogue.voices(); catalogueSource = "public-preview"; }
    if (planAccess === "upgrade_required") message = AUDIO_UPGRADE_MESSAGE;
    if (planAccess === "unavailable") message = "Your audio plan could not be checked. You can still browse voices and listen to samples.";
    const result: AudioBootstrap = { ...saved, configured, enabled: enabled(), generationAccess: planAccess, storageReady, canGenerate, canClone: enabled() && configured && storageReady && access && account?.cloning === true, canUpload: enabled() && storageReady && access, message, account, voices, models, catalogueSource, creditCostPer1000: access && account?.paid && !invited(user.uid) ? envNumber("AUDIO_GENERATION_CREDITS_PER_1000_CHARS", 1) : 0 };
    return json(result);
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioHistory(request: Request) { try { const user = await requireFirebaseUser(request); return json(await history(user.uid)); } catch (error) { return audioApiError(error); } }
async function createRequest(userId: string, kind: string, key: string, payload: Record<string, unknown>, account: AudioAccount | null) {
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
async function replayRequest(userId: string, key: string, kind: string, payload: Record<string, unknown>) {
  const { data, error } = await audioDb().from("audio_generation_requests").select("*").eq("user_id", userId).eq("request_key", key).maybeSingle();
  if (error) throw new AudioError("Audio history is unavailable.", 503);
  if (!data) return null;
  const replayPayload = kind === "speech" && data.voice_profile_id ? { ...payload, privateVoiceProfileId: data.voice_profile_id } : payload;
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind, ...replayPayload, testOnly: undefined })).digest("hex");
  if (data.fingerprint !== fingerprint) throw new AudioError("This request ID was already used for different audio.", 409);
  const job = await getBackgroundJobById(data.job_id);
  if (job && enabled()) await dispatchQueuedBackgroundJobForRecovery(job);
  return data as AudioRequest;
}
export async function handleAudioGeneration(request: Request) {
  try {
    const user = await requireFirebaseUser(request); await assertPlanAccess(user.uid); const body = await bodyObject(request);
    const key = parseAudioRequestKey(body.requestKey); const input = parseAudioSpeech(body);
    const previous = await replayRequest(user.uid, key, "speech", input);
    if (previous) return json({ id: previous.id, status: previous.status, testOnly: previous.test_only, credits: previous.credits }, 202);
    assertAvailability(user.uid);
    const data = await getCatalogue(true); assertRolloutAccess(user.uid, data.account);
    const selectedVoice = (await userVoices(user.uid, data)).voices.find(v => v.id === input.voiceId);
    if (!selectedVoice) throw new AudioError("Choose one of your available voices.", 403);
    if (selectedVoice.private && !isAudioUuid(selectedVoice.profileId)) throw new AudioError("This private voice is unavailable. Refresh your voices.", 503);
    if (!data.models.some(m => m.id === input.modelId)) throw new AudioError("This speech model is unavailable.");
    if (data.account.remaining < input.script.length) throw new AudioError("The ElevenLabs allowance is too low for this script.", 429);
    const result = await createRequest(user.uid, "speech", key, { ...input, privateVoiceProfileId: selectedVoice.private ? selectedVoice.profileId : undefined, testOnly: !data.account.paid }, data.account);
    return json({ id: result.id, status: result.status, testOnly: result.test_only, credits: result.credits }, 202);
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioUpload(request: Request) {
  try {
    const user = await requireFirebaseUser(request); await assertPlanAccess(user.uid); assertAvailability(user.uid); assertRolloutAccess(user.uid, invited(user.uid) ? null : await provider.account());
    if (getMissingJobQueueEnvVars(["generate_audio"]).length) throw new AudioError("The audio worker has not been configured yet.", 503);
    const length = Number(request.headers.get("content-length") ?? 0); if (length > AUDIO_MAX_UPLOAD_BYTES + 16384) throw new AudioError("Audio files must be smaller than 3 MB.", 413);
    const form = await request.formData(); const file = form.get("file"); const purpose = form.get("purpose"); const key = parseAudioRequestKey(form.get("requestKey"));
    if (!(file instanceof File) || file.size < 32 || file.size > AUDIO_MAX_UPLOAD_BYTES || !AUDIO_UPLOAD_TYPES.includes(file.type)) throw new AudioError("Choose an MP3, WAV, M4A, OGG or WebM audio file smaller than 3 MB.");
    if (purpose !== "reference" && purpose !== "exact") throw new AudioError("Choose how this recording will be used.");
    const bytes = new Uint8Array(await file.arrayBuffer()); const checksum = createHash("sha256").update(bytes).digest("hex");
    // Separate attempts cannot overwrite a winning upload before the database
    // establishes ownership of its idempotency key.
    const assetId = key; const name = file.name.slice(0, 100); const objectKey = `${audioObjectPrefix(user.uid, assetId)}/recording-${randomUUID()}`;
    const initial = await audioDb().from("audio_assets").select("*").eq("id", assetId).maybeSingle();
    let existing = initial.data; const readError = initial.error; let createdHere = false;
    if (readError) throw new AudioError("Audio uploads are unavailable.", 503);
    if (existing && (existing.user_id !== user.uid || existing.checksum !== checksum || existing.purpose !== purpose)) throw new AudioError("This upload ID already belongs to another recording.", 409);
    if (!existing) {
      await savePrivateAudio(objectKey, bytes, file.type);
      const { error } = await audioDb().from("audio_assets").insert({ id: assetId, user_id: user.uid, name, purpose, object_key: objectKey, mime_type: file.type, size_bytes: bytes.length, checksum, status: "processing", test_only: false });
      if (error) {
        // Recover a concurrent winner or an insert whose response was lost.
        // Remove only this attempt's unreferenced object, never the winner's.
        const settled = await audioDb().from("audio_assets").select("*").eq("id", assetId).maybeSingle();
        if (settled.error) throw new AudioError("The audio upload could not be saved.", 503);
        if (settled.data?.object_key !== objectKey) await audioDb().storage.from("private-audio").remove([objectKey]);
        if (!settled.data) throw new AudioError("The audio upload could not be saved.", 503);
        if (settled.data.user_id !== user.uid || settled.data.checksum !== checksum || settled.data.purpose !== purpose) throw new AudioError("This upload ID already belongs to another recording.", 409);
        existing = settled.data;
      }
      createdHere = !error || existing?.object_key === objectKey;
    }
    let result: AudioRequest;
    try { result = await createRequest(user.uid, "upload", key, { name, sourceAssetId: assetId, purpose, checksum, testOnly: false }, null); }
    catch (error) {
      // A quota rejection should not leave a new upload consuming storage. Keep
      // the file if the RPC committed but its response/dispatch was interrupted.
      if (createdHere) {
        const lookup = await audioDb().from("audio_generation_requests").select("id").eq("user_id", user.uid).eq("request_key", key).maybeSingle();
        if (!lookup.error && !lookup.data) {
          const removed = await audioDb().from("audio_assets").delete().eq("id", assetId).eq("user_id", user.uid);
          if (!removed.error) await audioDb().storage.from("private-audio").remove([objectKey]);
        }
      }
      throw error;
    }
    return json({ id: result.id, assetId }, 202);
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioClone(request: Request) {
  try {
    const user = await requireFirebaseUser(request); await assertPlanAccess(user.uid); const body = await bodyObject(request); const key = parseAudioRequestKey(body.requestKey);
    if (!isAudioUuid(body.assetId) || body.consent !== true || typeof body.name !== "string" || !body.name.trim()) throw new AudioError("Choose a reference recording, name the voice and confirm permission.");
    const payload = { sourceAssetId: body.assetId, name: body.name.trim().slice(0, 100), consent: true, testOnly: false };
    const previous = await replayRequest(user.uid, key, "clone", payload);
    if (previous) return json({ id: previous.id, voiceProfileId: previous.voice_profile_id }, 202);
    assertAvailability(user.uid);
    const account = await provider.account(); assertRolloutAccess(user.uid, account);
    if (!account.cloning) throw new AudioError("Voice references require ElevenLabs Starter or above.", 403);
    const { data: asset } = await audioDb().from("audio_assets").select("id").eq("id", body.assetId).eq("user_id", user.uid).eq("status", "ready").eq("purpose", "reference").maybeSingle();
    if (!asset) throw new AudioError("Choose a ready reference recording.");
    const { data: existing } = await audioDb().from("audio_voice_profiles").select("id").eq("source_asset_id", asset.id).eq("user_id", user.uid).eq("status", "ready").maybeSingle();
    if (existing) return json({ voiceProfileId: existing.id, reused: true });
    const result = await createRequest(user.uid, "clone", key, payload, account);
    return json({ id: result.id, voiceProfileId: result.voice_profile_id }, 202);
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioAsset(request: Request, assetId: string) {
  try {
    const user = await requireFirebaseUser(request); if (!isAudioUuid(assetId)) throw new AudioError("Audio not found.", 404);
    const { data: asset, error } = await audioDb().from("audio_assets").select("*").eq("id", assetId).eq("user_id", user.uid).eq("status", "ready").maybeSingle();
    if (error || !asset) throw new AudioError("Audio not found.", 404);
    const bytes = await readPrivateAudio(asset.object_key); let start = 0; let end = bytes.length - 1; let status = 200;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range); if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } }); status = 206;
    }
    const extension = asset.mime_type.includes("wav") ? "wav" : asset.mime_type.includes("mp4") || asset.mime_type.includes("m4a") ? "m4a" : asset.mime_type.includes("ogg") ? "ogg" : asset.mime_type.includes("webm") ? "webm" : "mp3";
    const download = new URL(request.url).searchParams.get("download") === "1";
    const headers = { "Content-Type": asset.mime_type, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asset.test_only ? "free-test-" : ""}audio.${extension}"`, ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}) };
    return new Response(bytes.slice(start, end + 1) as Uint8Array<ArrayBuffer>, { status, headers });
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioStream(request: Request, requestId: string) {
  try {
    const user = await requireFirebaseUser(request); if (!isAudioUuid(requestId)) throw new AudioError("Generation not found.", 404);
    const found = await getAudioRequest(requestId, user.uid); if (!found || found.kind !== "speech") throw new AudioError("Generation not found.", 404);
    let stopped = false; let next = 0; const deadline = Date.now() + 110000;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (!stopped && !request.signal.aborted && Date.now() < deadline) {
            const current = await getAudioRequest(requestId, user.uid); if (!current) throw new AudioError("Generation not found.", 404);
            while (next < current.chunk_count && !stopped && !request.signal.aborted) {
              controller.enqueue(await readPrivateAudio(`${audioObjectPrefix(user.uid, requestId)}/chunks/${next}.mp3`)); next++;
            }
            if (["completed","failed","uncertain","cancelled"].includes(current.status)) {
              if (current.status !== "completed") throw new AudioError("Audio generation did not complete.");
              if (!stopped) controller.close(); return;
            }
            await new Promise(resolve => setTimeout(resolve, 600));
          }
          if (!stopped) controller.close();
        } catch (error) { if (!stopped) controller.error(error); }
      },
      cancel() { stopped = true; },
    });
    return new Response(stream, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return audioApiError(error); }
}
export async function handleDeleteAudioVoice(request: Request, voiceId: string) {
  try {
    const user = await requireFirebaseUser(request); if (!isAudioUuid(voiceId)) throw new AudioError("Voice not found.", 404);
    const profile = await audioRpc<{ id: string; provider_voice_id: string | null }>("retire_audio_voice", { p_id: voiceId, p_user_id: user.uid });
    catalogue = null;
    if (profile.provider_voice_id) {
      const manager = new ElevenLabsAudio(process.env.ELEVENLABS_VOICE_API_KEY?.trim() || getElevenLabsApiKey());
      try { await manager.deleteVoice(profile.provider_voice_id); }
      catch (error) { if (!(error instanceof AudioError && error.status === 404)) throw new AudioError("The voice is hidden. Retry removal to finish deleting it from ElevenLabs.", 503); }
      const { error: updateError } = await audioDb().from("audio_voice_profiles").update({ provider_voice_id: null }).eq("id", voiceId).eq("user_id", user.uid).eq("status", "deleted").eq("provider_voice_id", profile.provider_voice_id);
      if (updateError) throw new AudioError("The voice is hidden and removed from ElevenLabs. Retry removal to finish updating its history.", 503);
    }
    return json({ deleted: true });
  } catch (error) { return audioApiError(error); }
}
export async function handleDeleteAudioAsset(request: Request, assetId: string) {
  try {
    const user = await requireFirebaseUser(request); if (!isAudioUuid(assetId)) throw new AudioError("Audio not found.", 404);
    const retired = await audioRpc<{ asset: { id: string; object_key: string; generation_id: string | null; cleanup_completed_at: string | null }; chunk_count: number }>("retire_audio_asset", { p_id: assetId, p_user_id: user.uid });
    const asset = retired.asset;
    if (asset.cleanup_completed_at) return json({ deleted: true });
    const keys = [asset.object_key];
    if (asset.generation_id) {
      for (let index = 0; index < retired.chunk_count; index++) keys.push(`${audioObjectPrefix(user.uid, asset.generation_id)}/chunks/${index}.mp3`);
    }
    const removed = await audioDb().storage.from("private-audio").remove(keys);
    if (removed.error) throw new AudioError("The recording is hidden. Retry removal to finish deleting its files.", 503);
    const updated = await audioDb().from("audio_assets").update({ cleanup_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", assetId).eq("user_id", user.uid).eq("status", "deleted");
    if (updated.error) throw new AudioError("The recording is hidden and its files were removed. Retry removal to finish updating its history.", 503);
    return json({ deleted: true });
  } catch (error) { return audioApiError(error); }
}
