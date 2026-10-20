import "server-only";

import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { getApprovedHookAudioAsset } from "@/lib/trending/hook-audio-db";

const MAX_BYTES = 25 * 1024 ** 2;
const types: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a" };
const json = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });

/** Authenticated, bounded GCP read. No paid music generation, catalogue changes,
 * or public client-supplied URL/track ID. The browser saves an owned snapshot
 * through the same verified media upload used for demo audio before finishing. */
export async function handleWorkflowDefaultMusic(request: Request) {
  try {
    await requireAIStudioProUser(request);
    if (new URL(request.url).search) return json("This endpoint does not accept a track or URL.", 400);
    const id = process.env.EXPLORE_DEFAULT_BACKGROUND_AUDIO_ID?.trim();
    if (!id) return json("Default background music is not configured yet. Turn it off to keep original sound, or choose audio for your demo.", 503);
    const track = await getApprovedHookAudioAsset(id);
    if (!track || track.id !== id || !Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0 || track.durationSeconds > 600) return json("The approved default music track is unavailable. Your original sound is unchanged.", 503);
    const url = new URL(track.audioUrl);
    if (url.protocol !== "https:" || (url.hostname !== "storage.googleapis.com" && !url.hostname.endsWith(".storage.googleapis.com")) || !isTrustedStorageUrl(url.href)) return json("Default music must be an approved file in our GCP storage.", 503);
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
    const type = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (!response.ok || !response.body || !types[type]) { await response.body?.cancel(); return json("Could not load the approved default music file.", 503); }
    const length = response.headers.get("Content-Length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) { await response.body.cancel(); return json("Default music exceeds the upload limit.", 503); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_BYTES) return json("Default music exceeds the upload limit.", 503);
        chunks.push(next.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    if (!size) return json("The default music file is empty.", 503);
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type, "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="default-background.${types[type]}"`, "Cache-Control": "no-store", Vary: "Authorization",
      "X-Content-Type-Options": "nosniff", "X-Explore-Music-Loopable": String(track.loopable) } });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json(error.message, error.status);
    return json("Default background music could not be loaded. Turn it off to keep original sound.", 503);
  }
}
