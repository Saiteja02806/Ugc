import { createHash } from "node:crypto";
import { AUDIO_BUCKET, AUDIO_MAX_OUTPUT_BYTES, AudioError, audioObjectPrefix, isAudioUuid, isVoiceEligible, type AudioRequest } from "../lib/audio-contract.ts";
import { audioDb, audioRpc, getAudioRequest, patchAudioRequest, readPrivateAudio, savePrivateAudio } from "../lib/audio-store.ts";
import { probeAudio } from "../lib/audio-media.ts";
import { ElevenLabsAudio, ElevenLabsError, getElevenLabsApiKey } from "../lib/elevenlabs-audio.ts";
import { DeferredJobError, RetryableJobError } from "../retryable-job-error.ts";
import { assertAudioGenerationSubscription } from "../lib/audio-access.ts";
import type { BackgroundJobRow } from "../types.js";
import type { WorkerJobContext } from "./index.js";

async function startSubmission(id: string, userId: string) {
  const started = await audioRpc<boolean>("start_audio_provider_submission", { p_id: id, p_user_id: userId });
  if (!started) throw new DeferredJobError("This audio request has already been submitted or has ended.", { code: "audio_submission_already_started", retryAfterSeconds: 10 });
}

async function optionalStoredAudio(key: string) {
  const { data, error } = await audioDb().storage.from(AUDIO_BUCKET).download(key);
  if (error) {
    if (String(error.message).toLowerCase().includes("not found") || String((error as unknown as { statusCode: string }).statusCode) === "404") return null;
    throw new RetryableJobError("Saved audio could not be read yet.", { code: "audio_storage_unavailable", retryAfterSeconds: 30 });
  }
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}
async function saveReadyAsset(request: AudioRequest, bytes: Uint8Array, key: string) {
  const duration = await probeAudio(bytes);
  const { error } = await audioDb().from("audio_assets").upsert({ id: request.id, user_id: request.user_id, name: request.name, purpose: "generated", object_key: key, mime_type: "audio/mpeg", size_bytes: bytes.length, duration_seconds: duration, checksum: createHash("sha256").update(bytes).digest("hex"), status: "ready", test_only: request.test_only, generation_id: request.id });
  if (error) throw new RetryableJobError("Generated audio is saved and will be finalized shortly.", { code: "audio_finalization_pending", retryAfterSeconds: 30 });
  await patchAudioRequest(request.id, { status: "completed", output_asset_id: request.id, byte_count: bytes.length });
  return { ok: true, audioAssetId: request.id, generationId: request.id, durationSeconds: duration };
}
export async function runGenerateAudioJob(job: BackgroundJobRow, context: WorkerJobContext) {
  const input = job.input_json && typeof job.input_json === "object" && !Array.isArray(job.input_json) ? job.input_json : {};
  const id = input.audioRequestId;
  if (!isAudioUuid(id) || !job.user_id) throw new AudioError("Invalid audio job.");
  const request = await getAudioRequest(id, job.user_id);
  if (!request || request.job_id !== job.id) throw new AudioError("The audio request does not belong to this job.");
  if (request.status === "completed") return { ok: true, audioAssetId: request.output_asset_id, voiceProfileId: request.voice_profile_id, generationId: request.id };
  if (["failed", "cancelled"].includes(request.status)) throw new AudioError("This audio request has ended. Start a new generation to try again.", 409);
  await context.checkpoint({ stage: "preparing_audio", status: "processing", progress: 10 });

  if (request.kind === "upload") {
    const { data: asset, error } = await audioDb().from("audio_assets").select("*").eq("id", request.source_asset_id).eq("user_id", job.user_id).single();
    if (error || !asset) throw new AudioError("The uploaded audio is unavailable.");
    const duration = await probeAudio(await readPrivateAudio(asset.object_key));
    const { error: updateError } = await audioDb().from("audio_assets").update({ status: "ready", duration_seconds: duration, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("user_id", job.user_id);
    if (updateError) throw new RetryableJobError("Audio metadata could not be saved yet.", { code: "audio_upload_finalization_pending", retryAfterSeconds: 30 });
    await patchAudioRequest(id, { status: "completed", output_asset_id: asset.id });
    return { ok: true, audioAssetId: asset.id, generationId: id, durationSeconds: duration };
  }

  const finalKey = `${audioObjectPrefix(request.user_id, id)}/final.mp3`;
  if (request.kind === "speech" && request.provider_started_at) {
    const saved = await optionalStoredAudio(finalKey);
    if (saved) return saveReadyAsset(request, saved, finalKey);
    await patchAudioRequest(id, { status: "uncertain", error_message: "The provider may have generated this audio. It will not be submitted again automatically." });
    throw new AudioError("The audio submission is uncertain. Check its history before starting a new generation.", 409);
  }
  if (request.kind === "clone") {
    const { data: existing, error } = await audioDb().from("audio_voice_profiles").select("*").eq("id", id).eq("user_id", job.user_id).maybeSingle();
    if (error) throw new RetryableJobError("Voice creation metadata could not be read yet.", { code: "audio_voice_finalization_pending", retryAfterSeconds: 30 });
    if (existing?.provider_voice_id && existing.status !== "deleted") {
      await patchAudioRequest(id, { status: "completed", voice_profile_id: id });
      return { ok: true, voiceProfileId: id, verificationRequired: existing.status === "verification_required" };
    }
    if (request.provider_started_at) {
      await patchAudioRequest(id, { status: "uncertain", error_message: "The voice may already exist in ElevenLabs. Reconcile it before creating another clone." });
      throw new AudioError("Voice creation needs reconciliation in ElevenLabs.", 409);
    }
  }
  const acquired = await audioRpc<boolean>("claim_audio_provider", { p_request_id: id });
  if (!acquired) throw new DeferredJobError("Another audio request is running.", { code: "audio_provider_busy", retryAfterSeconds: 10 });
  const provider = new ElevenLabsAudio();
  let started = Boolean(request.provider_started_at);
  try {
    if (process.env.AUDIO_GENERATION_ENABLED !== "true") throw new AudioError("Audio generation is currently paused.", 503);
    await assertAudioGenerationSubscription(job.user_id);
    const account = await provider.account();
    if (request.kind === "clone") {
      if (!account.cloning) throw new AudioError("Instant voice cloning requires ElevenLabs Starter or above.", 403);
      if (account.voiceSlotsUsed >= account.voiceLimit || (account.operationsLimit !== null && account.operationsUsed >= account.operationsLimit)) throw new AudioError("The ElevenLabs voice creation allowance has been reached.", 429);
      const { data: asset, error } = await audioDb().from("audio_assets").select("*").eq("id", request.source_asset_id).eq("user_id", job.user_id).eq("status", "ready").eq("purpose", "reference").single();
      if (error || !asset) throw new AudioError("Choose a ready voice reference recording.");
      const bytes = await readPrivateAudio(asset.object_key);
      const { error: insertError } = await audioDb().from("audio_voice_profiles").upsert({ id, user_id: job.user_id, name: request.name, source_asset_id: asset.id, consent_at: new Date().toISOString(), status: "creating" });
      if (insertError) throw new AudioError("The private voice could not be prepared.", 503);
      await context.checkpoint({ stage: "submitting_voice", status: "processing", progress: 20 });
      await startSubmission(id, job.user_id); started = true;
      const cloneProvider = new ElevenLabsAudio(process.env.ELEVENLABS_VOICE_API_KEY?.trim() || getElevenLabsApiKey());
      const clone = await cloneProvider.clone(`${request.name} [${id}]`, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime_type }));
      const { error: saveError } = await audioDb().from("audio_voice_profiles").update({ provider_voice_id: clone.voice_id, status: clone.requires_verification ? "verification_required" : "ready" }).eq("id", id).eq("user_id", job.user_id);
      if (saveError) throw new AudioError("The created voice needs reconciliation before another attempt.", 503);
      await patchAudioRequest(id, { status: "completed", voice_profile_id: id });
      return { ok: true, voiceProfileId: id, verificationRequired: clone.requires_verification === true };
    }
    if (request.status === "uncertain") throw new AudioError("This request requires reconciliation.", 409);
    if (account.remaining < request.characters) throw new AudioError("The ElevenLabs allowance is too low for this script.", 429);
    if (request.test_only === false && !account.paid) throw new AudioError("The ElevenLabs account was downgraded. Start a new test generation.", 403);
    const voice = await provider.voice(request.voice_id!);
    if (voice.category === "cloned") {
      const { data: profile, error } = await audioDb().from("audio_voice_profiles").select("id").eq("user_id", job.user_id).eq("provider_voice_id", request.voice_id!).eq("status", "ready").maybeSingle();
      if (error || !profile || !account.cloning) throw new AudioError("This private voice is no longer available.", 403);
    }
    if (!isVoiceEligible(voice, account)) throw new AudioError("This voice is no longer available for generation.", 403);
    await context.checkpoint({ stage: "submitting_speech", status: "processing", progress: 20 });
    await startSubmission(id, job.user_id); started = true;
    const response = await provider.speech({ script: request.script, voiceId: request.voice_id!, modelId: request.model_id!, speed: request.speed });
    await patchAudioRequest(id, { provider_request_id: response.headers.get("request-id") || response.headers.get("x-request-id"), status: "streaming" });
    if (!response.body) throw new AudioError("The provider returned no audio.", 503);
    const reader = response.body.getReader(); const buffers: Uint8Array[] = []; let total = 0; let pending = Buffer.alloc(0); let count = 0;
    try {
      while (true) {
        const result = await reader.read(); if (result.done) break;
        total += result.value.length; if (total > AUDIO_MAX_OUTPUT_BYTES) throw new AudioError("The generated audio exceeded its size limit.");
        buffers.push(result.value); pending = Buffer.concat([pending, result.value]);
        if (pending.length >= 16384) {
          await savePrivateAudio(`${audioObjectPrefix(request.user_id, id)}/chunks/${count}.mp3`, pending);
          pending = Buffer.alloc(0); count++;
          await patchAudioRequest(id, { chunk_count: count, byte_count: total });
          await context.checkpoint({ stage: "generating_speech", status: "processing", progress: 45 });
        }
      }
      if (pending.length) {
        await savePrivateAudio(`${audioObjectPrefix(request.user_id, id)}/chunks/${count}.mp3`, pending); count++;
        await patchAudioRequest(id, { chunk_count: count, byte_count: total });
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    const bytes = Buffer.concat(buffers);
    await savePrivateAudio(finalKey, bytes);
    await context.checkpoint({ stage: "saving_audio", status: "uploading_output", progress: 90 });
    return await saveReadyAsset(request, bytes, finalKey);
  } catch (error) {
    if (error instanceof RetryableJobError) throw error;
    const knownRejection = error instanceof ElevenLabsError && !error.uncertain;
    if (request.kind === "clone" && (!started || knownRejection)) {
      await audioDb().from("audio_voice_profiles").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", job.user_id).is("provider_voice_id", null);
    }
    if (started && !knownRejection) await patchAudioRequest(id, { status: "uncertain", error_message: "This request may have consumed ElevenLabs allowance. It will not be generated again automatically." }).catch(() => undefined);
    else await patchAudioRequest(id, { status: "failed", error_message: error instanceof AudioError ? error.message : "Audio generation could not complete." }).catch(() => undefined);
    throw error;
  } finally {
    // The bounded lease expires by itself. A release outage must not turn a
    // durable, completed output into a failed job and a refunded credit charge.
    await audioRpc("release_audio_provider", { p_request_id: id }).catch(() => undefined);
  }
}
