import "server-only";

import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getBackgroundAudioTrack, listBackgroundAudioTracks } from "./background-audio-library";

const headers = { "Cache-Control": "no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
const json = (error: string, status: number) => Response.json({ error }, { status, headers });
const MAX_BYTES = 25 * 1024 ** 2;
const types: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a" };

/** Shared reviewed music catalogue, separate from personal speech/voice history. */
export async function handleBackgroundAudioLibrary(request: Request) {
  try {
    await requireAIStudioProUser(request);
    if (new URL(request.url).search) return json("This library does not accept extra parameters.", 400);
    return Response.json({ tracks: await listBackgroundAudioTracks() }, { headers });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json(error.message, error.status);
    return json("Could not load background music. Try again.", 503);
  }
}

/** Resolve a reviewed catalogue ID on the server; never proxy a client URL. */
export async function handleBackgroundAudioFile(request: Request) {
  try {
    await requireAIStudioProUser(request);
    const params = new URL(request.url).searchParams;
    const source = params.get("source"), id = params.get("id");
    if ((source !== "hook" && source !== "wall") || !id || !/^[\w-]{1,200}$/.test(id)
      || [...params.keys()].length !== 2) return json("Choose a background track from the library.", 400);
    const track = await getBackgroundAudioTrack(source, id);
    if (!track) return json("This background track is no longer available. Refresh the library.", 404);
    const response = await fetch(track.audioUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
    const type = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    const length = response.headers.get("Content-Length");
    if (!response.ok || !response.body || !types[type] || (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))) {
      await response.body?.cancel(); return json("This background audio file could not be loaded.", 503);
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_BYTES) return json("This background track exceeds the upload limit.", 503);
        chunks.push(next.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    if (!size) return json("This background audio file is empty.", 503);
    return new Response(Buffer.concat(chunks), { headers: { ...headers, "Content-Type": type, "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="background-${id}.${types[type]}"`, "X-Explore-Music-Loopable": String(track.track.loopable) } });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json(error.message, error.status);
    return json("Could not load this background track. Try again.", 503);
  }
}
