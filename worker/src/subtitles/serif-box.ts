import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { escapeAssText, type SubtitleLayout } from "./captions.js";
import { SubtitleError, subtitlePlacementGeometry, type SubtitleCue, type SubtitlePlacement, type TimedWord } from "./contracts.js";
import { runMediaCommand, type SubtitleTools } from "./media.js";
import { groupNaturalSubtitleWords } from "./phrases.js";

const FAMILY = "Instrument Serif";
// The reference has slightly fuller strokes than the regular font. This small
// same-colour edge follows the reveal, so it does not create a visible outline.
const strokeWidth = (fontSize: number) => Number((fontSize * .3 / 61).toFixed(3));
export const serifBoxAnchor = (placement: SubtitlePlacement) => placement === "bottom" ? .75 : subtitlePlacementGeometry(placement).anchor;
export type SerifBoxInk = { left: number; top: number; width: number; height: number };
export type MeasureSerifBox = (text: string) => Promise<SerifBoxInk>;
const time = (ms: number) => {
  const cs = Math.floor(ms / 10);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
function header(layout: Pick<SubtitleLayout, "width" | "height" | "fontSize">) {
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${layout.width}\nPlayResY: ${layout.height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${FAMILY},${layout.fontSize},&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,${strokeWidth(layout.fontSize)},0,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}

export async function prepareSerifBoxFonts(tools: SubtitleTools, workDir: string) {
  await mkdir(join(workDir, "fonts"));
  for (const file of ["InstrumentSerif-Regular.ttf", "OFL.txt"]) await copyFile(join(tools.fontsDir, "subtitle-serif-box", file), join(workDir, "fonts", file));
}

/** Measure the font and subtle stroke with libass, exactly as the export renders it. */
export function createSerifBoxMeasurer(layout: SubtitleLayout, tools: SubtitleTools, workDir: string, signal?: AbortSignal): MeasureSerifBox {
  const cache = new Map<string, Promise<SerifBoxInk>>();
  let queue = Promise.resolve();
  return text => {
    let result = cache.get(text);
    if (!result) {
      result = queue.then(() => measure(text));
      queue = result.then(() => undefined, () => undefined);
      cache.set(text, result);
    }
    return result;
  };
  async function measure(text: string): Promise<SerifBoxInk> {
    signal?.throwIfAborted();
    const width = Math.ceil((layout.width * 1.4 + 128) / 2) * 2, height = Math.ceil(Math.max(200, layout.fontSize * 2 + 128) / 2) * 2;
    const padding = 64;
    await writeFile(join(workDir, "serif-measure.ass"), header({ ...layout, width, height }) +
      `Dialogue: 0,0:00:00.00,0:00:01.00,Caption,,0,0,0,,{\\an7\\pos(${padding},${padding})}${escapeAssText(text)}\n`);
    const rendered = await runMediaCommand(tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "verbose", "-y", "-protocol_whitelist", "file,pipe", "-f", "lavfi", "-i",
      `color=c=black:s=${width}x${height}:r=24`, "-vf", "ass=serif-measure.ass:fontsdir=fonts", "-frames:v", "1", "serif-measure.png"], { cwd: workDir, signal, timeoutMs: 15000 });
    if (!/fontselect:.*InstrumentSerif-Regular/iu.test(rendered.stderr) || /Glyph.*not found|fontselect: failed/iu.test(rendered.stderr))
      throw new SubtitleError("FONT_UNAVAILABLE", "The serif subtitle font could not render these words.");
    const { data, info } = await sharp(join(workDir, "serif-measure.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = width, right = -1, top = height, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * info.channels] > 32) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < 0) throw new SubtitleError("FONT_UNAVAILABLE", "No visible serif subtitle text was rendered.");
    return { left: left - padding, top: top - padding, width: right >= width - 3 ? width * 2 : right - left + 1, height: bottom - top + 1 };
  }
}

export function groupSerifBoxWords(words: TimedWord[], layout: SubtitleLayout, measure: MeasureSerifBox) {
  return groupNaturalSubtitleWords(words, layout, text => measure(text).then(ink => ink.width),
    { maxWords: 6, preferredWords: 5, maxDurationMs: 2800, maxLines: 1 });
}

/** A fixed phrase: future words are grey, then each whole word fades to white. */
export async function serializeSerifBoxAss(cues: SubtitleCue[], layout: SubtitleLayout, placement: SubtitlePlacement, measure: MeasureSerifBox) {
  const events: string[] = [];
  const padX = Math.max(4, Math.round(layout.fontSize * .25));
  const x = Math.round(layout.width / 2), y = Math.round(layout.height * serifBoxAnchor(placement));
  // One line height and baseline for all phrases, including those without descenders.
  const lineInk = cues.length ? await measure("Ag") : { top: 0, height: 0 };
  const height = Math.ceil(Math.max(layout.fontSize * 1.4, lineInk.height + layout.fontSize * .65));
  for (const cue of cues) {
    if (Math.floor(cue.endMs / 10) <= Math.floor(cue.startMs / 10)) continue;
    const text = cue.words.map(word => word.text).join(" "), ink = await measure(text);
    const width = ink.width + padX * 2;
    if (ink.width > layout.maxLineWidth || x - width / 2 < 0 || x + width / 2 > layout.width || y - height / 2 < 0 || y + height / 2 > layout.height)
      throw new SubtitleError("TEXT_DOES_NOT_FIT", "Keep serif subtitle phrases within the safe area.");
    const r = Math.min(Math.max(2, Math.round(layout.fontSize * .18)), height / 4), k = r * .552285;
    const path = `m ${r} 0 l ${width - r} 0 b ${width - r + k} 0 ${width} ${r - k} ${width} ${r} l ${width} ${height - r} b ${width} ${height - r + k} ${width - r + k} ${height} ${width - r} ${height} l ${r} ${height} b ${r - k} ${height} 0 ${height - r + k} 0 ${height - r} l 0 ${r} b 0 ${r - k} ${r - k} 0 ${r} 0`;
    const interval = `${time(cue.startMs)},${time(cue.endMs)},Caption,,0,0,0,,`;
    events.push(`Dialogue: 0,${interval}{\\an7\\pos(${x - width / 2},${y - height / 2})\\p1\\c&H000000&\\bord0\\shad0}${path}`);
    const reveal = cue.words.map(word => {
      const start = Math.max(0, word.startMs - cue.startMs);
      const end = Math.min(cue.endMs - cue.startMs, Math.max(start + 1, Math.min(word.endMs - cue.startMs, start + 240)));
      return `{\\rCaption\\c&H555555&\\3c&H555555&\\t(${start},${end},2,\\c&HFFFFFF&\\3c&HFFFFFF&)}${escapeAssText(word.text)}`;
    }).join(" ");
    events.push(`Dialogue: 1,${interval}{\\an7\\pos(${x - ink.width / 2 - ink.left},${y - lineInk.height / 2 - lineInk.top + layout.fontSize * .06})}${reveal}`);
  }
  return header(layout) + events.join("\n") + "\n";
}
