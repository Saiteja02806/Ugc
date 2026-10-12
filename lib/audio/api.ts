import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { BillingAccessError } from "@/lib/billing/subscription-db";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { AUDIO_MAX_UPLOAD_BYTES, AUDIO_UPLOAD_TYPES, AudioError, audioObjectPrefix, isAudioUuid, parseAudioRequestKey, type AudioRequest } from "@/worker/src/lib/audio-contract";
import { audioDb, audioRpc, getAudioRequest, readPrivateAudio, savePrivateAudio, deletePrivateAudio } from "@/worker/src/lib/audio-store";
import { ElevenLabsAudio, getElevenLabsApiKey } from "@/worker/src/lib/elevenlabs-audio";
import { audioProvider as provider, invited, assertPlanAccess, assertAvailability, assertRolloutAccess, history,
  createRequest, replayRequest, getAudioBootstrapForOwner, generateAudioForOwner, invalidateAudioCatalogue } from "./service";
export { getAudioBootstrapForOwner, generateAudioForOwner } from "./service";
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
    return json(await getAudioBootstrapForOwner(user.uid, {refresh: new URL(request.url).searchParams.get("refresh") === "1"}));
  } catch (error) { return audioApiError(error); }
}
export async function handleAudioHistory(request: Request) { try { const user = await requireFirebaseUser(request); return json(await history(user.uid, new URL(request.url).searchParams.get("requestKey") ?? undefined)); } catch (error) { return audioApiError(error); } }
export async function handleAudioGeneration(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    return json(await generateAudioForOwner(user.uid, () => bodyObject(request)), 202);
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
        if (settled.data?.object_key !== objectKey) await deletePrivateAudio([objectKey]);
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
          if (!removed.error) await deletePrivateAudio([objectKey]);
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
    if (new URL(request.url).searchParams.get("forExplore") === "1" && (asset.test_only || asset.purpose === "reference")) throw new AudioError("Choose commercial audio, not a free test or private voice recording.", 403);
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
    invalidateAudioCatalogue();
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
    try { await deletePrivateAudio(keys); }
    catch { throw new AudioError("The recording is hidden. Retry removal to finish deleting its files.", 503); }
    const updated = await audioDb().from("audio_assets").update({ cleanup_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", assetId).eq("user_id", user.uid).eq("status", "deleted");
    if (updated.error) throw new AudioError("The recording is hidden and its files were removed. Retry removal to finish updating its history.", 503);
    return json({ deleted: true });
  } catch (error) { return audioApiError(error); }
}
