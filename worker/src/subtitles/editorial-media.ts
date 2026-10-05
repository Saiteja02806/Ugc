import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { SubtitleError } from "./contracts.js";
import { escapeAssText, type SubtitleLayout } from "./captions.js";
import { runMediaCommand, type SubtitleTools } from "./media.js";
import { editorialFontTags, editorialHeader, type MeasureEditorial, type EditorialFont, type InkBounds } from "./editorial.js";

export async function prepareEditorialFonts(tools: SubtitleTools, workDir: string) {
  await mkdir(join(workDir, "fonts"));
  for (const file of ["editorial-500.ttf", "editorial-500i.ttf", "editorial-900i.ttf", "OFL.txt"])
    await copyFile(join(tools.fontsDir, "subtitle-editorial", file), join(workDir, "fonts", file));
}

/** Measure with the final renderer. Pango and ASS font-size conventions are not interchangeable. */
export function createEditorialMeasurer(layout: SubtitleLayout, tools: SubtitleTools, workDir: string, signal?: AbortSignal): MeasureEditorial {
  const cache = new Map<string, Promise<InkBounds>>();
  let queue = Promise.resolve();
  return (text, size, font) => {
    const key = JSON.stringify([text, size, font]);
    let result = cache.get(key);
    if (!result) {
      result = queue.then(() => measure(text, size, font));
      // One raster probe at a time: bounded memory and no shared-file races.
      queue = result.then(() => undefined, () => undefined);
      cache.set(key, result);
    }
    return result;
  };
  async function measure(text: string, size: number, font: EditorialFont): Promise<InkBounds> {
    signal?.throwIfAborted();
    const width = Math.ceil((layout.width * 1.4 + 128) / 2) * 2;
    const height = Math.ceil(Math.max(400, size * 2 + 128) / 2) * 2;
    const padding = 64;
    const ass = editorialHeader({ width, height }) + `Dialogue: 0,0:00:00.00,0:00:01.00,Caption,,0,0,0,,{\\an7\\pos(${padding},${padding})\\fs${size}${editorialFontTags(font)}\\bord0\\shad0\\c&H00FFFFFF&}${escapeAssText(text)}\n`;
    await writeFile(join(workDir, "measure.ass"), ass);
    const rendered = await runMediaCommand(tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "verbose", "-y", "-protocol_whitelist", "file,pipe",
      "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:r=24`, "-vf", "ass=measure.ass:fontsdir=fonts", "-frames:v", "1", "measure.png"], { cwd: workDir, signal, timeoutMs: 15000 });
    const selected = font === "hero" ? "Black-Italic" : font === "lead" ? "Medium-Italic" : "Medium";
    if (!rendered.stderr.includes(`UGCPilot-Editorial-Study-${selected}`) || /Glyph.*not found|fontselect: failed/iu.test(rendered.stderr))
      throw new SubtitleError("FONT_UNAVAILABLE", "The Editorial fonts could not render these words.");
    const { data, info } = await sharp(join(workDir, "measure.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = width, right = -1, top = height, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * info.channels] > 32) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < 0) throw new SubtitleError("FONT_UNAVAILABLE", "No visible Editorial text was rendered.");
    // A clipped probe is never treated as a fitting word.
    return { left: left - padding, top: top - padding, width: right >= width - 3 ? width * 2 : right - left + 1, height: bottom - top + 1 };
  }
}
