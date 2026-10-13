import { SubtitleError, type SubtitleTranscript } from "./contracts.ts";

export type SubtitleCorrection = { index: number; text: string };
/** Text only: retain provider timestamps and keep the original cached transcript intact. */
export function parseSubtitleCorrections(value: unknown): SubtitleCorrection[] {
  if (!Array.isArray(value) || value.length > 2000) throw new SubtitleError("INVALID_CORRECTIONS", "Choose valid caption word corrections.");
  let previous = -1;
  return value.map(raw => {
    const item = raw as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some(key => !["index", "text"].includes(key)) ||
        !Number.isInteger(item.index) || Number(item.index) <= previous || Number(item.index) >= 2000 || typeof item.text !== "string") {
      throw new SubtitleError("INVALID_CORRECTIONS", "Caption corrections must identify distinct words in order.");
    }
    const text = item.text.normalize("NFC").trim();
    if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/u.test(text)) throw new SubtitleError("INVALID_CORRECTIONS", "Each caption word needs 1–120 characters without line breaks.");
    previous = Number(item.index);
    return { index: previous, text };
  });
}

export function correctSubtitleTranscript(transcript: SubtitleTranscript, corrections: readonly SubtitleCorrection[] = []): SubtitleTranscript {
  const checked = parseSubtitleCorrections(corrections);
  if (checked.some(item => item.index >= transcript.words.length)) throw new SubtitleError("INVALID_CORRECTIONS", "A corrected word is outside this transcript. Generate captions for your current clips.");
  const text = new Map(checked.map(item => [item.index, item.text]));
  return { ...transcript, words: transcript.words.map((word, index) => ({ ...word, text: text.get(index) ?? word.text })) };
}
