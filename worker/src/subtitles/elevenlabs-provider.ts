import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { assertExploreSubtitleScope } from "./explore-policy.js";
import { MAX_TRANSCRIPT_WORDS, record, SubtitleError, validateTranscript, type SubtitleTranscript } from "./contracts.js";
import { SCRIBE_MODEL, SCRIBE_PROVIDER_KEY } from "./elevenlabs-contract.js";

// Bind cached results to these request/validation semantics, not just a model name.
export { SCRIBE_MODEL, SCRIBE_PROVIDER_KEY } from "./elevenlabs-contract.js";
const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

export type PreparedScribeTranscription = { sourceHash: string; submit: () => Promise<SubtitleTranscript> };
export type ScribeTranscriptionProvider = {
  id: typeof SCRIBE_PROVIDER_KEY;
  prepare: (path: string, durationMs: number, signal?: AbortSignal) => Promise<PreparedScribeTranscription>;
};

/** Only the worker's bounded, generated mono PCM WAV is submitted. Never a URL. */
export function validateScribeAudio(audio: Buffer, durationMs: number) {
  assertExploreSubtitleScope("en", durationMs);
  if (audio.length < 44 || audio.length > MAX_AUDIO_BYTES || audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE" || audio.readUInt32LE(4) + 8 !== audio.length) {
    throw new SubtitleError("AUDIO_INVALID", "Subtitle input must be the prepared PCM WAV speech track.");
  }
  let formatFound = false, data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const size = audio.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > audio.length) throw new SubtitleError("AUDIO_INVALID", "The prepared speech file is incomplete.");
    const type = audio.toString("ascii", offset, offset + 4);
    if (type === "fmt ") {
      if (formatFound || size < 16 || audio.readUInt16LE(start) !== 1 || audio.readUInt16LE(start + 2) !== 1 ||
          audio.readUInt32LE(start + 4) !== 16000 || audio.readUInt32LE(start + 8) !== 32000 ||
          audio.readUInt16LE(start + 12) !== 2 || audio.readUInt16LE(start + 14) !== 16) {
        throw new SubtitleError("AUDIO_INVALID", "Subtitle speech must be 16 kHz mono PCM16.");
      }
      formatFound = true;
    } else if (type === "data") {
      if (data) throw new SubtitleError("AUDIO_INVALID", "The prepared speech file contains multiple data tracks.");
      data = audio.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!formatFound || !data?.length || data.length % 2) throw new SubtitleError("AUDIO_INVALID", "The prepared speech file has no valid PCM samples.");
  const measuredMs = data.length / 32;
  assertExploreSubtitleScope("en", measuredMs);
  if (measuredMs < 100 || Math.abs(measuredMs - durationMs) > 150) throw new SubtitleError("AUDIO_DURATION_MISMATCH", "The speech duration does not match the finished video.");
  if (data.every(byte => byte === 0)) throw new SubtitleError("NO_SPEECH", "The video audio is silent; no transcription was requested.");
}

export function normalizeScribeTranscript(raw: unknown, durationMs: number): SubtitleTranscript {
  assertExploreSubtitleScope("en", durationMs);
  const response = record(raw);
  // Detect, rather than force, English. An English hint is not language evidence.
  if (typeof response.language_code !== "string" || !["en", "eng"].includes(response.language_code.toLowerCase())) {
    throw new SubtitleError("SUBTITLE_LANGUAGE_UNSUPPORTED", "Auto subtitles support detected English speech only.");
  }
  if (typeof response.language_probability !== "number" || !Number.isFinite(response.language_probability) ||
      response.language_probability <= 0 || response.language_probability > 1) {
    throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Scribe did not return valid language detection.");
  }
  if (!Array.isArray(response.words) || response.words.length > MAX_TRANSCRIPT_WORDS * 3) {
    throw new SubtitleError("WORD_TIMINGS_UNAVAILABLE", "Scribe must return real word timings; timings are never guessed.");
  }
  const words = response.words.flatMap(rawWord => {
    const word = record(rawWord);
    if (word.type === "spacing" || word.type === "audio_event") return [];
    if (word.type !== "word") throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Scribe returned an unsupported word type.");
    return [{ text: word.text, startMs: typeof word.start === "number" ? word.start * 1000 : null,
      endMs: typeof word.end === "number" ? word.end * 1000 : null }];
  });
  return validateTranscript({ schemaVersion: 1, provider: "elevenlabs", model: SCRIBE_MODEL,
    language: "en", durationMs, words }, durationMs);
}

