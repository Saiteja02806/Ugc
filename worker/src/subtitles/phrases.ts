import { SubtitleError, type SubtitleCue, type TimedWord } from "./contracts.js";
import type { MeasureText, SubtitleLayout } from "./captions.js";

const token = (text: string) => text.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gu, "");
const unfinished = new Set(["a", "an", "the", "and", "but", "or", "because", "if", "when", "with", "for", "of", "to", "in", "on", "at", "your", "my", "our", "is", "are", "was", "were", "very", "too"]);
const joinsNext = new Set(["and", "but", "or", "because", "if", "when"]);
const awkwardStart = new Set(["of", "to", "with", "for", "in", "on", "at"]);

/** English phrase heuristics, not semantic understanding. Never changes words or timings. */
export async function groupNaturalSubtitleWords(words: TimedWord[], layout: SubtitleLayout, measure: MeasureText, options: {
  maxWords?: number; maxDurationMs?: number; maxLines?: 1 | 2; preferredWords?: number; splitAtCommas?: boolean;
} = {}): Promise<SubtitleCue[]> {
  const widthCache = new Map<string, Promise<number>>();
  const width = (text: string) => {
    let result = widthCache.get(text);
    if (!result) { result = measure(text); widthCache.set(text, result); }
    return result;
  };
  async function linesFor(part: TimedWord[]): Promise<number[][] | null> {
    const indices = part.map((_, i) => i);
    const text = (line: number[]) => line.map(i => part[i].text).join(" ");
    if (await width(text(indices)) <= layout.maxLineWidth) return [indices];
    if (options.maxLines === 1) return null;
    let best: { lines: number[][]; score: number } | undefined;
    for (let i = 1; i < part.length; i++) {
      const lines = [indices.slice(0, i), indices.slice(i)];
      const a = await width(text(lines[0])), b = await width(text(lines[1]));
      const score = Math.abs(a - b) + (unfinished.has(token(part[i - 1].text)) ? layout.fontSize * 2 : 0);
      if (Math.max(a, b) <= layout.maxLineWidth && (!best || score < best.score)) best = { lines, score };
    }
    return best?.lines ?? null;
  }
  const chunks: TimedWord[][] = [];
  for (const word of words) {
    const chunk = chunks.at(-1), previous = chunk?.at(-1);
    if (!chunk || (previous && (word.startMs - previous.endMs >= 400 || (options.splitAtCommas ? /[,;:.!?]$/u : /[.!?]$/u).test(previous.text)))) chunks.push([word]);
    else chunk.push(word);
  }
  const cues: SubtitleCue[] = [];
  for (const chunk of chunks) {
    const costs = new Array<number>(chunk.length + 1).fill(Infinity);
    const choices = new Map<number, { end: number; lines: number[][] }>();
    costs[chunk.length] = 0;
    for (let i = chunk.length - 1; i >= 0; i--) {
      for (let end = i + 1; end <= Math.min(chunk.length, i + (options.maxWords ?? 6)); end++) {
        const part = chunk.slice(i, end);
        if (part.at(-1)!.endMs - part[0].startMs > (options.maxDurationMs ?? 2800) && part.length > 1) break;
        const lines = await linesFor(part);
        if (!lines) continue;
        let cost = 8 + Math.max(0, (options.preferredWords ?? 3) - part.length) * 3;
        if (options.preferredWords !== undefined) cost += Math.max(0, part.length - options.preferredWords) ** 2 * 4;
        if (end < chunk.length) {
          const last = part.at(-1)!, next = chunk[end];
          if (unfinished.has(token(last.text))) cost += 24;
          if (awkwardStart.has(token(next.text))) cost += 12;
          if (joinsNext.has(token(next.text))) cost -= 5;
          if (/[,;:]$/u.test(last.text)) cost -= 4;
          if (next.startMs - last.endMs >= 200) cost -= 3;
        }
        cost += costs[end];
        if (cost < costs[i]) { costs[i] = cost; choices.set(i, { end, lines }); }
      }
    }
    for (let i = 0; i < chunk.length;) {
      const choice = choices.get(i);
      if (!choice) throw new SubtitleError("TEXT_DOES_NOT_FIT", "A subtitle word cannot fit within the safe area.");
      const part = chunk.slice(i, choice.end);
      cues.push({ words: part, lines: choice.lines, startMs: part[0].startMs, endMs: part.at(-1)!.endMs });
      i = choice.end;
    }
  }
  for (let i = 0; i < cues.length - 1; i++) cues[i].endMs = Math.min(cues[i].endMs, cues[i + 1].startMs);
  return cues;
}
