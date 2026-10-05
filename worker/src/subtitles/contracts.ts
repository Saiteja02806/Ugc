/** Shared timed-subtitle contracts for the lab and the owned Explore worker. */
export const SUBTITLE_VERSION = "subtitles-v1";
export const SUBTITLE_STYLES = ["clean", "bold-box", "active-word", "editorial"] as const;
export type SubtitleStyle = (typeof SUBTITLE_STYLES)[number];
export type SubtitlePlacement = "bottom" | "top";
export const MAX_VIDEO_DURATION_MS = 120_000;
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_TRANSCRIPT_WORDS = 2_000;

export class SubtitleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SubtitleError";
  }
}

export type TimedWord = {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
};
export type SubtitleTranscript = {
  schemaVersion: 1;
  provider: "openai" | "elevenlabs" | "fixture";
  model: string;
  language: string | null;
  durationMs: number;
  words: TimedWord[];
};
export type SubtitleCue = {
  startMs: number;
  endMs: number;
  words: TimedWord[];
  /** One or two lines, as indices into this cue's words. */
  lines: number[][];
};

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SubtitleError("INVALID_TRANSCRIPT", "Expected a subtitle object.");
  }
  return value as Record<string, unknown>;
}

export function validateTranscript(value: unknown, durationMs: number): SubtitleTranscript {
  const input = record(value);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_VIDEO_DURATION_MS) {
    throw new SubtitleError("VIDEO_DURATION_INVALID", "Videos must be between 0 and 120 seconds.");
  }
  if (input.schemaVersion !== 1 || !["openai", "elevenlabs", "fixture"].includes(String(input.provider)) ||
      typeof input.model !== "string" || !input.model || input.model.length > 100 ||
      (input.language !== null && (typeof input.language !== "string" || input.language.length > 100))) {
    throw new SubtitleError("INVALID_TRANSCRIPT", "Unsupported transcript format.");
  }
  if (typeof input.durationMs !== "number" || !Number.isFinite(input.durationMs) ||
      Math.abs(input.durationMs - durationMs) > 150) {
    throw new SubtitleError("TRANSCRIPT_DURATION_MISMATCH", "The transcript belongs to a different video duration.");
  }
  if (!Array.isArray(input.words) || input.words.length > MAX_TRANSCRIPT_WORDS) {
    throw new SubtitleError("INVALID_TRANSCRIPT", "Transcript has too many words or no word array.");
  }
  let lastStart = -1;
  const words = input.words.map((raw): TimedWord => {
    const word = record(raw);
    if (typeof word.text !== "string") throw new SubtitleError("INVALID_TRANSCRIPT", "Missing word text.");
    const text = word.text.normalize("NFC").trim();
    if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/u.test(text)) {
      throw new SubtitleError("INVALID_TRANSCRIPT", "Word text is empty, too long, or contains control characters.");
    }
    const { startMs, endMs, confidence } = word;
    if (typeof startMs !== "number" || typeof endMs !== "number" ||
        !Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 ||
        endMs <= startMs || startMs < lastStart || startMs >= durationMs || endMs > durationMs + 150) {
      throw new SubtitleError("INVALID_TIMESTAMPS", "Word timings are invalid or outside the video.");
    }
    if (confidence !== undefined && (typeof confidence !== "number" ||
        !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      throw new SubtitleError("INVALID_TRANSCRIPT", "Invalid confidence value.");
    }
    const roundedStart = Math.round(startMs), roundedEnd = Math.min(durationMs, Math.round(endMs));
    if (roundedEnd <= roundedStart || roundedStart <= lastStart) {
      throw new SubtitleError("INVALID_TIMESTAMPS", "Word intervals must remain distinct and ordered at millisecond precision.");
    }
    lastStart = roundedStart;
    return { text, startMs: roundedStart, endMs: roundedEnd,
      ...(confidence === undefined ? {} : { confidence: confidence as number }) };
  });
  if (words.length === 0) throw new SubtitleError("NO_SPEECH", "No speech detected.");
  return { schemaVersion: 1, provider: input.provider as SubtitleTranscript["provider"],
    model: input.model, language: input.language as string | null, durationMs, words };
}

export function parseStyle(value: string): SubtitleStyle {
  if (!(SUBTITLE_STYLES as readonly string[]).includes(value)) {
    throw new SubtitleError("INVALID_STYLE", "Choose clean, bold-box, active-word, or editorial.");
  }
  return value as SubtitleStyle;
}

export function parsePlacement(value: string): SubtitlePlacement {
  if (value !== "top" && value !== "bottom") throw new SubtitleError("INVALID_PLACEMENT", "Choose top or bottom.");
  return value;
}

export function parseLanguage(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[a-z]{2}$/u.test(value)) throw new SubtitleError("INVALID_LANGUAGE", "Use a two-letter language code, such as en or hi.");
  return value;
}
