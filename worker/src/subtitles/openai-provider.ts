import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { SubtitleError, validateTranscript, type SubtitleTranscript } from "./contracts.js";

// Evaluation adapter only: official retirement date is 2027-02-26. Do not connect
// to production without selecting a supported long-term provider/aligner.
export const OPENAI_SUBTITLE_MODEL = "whisper-1";
export const OPENAI_SUBTITLE_RETIREMENT = "2027-02-26";
// Version the adapter policy so transcripts accepted before a quality fix are not reused.
export const OPENAI_SUBTITLE_POLICY = "quality-v2";

export type TranscriptionProvider = {
  id: string;
  transcribe: (audioPath: string, durationMs: number, signal?: AbortSignal) => Promise<SubtitleTranscript>;
};

export function normalizeOpenAITranscript(value: unknown, durationMs: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "OpenAI did not return a transcript object.");
  }
  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.words)) {
    if (typeof response.text === "string" && !response.text.trim()) throw new SubtitleError("NO_SPEECH", "No speech detected.");
    throw new SubtitleError("WORD_TIMINGS_UNAVAILABLE", "The model did not return word timings. Text-only output cannot generate accurate word highlights.");
  }
  const words = response.words.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Invalid OpenAI word.");
    const word = raw as Record<string, unknown>;
    return { text: word.word, startMs: typeof word.start === "number" ? word.start * 1000 : null,
      endMs: typeof word.end === "number" ? word.end * 1000 : null };
  });
  // Conservative sanity checks, not a speech detector or an accuracy guarantee.
  // A real music-only test produced four words in 100 ms; never render that as speech.
  const segments = Array.isArray(response.segments) ? response.segments : [];
  for (const raw of segments) {
    if (!raw || typeof raw !== "object") throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Invalid OpenAI segment.");
    const segment = raw as Record<string, unknown>;
    const { start, end, no_speech_prob: noSpeech, avg_logprob: logprob, compression_ratio: compression } = segment;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "Invalid OpenAI segment timing.");
    }
    const wordCount = words.filter(w => typeof w.startMs === "number" && w.startMs >= start * 1000 - 25 && w.startMs < end * 1000 + 25).length;
    if ((wordCount >= 4 && wordCount / Math.max(0.01, end - start) > 10) ||
        (typeof noSpeech === "number" && noSpeech > 0.6 && typeof logprob === "number" && logprob <= -1) ||
        (typeof compression === "number" && compression > 2.4)) {
      throw new SubtitleError("TRANSCRIPT_UNRELIABLE", "The transcription has suspicious speech timing or confidence. Review the audio with another provider; no captions were published.");
    }
  }
  try {
    return validateTranscript({ schemaVersion: 1, provider: "openai", model: OPENAI_SUBTITLE_MODEL,
      language: typeof response.language === "string" ? response.language : null, durationMs, words }, durationMs);
  } catch (error) {
    if (error instanceof SubtitleError && error.code === "INVALID_TIMESTAMPS") {
      throw new SubtitleError("WORD_TIMINGS_UNRELIABLE", "OpenAI returned missing, zero-duration, or invalid word timings. Use another recording or a word-timestamp provider; timings were not guessed.");
    }
    throw error;
  }
}

export function createOpenAITranscriptionProvider(apiKey: string, language?: string): TranscriptionProvider {
  if (!apiKey.trim()) throw new SubtitleError("PROVIDER_KEY_MISSING", "OPENAI_API_KEY is required for live transcription.");
  // Disable SDK retries: a timeout after submission must not automatically create another paid request.
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
  return {
    id: `openai:${OPENAI_SUBTITLE_MODEL}:${language ?? "auto"}:${OPENAI_SUBTITLE_POLICY}`,
    async transcribe(audioPath, durationMs, signal) {
      if (Date.now() >= Date.parse(`${OPENAI_SUBTITLE_RETIREMENT}T00:00:00Z`)) {
        throw new SubtitleError("MODEL_RETIRED", "The evaluation model is retired. Select a supported word-timestamp provider.");
      }
      signal?.throwIfAborted();
      try {
        const response = await client.audio.transcriptions.create({
          file: createReadStream(audioPath), model: OPENAI_SUBTITLE_MODEL,
          response_format: "verbose_json", timestamp_granularities: ["word", "segment"],
          ...(language ? { language } : {}), temperature: 0,
        }, { signal });
        return normalizeOpenAITranscript(response, durationMs);
      } catch (error) {
        if (error instanceof SubtitleError) throw error;
        if (signal?.aborted) throw new SubtitleError("CANCELLED", "Subtitle generation was cancelled.");
        const status = error instanceof OpenAI.APIError ? error.status : undefined;
        throw new SubtitleError(status === 401 ? "PROVIDER_AUTH_FAILED" : status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_REQUEST_FAILED",
          `OpenAI transcription failed${status ? ` (HTTP ${status})` : ""}. No automatic paid retry was made.`);
      }
    },
  };
}
