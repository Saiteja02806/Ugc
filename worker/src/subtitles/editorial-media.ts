import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeAssText, type SubtitleLayout } from "./captions.js";
import type { SubtitleTools } from "./media.js";
import { editorialFontTags, editorialHeader, type MeasureEditorial, type EditorialFont } from "./editorial.js";
import { createBatchedInkMeasurer } from "./batched-ink.js";

export async function prepareEditorialFonts(tools: SubtitleTools, workDir: string) {
  await mkdir(join(workDir, "fonts"));
  for (const file of ["editorial-500.ttf", "editorial-500i.ttf", "editorial-900i.ttf", "OFL.txt"])
    await copyFile(join(tools.fontsDir, "subtitle-editorial", file), join(workDir, "fonts", file));
}

/** Measure with the final renderer. Pango and ASS font-size conventions are not interchangeable. */
export function createEditorialMeasurer(layout: SubtitleLayout, tools: SubtitleTools, workDir: string, signal?: AbortSignal): MeasureEditorial {
  type Request = { text: string; size: number; font: EditorialFont };
  const batch = createBatchedInkMeasurer<Request>({ tools, workDir, signal, prefix: "editorial-measure", key: value => JSON.stringify(value),
    fontError: "The Editorial fonts could not render these words.", emptyError: "No visible Editorial text was rendered.",
    describe: ({ text, size, font }) => {
      const width = Math.ceil((layout.width * 1.4 + 128) / 2) * 2, height = Math.ceil(Math.max(400, size * 2 + 128) / 2) * 2;
      const selected = font === "hero" ? "Black-Italic" : font === "lead" ? "Medium-Italic" : "Medium";
      return { width, height, header: editorialHeader({ width, height }),
        body: `{\\an7\\pos(64,64)\\fs${size}${editorialFontTags(font)}\\bord0\\shad0\\c&H00FFFFFF&}${escapeAssText(text)}`,
        selectedFont: new RegExp(`UGCPilot-Editorial-Study-${selected}`, "u") };
    } });
  return Object.assign((text: string, size: number, font: EditorialFont) => batch({ text, size, font }),
    { preload: (texts: string[], size: number, font: EditorialFont) => batch.preload(texts.map(text => ({ text, size, font }))) });
}
