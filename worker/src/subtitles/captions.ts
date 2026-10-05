import { SubtitleError, type SubtitleCue, type SubtitlePlacement, type SubtitleStyle, type TimedWord } from "./contracts.js";

export type SubtitleLayout = {
  width: number;
  height: number;
  fontSize: number;
  maxLineWidth: number;
  bold: boolean;
};

export function getSubtitleLayout(width: number, height: number, style: SubtitleStyle): SubtitleLayout {
  const fontSize = Math.max(16, Math.round(Math.min(width * 0.06, height * 0.048)));
  return { width, height, fontSize, maxLineWidth: Math.floor(width * 0.82), bold: style !== "clean" };
}

export type MeasureText = (text: string) => Promise<number>;

/** Width-based wrapping. No character-count approximation or timestamp invention. */
async function wrapWords(words: TimedWord[], maxWidth: number, measure: MeasureText): Promise<number[][] | null> {
  const indices = words.map((_, index) => index);
  const width = async (part: number[]) => measure(part.map((index) => words[index].text).join(" "));
  if (await width(indices) <= maxWidth) return [indices];
  let best: { lines: number[][]; score: number } | null = null;
  for (let split = 1; split < words.length; split++) {
    const lines = [indices.slice(0, split), indices.slice(split)];
    const [first, second] = await Promise.all(lines.map(width));
    const score = Math.abs(first - second);
    if (first <= maxWidth && second <= maxWidth && (!best || score < best.score)) best = { lines, score };
  }
  return best?.lines ?? null;
}

export async function groupSubtitleWords(words: TimedWord[], layout: SubtitleLayout, measure: MeasureText): Promise<SubtitleCue[]> {
  const cues: SubtitleCue[] = [];
  let pending: TimedWord[] = [];
  let lines: number[][] = [];
  const flush = () => {
    if (pending.length) cues.push({ startMs: pending[0].startMs, endMs: pending[pending.length - 1].endMs, words: pending, lines });
    pending = [];
    lines = [];
  };
  for (const word of words) {
    const previous = pending[pending.length - 1];
    if (previous && (word.startMs - previous.endMs >= 400 ||
        word.endMs - pending[0].startMs > 2_800 || pending.length >= 6 || /[.!?]$/u.test(previous.text))) flush();
    let candidate = [...pending, word];
    let candidateLines = await wrapWords(candidate, layout.maxLineWidth, measure);
    if (!candidateLines) {
      flush();
      candidate = [word];
      candidateLines = await wrapWords(candidate, layout.maxLineWidth, measure);
    }
    if (!candidateLines) throw new SubtitleError("TEXT_DOES_NOT_FIT", "A subtitle word cannot fit within the safe area.");
    pending = candidate;
    lines = candidateLines;
  }
  flush();
  // Overlapping provider word intervals must not leave two phrase pages visible.
  for (let i = 0; i < cues.length - 1; i++) cues[i].endMs = Math.min(cues[i].endMs, cues[i + 1].startMs);
  return cues;
}

/** ASS interprets braces/backslashes as commands. Use visible punctuation equivalents only for display. */
export function escapeAssText(text: string) {
  return text.replaceAll("{", "(").replaceAll("}", ")").replaceAll("\\", "/").replace(/[\r\n]/gu, " ");
}

function assTime(ms: number) {
  const cs = Math.floor(ms / 10);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

export function serializeAss(cues: SubtitleCue[], layout: SubtitleLayout, style: SubtitleStyle, placement: SubtitlePlacement) {
  if (style === "editorial") throw new SubtitleError("EDITORIAL_PLANNER_REQUIRED", "Editorial captions require their measured layout planner.");
  const outline = Math.max(1, Math.round(layout.fontSize * 0.065));
  const x = Math.round(layout.width / 2);
  const y = Math.round(layout.height * (placement === "bottom" ? 0.78 : 0.22));
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${layout.width}\nPlayResY: ${layout.height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Arial,${layout.fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,${layout.bold ? -1 : 0},0,0,0,100,100,0,0,${style === "bold-box" ? 3 : 1},${style === "bold-box" ? outline * 3 : outline},0,5,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const events: string[] = [];
  for (const cue of cues) {
    // Rebuild the identical phrase at timing boundaries. This highlights only the current word,
    // unlike karaoke fill which can leave previously spoken words highlighted.
    const boundaries = style === "active-word"
      ? [...new Set([cue.startMs, cue.endMs, ...cue.words.flatMap((w) => [w.startMs, Math.min(w.endMs, cue.endMs)])])].filter((t) => t >= cue.startMs && t <= cue.endMs).sort((a, b) => a - b)
      : [cue.startMs, cue.endMs];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i], end = boundaries[i + 1];
      if (Math.floor(end / 10) <= Math.floor(start / 10)) continue;
      let active = -1;
      if (style === "active-word") cue.words.forEach((w, index) => { if (w.startMs <= start && start < w.endMs) active = index; });
      const text = cue.lines.map((line) => line.map((index) => {
        const label = escapeAssText(cue.words[index].text);
        return index === active ? `{\\c&H0059DDFF&}${label}{\\c&H00FFFFFF&}` : label;
      }).join(" ")).join("\\N");
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,{\\pos(${x},${y})}${text}`);
    }
  }
  return header + events.join("\n") + "\n";
}

function subtitleTime(ms: number, separator: string) {
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(Math.floor(ms) % 1000).padStart(3, "0")}`;
}

export function serializeSrt(cues: SubtitleCue[]) {
  return cues.map((cue, index) => `${index + 1}\n${subtitleTime(cue.startMs, ",")} --> ${subtitleTime(cue.endMs, ",")}\n${cue.lines.map((line) => line.map((i) => cue.words[i].text).join(" ")).join("\n")}\n`).join("\n");
}

export function serializeVtt(cues: SubtitleCue[]) {
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return "WEBVTT\n\n" + cues.map((cue) => `${subtitleTime(cue.startMs, ".")} --> ${subtitleTime(cue.endMs, ".")}\n${cue.lines.map((line) => line.map((i) => escape(cue.words[i].text)).join(" ")).join("\n")}\n`).join("\n");
}
