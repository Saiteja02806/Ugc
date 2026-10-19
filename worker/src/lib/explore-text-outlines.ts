import { readFile } from "node:fs/promises";
import { join } from "node:path";
import opentype from "opentype.js";
import { estimateEditOverlayLineWidth } from "./edit-overlay-render-spec.js";
import { formatTextLayout, type ExploreFormatText } from "./explore-format-edit.js";
import { serializeGlyphPath } from "./svg-glyph-path.js";

const fonts = new Map<string, Promise<opentype.Font>>();
const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
async function readFont(file: string) {
  let pending = fonts.get(file);
  if (!pending) {
    pending = readFile(file).then(bytes => opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer))
      .catch(error => { fonts.delete(file); throw error; });
    fonts.set(file, pending);
  }
  return pending;
}

/** Draw bundled glyph outlines, bypassing OS font lookup entirely. Unsupported
 * characters retain the existing SVG/system fallback, including emoji/CJK. */
export async function createOutlinedFormatTextSvg(text: ExploreFormatText, width: number, height: number, fontsDir: string) {
  const layout = formatTextLayout(text, width, height), background = layout.background;
  const file = text.font ? join(fontsDir, "explore-text", `${text.font}-${layout.fontWeight}.ttf`) : join(fontsDir, layout.fontWeight === 700 ? "arial-bold.ttf" : "arial-regular.ttf");
  const font = await readFont(file);
  const lines = layout.lines.map((line, i) => {
    const runs: { text: string; supported: boolean }[] = [];
    for (const character of Array.from(line.normalize("NFC"))) {
      const supported = font.hasChar(character), previous = runs.at(-1);
      if (previous?.supported === supported) previous.text += character;
      else runs.push({ text: character, supported });
    }
    const advance = (value: string) => Array.from(value).reduce((sum, character) => sum + (font.charToGlyph(character).advanceWidth ?? font.unitsPerEm) * layout.fontSize / font.unitsPerEm, 0);
    const advances = runs.map(run => run.supported ? advance(run.text) : estimateEditOverlayLineWidth(run.text, layout.fontSize));
    let x = (width - advances.reduce((sum, advance) => sum + advance, 0)) / 2;
    const y = layout.y + i * layout.lineHeight + layout.fontSize;
    return runs.map((run, index) => {
      let glyphX = x;
      const paths = run.supported ? Array.from(run.text).map(character => {
        const glyph = font.charToGlyph(character), data = serializeGlyphPath(glyph.getPath(glyphX, y, layout.fontSize));
        glyphX += (glyph.advanceWidth ?? font.unitsPerEm) * layout.fontSize / font.unitsPerEm;
        return `<path d="${data}"/>`;
      }).join("") : "";
      const markup = run.supported ? paths
        : `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${layout.fontSize}" font-weight="${layout.fontWeight}">${escapeXml(run.text)}</text>`;
      x += advances[index];
      return markup;
    }).join("");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${background ? `<rect x="0" y="${background.y}" width="${width}" height="${background.height}" fill="#000000" fill-opacity="${background.opacity}"/>` : ""}<g fill="${text.color}"${background ? "" : ` stroke="black" stroke-width="${width / 540}" paint-order="stroke"`}>${lines}</g></svg>`;
}