async function readPreparedAudio(path: string) {
  if (!(await lstat(path)).isFile()) throw new SubtitleError("AUDIO_INVALID", "Subtitle input must be a local regular speech file.");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 44 || info.size > MAX_AUDIO_BYTES) throw new SubtitleError("AUDIO_TOO_LARGE", "The prepared speech file exceeds its size limit.");
    const buffer = Buffer.alloc(info.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size !== info.size) throw new SubtitleError("AUDIO_INVALID", "The prepared speech file changed while reading.");
    return buffer.subarray(0, size);
  } finally { await handle.close(); }
}

async function boundedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Scribe returned no transcript body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Scribe's response exceeded the transcript size limit.");
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Scribe returned invalid transcript JSON."); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** No SDK retries, redirects, text-only fallback, or second paid provider. The
 * caller must durably claim this exact owner/hash/provider BEFORE submit(). */
export function createScribeTranscriptionProvider(apiKey: string, fetcher: typeof fetch = fetch): ScribeTranscriptionProvider {
  const key = apiKey.trim();
  if (!key || /[\r\n]/u.test(key)) throw new SubtitleError("PROVIDER_KEY_MISSING", "A server-side ElevenLabs API key is required for subtitles.");
  return {
    id: SCRIBE_PROVIDER_KEY,
    async prepare(path, durationMs, signal) {
      signal?.throwIfAborted();
      const audio = await readPreparedAudio(path);
      validateScribeAudio(audio, durationMs);
      const sourceHash = createHash("sha256").update(audio).digest("hex");
      let submitted: Promise<SubtitleTranscript> | undefined;
      const submitOnce = async () => {
        signal?.throwIfAborted();
        const body = new FormData();
        body.set("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "speech.wav");
        body.set("model_id", SCRIBE_MODEL);
        body.set("timestamps_granularity", "word");
        body.set("tag_audio_events", "false");
        body.set("diarize", "false");
        body.set("use_multi_channel", "false");
        body.set("webhook", "false");
        body.set("temperature", "0");
        const timeout = AbortSignal.timeout(120_000);
        try {
          const response = await fetcher(ENDPOINT, { method: "POST", headers: { "xi-api-key": key },
            body, redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
          if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            throw new SubtitleError(response.status === 401 || response.status === 403 ? "PROVIDER_AUTH_FAILED" :
              response.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_REQUEST_FAILED",
              `Scribe transcription failed (HTTP ${response.status}). No automatic paid retry was made.`);
          }
          return normalizeScribeTranscript(await boundedJson(response), durationMs);
        } catch (error) {
          if (error instanceof SubtitleError) throw error;
          throw new SubtitleError(signal?.aborted ? "CANCELLED" : "PROVIDER_REQUEST_UNCERTAIN",
            "The transcription response could not be confirmed. It will not be submitted again automatically.");
        }
      };
      return { sourceHash, submit: () => submitted ??= submitOnce() };
    },
  };
}

/** Defaults off until deployment verifies credentials, allowance, and recovery. */
export function configuredScribeProvider(env: Readonly<{
  EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED?: string;
  ELEVENLABS_API_KEY?: string;
}> = {
  EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED: process.env.EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
}): ScribeTranscriptionProvider | undefined {
  if (env.EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED !== "true") return undefined;
  return createScribeTranscriptionProvider(env.ELEVENLABS_API_KEY ?? "");
}
