import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { escapeAssText, serializeAss, type SubtitleLayout } from "./captions.js";
import { SubtitleError, subtitlePlacementGeometry, type SubtitleCue, type SubtitlePlacement } from "./contracts.js";
import { runMediaCommand, type SubtitleTools } from "./media.js";

export type WordBounds = { left: number; top: number; right: number; bottom: number };
export type DynamicMeasure = (cue: SubtitleCue, size: number, placement: SubtitlePlacement) => Promise<WordBounds[]>;
const colors = [[255, 64, 64], [64, 255, 64], [64, 64, 255], [255, 255, 64], [255, 64, 255], [64, 255, 255], [255, 160, 64], [160, 64, 255], [64, 160, 255], [160, 255, 64], [255, 64, 160], [64, 255, 160]];
const assColor = ([r, g, b]: number[]) => [b, g, r].map(n => n.toString(16).padStart(2, "0")).join("");
const time = (ms: number) => {
  const cs = Math.floor(ms / 10);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const phrase = (cue: SubtitleCue, tag: (index: number) => string = () => "") =>
  cue.lines.map(line => line.map(i => `${tag(i)}${escapeAssText(cue.words[i].text)}`).join(" ")).join("\\N");
const anchor = (layout: SubtitleLayout, placement: SubtitlePlacement) =>
  `\\an5\\pos(${Math.round(layout.width / 2)},${Math.round(layout.height * subtitlePlacementGeometry(placement).anchor)})`;

/** Word boxes come from the entire shaped phrase in libass, including wrapping,
 * spacing and kerning. No browser or prefix-width approximations. */
export function createDynamicMeasurer(layout: SubtitleLayout, tools: SubtitleTools, workDir: string, signal?: AbortSignal): DynamicMeasure {
  const cache = new Map<string, Promise<WordBounds[]>>();
  let queue = Promise.resolve();
  return (cue, size, placement) => {
    const key = JSON.stringify([cue.words.map(w => w.text), cue.lines, size, placement]);
    let result = cache.get(key);
    if (!result) {
      result = queue.then(() => measure(cue, size, placement));
      queue = result.then(() => undefined, () => undefined);
      cache.set(key, result);
    }
    return result;
  };
  async function measure(cue: SubtitleCue, size: number, placement: SubtitlePlacement) {
    if (cue.words.length > colors.length) throw new SubtitleError("TEXT_DOES_NOT_FIT", "Split this phrase into shorter caption pages.");
    signal?.throwIfAborted();
    const header = serializeAss([], layout, "clean", placement);
    await writeFile(join(workDir, "dynamic-measure.ass"), header +
      `Dialogue: 0,0:00:00.00,0:00:01.00,Caption,,0,0,0,,{${anchor(layout, placement)}\\fs${size}\\b1\\bord0\\shad0}${phrase(cue, i => `{\\c&H${assColor(colors[i])}&}`)}\n`);
    const result = await runMediaCommand(tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "verbose", "-y", "-f", "lavfi", "-i",
      `color=c=black:s=${layout.width}x${layout.height}:r=30`, "-vf", "ass=dynamic-measure.ass:fontsdir=fonts", "-frames:v", "1", "dynamic-measure.png"], { cwd: workDir, signal, timeoutMs: 15000 });
    if (/Glyph.*not found|fontselect: failed/iu.test(result.stderr) || !/Arial/iu.test(result.stderr))
      throw new SubtitleError("FONT_UNAVAILABLE", "The caption font could not render these words.");
    const { data, info } = await sharp(join(workDir, "dynamic-measure.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bounds = cue.words.map(() => ({ left: layout.width, top: layout.height, right: -1, bottom: -1 }));
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      for (let i = 0; i < bounds.length; i++) {
        // Interior pixels survive YUV/RGB conversion; exclude antialiased edges.
        if (colors[i].every((channel, c) => Math.abs(data[offset + c] - channel) < 35)) {
          const b = bounds[i]; b.left = Math.min(b.left, x); b.right = Math.max(b.right, x + 1);
          b.top = Math.min(b.top, y); b.bottom = Math.max(b.bottom, y + 1); break;
        }
      }
    }
    if (bounds.some(b => b.right < 0)) throw new SubtitleError("FONT_UNAVAILABLE", "A caption word produced no measurable glyphs.");
    return bounds;
  }
}

function withinSafeArea(bounds: WordBounds[], layout: SubtitleLayout, placement: SubtitlePlacement, padding: number) {
  const geometry = subtitlePlacementGeometry(placement);
  return bounds.every(b => b.left - padding >= layout.width * .09 && b.right + padding <= layout.width * .91 &&
    b.top - padding >= layout.height * geometry.editorialTop && b.bottom + padding <= layout.height * geometry.editorialBottom);
}

/** Times are the real word intervals. The fill stops over pauses, then resumes
 * at the next word; the phrase never moves when its emphasis changes. */
export async function serializeDynamicAss(cues: SubtitleCue[], layout: SubtitleLayout, style: "word-pop" | "karaoke" | "marker-highlight", placement: SubtitlePlacement, measure: DynamicMeasure) {
  const header = serializeAss([], layout, "clean", placement);
  const events: string[] = [];
  const event = (layer: number, start: number, end: number, text: string) => {
    if (Math.floor(end / 10) > Math.floor(start / 10)) events.push(`Dialogue: ${layer},${time(start)},${time(end)},Caption,,0,0,0,,${text}`);
  };
  const words = cues.flatMap(cue => cue.words);
  if (style === "word-pop") {
    for (let i = 0; i < words.length; i++) {
      const word = words[i], end = Math.min(word.endMs, words[i + 1]?.startMs ?? word.endMs);
      const cue: SubtitleCue = { startMs: word.startMs, endMs: end, words: [word], lines: [[0]] };
      let size = Math.round(layout.fontSize * 2.2);
      while (!withinSafeArea(await measure(cue, size, placement), layout, placement, 3)) {
        size = Math.floor(size * .9);
        if (size < 16) throw new SubtitleError("TEXT_DOES_NOT_FIT", "This word cannot fit the caption safe area.");
      }
      event(0, word.startMs, end, `{${anchor(layout, placement)}\\fs${size}\\b1\\fscx94\\fscy94\\t(0,${Math.min(100, end - word.startMs)},\\fscx100\\fscy100)}${escapeAssText(word.text)}`);
    }
  } else for (const cue of cues) {
    let size = layout.fontSize, bounds = await measure(cue, size, placement);
    const padding = Math.max(3, Math.round(size * .18));
    while (!withinSafeArea(bounds, layout, placement, padding)) {
      size = Math.floor(size * .9);
      if (size < 16) throw new SubtitleError("TEXT_DOES_NOT_FIT", "This phrase cannot fit the caption safe area.");
      bounds = await measure(cue, size, placement);
    }
    const tags = `${anchor(layout, placement)}\\fs${size}\\b1`;
    event(1, cue.startMs, cue.endMs, `{${tags}${style === "karaoke" ? "\\c&H00C6C6C6&" : ""}}${phrase(cue)}`);
    for (let i = 0; i < cue.words.length; i++) {
      const word = cue.words[i], b = bounds[i];
      const end = Math.min(word.endMs, cue.words[i + 1]?.startMs ?? cue.endMs, cue.endMs);
      if (end <= word.startMs) continue;
      if (style === "marker-highlight") {
        const left = b.left - padding, top = b.top - padding, width = b.right - b.left + padding * 2, height = b.bottom - b.top + padding * 2;
        event(0, word.startMs, end, `{\\an7\\pos(${left},${top})\\bord0\\shad0\\c&H00A3486A&\\p1}m 0 0 l ${width} 0 ${width} ${height} 0 ${height}{\\p0}`);
      } else {
        // Rectangular clips are animated by libass. Each word gets its own
        // interval and stays filled after its measured end, including silence.
        const clip = (right: number) => `\\clip(${b.left},${b.top - 3},${right},${b.bottom + 3})`;
        event(2, word.startMs, cue.endMs, `{${tags}\\bord0\\shad0\\c&H0059DDFF&${clip(b.left)}\\t(0,${end - word.startMs},${clip(b.right)})}${phrase(cue, index => `{\\alpha&H${index === i ? "00" : "FF"}&}`)}`);
      }
    }
  }
  return header + events.join("\n") + "\n";
}
