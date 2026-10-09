import "server-only";
import { AudioError, AUDIO_MAX_UPLOAD_BYTES } from "@/worker/src/lib/audio-contract";
import type { AudioBootstrap } from "./types";
import { audioApiError, handleAudioBootstrap } from "./api";

const MP3_BITRATES = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/x-mp3"]);
const GENERIC_SAMPLE_TYPES = new Set(["", "text/plain", "application/octet-stream", "binary/octet-stream"]);

function mp3Frame(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
  const version = (bytes[offset + 1] >> 3) & 3;
  const layer = (bytes[offset + 1] >> 1) & 3;
  const bitrateIndex = bytes[offset + 2] >> 4;
  const rateIndex = (bytes[offset + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const bitrate = (version === 3 ? MP3_BITRATES.mpeg1 : MP3_BITRATES.mpeg2)[bitrateIndex] * 1000;
  const sampleRate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const length = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + ((bytes[offset + 2] >> 1) & 1);
  return offset + length <= bytes.length ? { version, sampleRate, length } : null;
}

/** Recognize MP3 frames, not just a filename, MIME label or ID3 metadata. */
function isMp3Sample(bytes: Uint8Array): boolean {
  let offset = 0;
  while (bytes[offset] === 0x49 && bytes[offset + 1] === 0x44 && bytes[offset + 2] === 0x33) {
    if (offset + 10 > bytes.length || ![2, 3, 4].includes(bytes[offset + 3])) return false;
    const sizeBytes = bytes.subarray(offset + 6, offset + 10);
    if (sizeBytes.some(value => value & 0x80)) return false;
    const size = sizeBytes.reduce((total, value) => total * 128 + value, 0);
    const footer = bytes[offset + 3] === 4 && (bytes[offset + 5] & 0x10) ? 10 : 0;
    offset += 10 + size + footer;
    if (offset > bytes.length) return false;
  }
  const first = mp3Frame(bytes, offset);
  const second = first && mp3Frame(bytes, offset + first.length);
  return Boolean(first && second && first.version === second.version && first.sampleRate === second.sampleRate);
}

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
    const type = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!type.startsWith("audio/") && !GENERIC_SAMPLE_TYPES.has(type)) { await response.body.cancel(); throw new AudioError("This sample is not a supported audio file.", 503); }
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
    // Some provider MP3 previews are labeled text/plain. Only verified MP3 data
    // gets that fallback; other explicitly labeled audio keeps its existing type.
    const contentType = isMp3Sample(bytes) ? "audio/mpeg" : size && type.startsWith("audio/") && !MP3_TYPES.has(type) ? type : null;
    if (!contentType) throw new AudioError("This sample is not a supported audio file.", 503);
    return new Response(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return audioApiError(error); }
}
