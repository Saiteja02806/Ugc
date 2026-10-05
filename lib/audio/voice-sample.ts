import "server-only";
import { AudioError, AUDIO_MAX_UPLOAD_BYTES } from "@/worker/src/lib/audio-contract";
import type { AudioBootstrap } from "./types";
import { audioApiError, handleAudioBootstrap } from "./api";

export function trustedVoiceSample(value: string, voiceId: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    return url.hostname === "storage.googleapis.com" && url.pathname.startsWith("/eleven-public-prod/") ||
      ["api.elevenlabs.io", "api.us.elevenlabs.io"].includes(url.hostname) && url.pathname.startsWith(`/v1/voices/${voiceId}/previews/`);
  } catch { return false; }
}
/** Reads an existing demo, never generates speech or accepts a caller-supplied URL. */
export async function handleAudioVoiceSample(request: Request, voiceId: string) {
  try {
    const catalogue = await handleAudioBootstrap(request);
    if (!catalogue.ok) return catalogue;
    if (!/^[\w-]{1,100}$/.test(voiceId)) throw new AudioError("Voice sample not found.", 404);
    const data = await catalogue.json() as AudioBootstrap;
    if (!data.account?.paid) throw new AudioError("This voice is available for preview only. Choose a saved recording for your video.", 403);
    const voice = data.voices.find(voice => voice.id === voiceId);
    if (!voice?.previewUrl || !trustedVoiceSample(voice.previewUrl, voiceId)) throw new AudioError("This voice has no available reference sample. Choose a saved recording instead.", 404);
    const response = await fetch(voice.previewUrl, { redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]), headers: { Accept: "audio/*" } });
    if (!response.ok || !response.body) throw new AudioError("The voice sample could not be loaded. Try again.", 503);
    const type = response.headers.get("Content-Type")?.split(";")[0] ?? "";
    if (!type.startsWith("audio/")) { await response.body.cancel(); throw new AudioError("This sample is not a supported audio file.", 503); }
    if (Number(response.headers.get("Content-Length")) > AUDIO_MAX_UPLOAD_BYTES) { await response.body.cancel(); throw new AudioError("This sample is too large. Choose a saved recording instead.", 413); }
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > AUDIO_MAX_UPLOAD_BYTES) { await reader.cancel(); throw new AudioError("This sample is too large. Choose a saved recording instead.", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return audioApiError(error); }
}
