import { readFile } from "node:fs/promises";
import { join } from "node:path";
import opentype from "opentype.js";
import { estimateEditOverlayLineWidth } from "./edit-overlay-render-spec.js";
import { formatTextLayout, type ExploreFormatText } from "./explore-format-edit.js";
import { serializeGlyphPath } from "./svg-glyph-path.js";
import { formatInlineRuns, formatInlineSymbolSvg, formatTextEmojiError, formatTextGraphemes, type FormatInlineRun } from "./explore-inline-symbols.js";
import { readExploreEmojiArtwork } from "./explore-emoji-artwork.js";


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

/** Bundled text outlines and emoji artwork; CJK retains its existing fallback. */
export async function createOutlinedFormatTextSvg(text: ExploreFormatText, width: number, height: number, fontsDir: string) {
  const emojiError = formatTextEmojiError(text.value);
  if (emojiError) throw new Error(emojiError);
  const layout = formatTextLayout(text, width, height), background = layout.background;
  const file = text.font ? join(fontsDir, "explore-text", `${text.font}-${layout.fontWeight}.ttf`) : join(fontsDir, layout.fontWeight === 700 ? "arial-bold.ttf" : "arial-regular.ttf");
  const font = await readFont(file);
  const lines = (await Promise.all(layout.lines.map(async (line, i) => {
    const runs: (FormatInlineRun & { text: string; supported: boolean })[] = [];
    for (const run of formatInlineRuns(line.normalize("NFC"))) {
      if (run.symbol || run.artwork) { runs.push({ ...run, text: run.value, supported: false }); continue; }
      for (const character of formatTextGraphemes(run.value)) {
        const supported = Array.from(character).every(value => font.hasChar(value)), previous = runs.at(-1);
        if (previous && !previous.symbol && !previous.emoji && previous.supported === supported) previous.text += character;
        else runs.push({ ...run, text: character, supported });
      }
    }
    const advance = (value: string) => Array.from(value).reduce((sum, character) => sum + (font.charToGlyph(character).advanceWidth ?? font.unitsPerEm) * layout.fontSize / font.unitsPerEm, 0);
    const advances = runs.map(run => run.symbol || run.emoji ? layout.fontSize : run.supported ? advance(run.text) : estimateEditOverlayLineWidth(run.text, layout.fontSize));

    let x = layout.x - advances.reduce((sum, advance) => sum + advance, 0) / 2;
    const y = layout.y + i * layout.lineHeight + layout.fontSize;
    return (await Promise.all(runs.map(async (run, index) => {
      const startX = x;
      x += advances[index];
      let glyphX = startX;
      const paths = run.supported ? Array.from(run.text).map(character => {
        const glyph = font.charToGlyph(character), data = serializeGlyphPath(glyph.getPath(glyphX, y, layout.fontSize));
        glyphX += (glyph.advanceWidth ?? font.unitsPerEm) * layout.fontSize / font.unitsPerEm;
        return `<path d="${data}"/>`;
      }).join("") : "";
      const markup = run.symbol ? formatInlineSymbolSvg(run.symbol, startX, y - layout.fontSize, layout.fontSize) : run.artwork
        ? `<image data-format-emoji="${run.artwork}" aria-label="${escapeXml(run.value)}" x="${startX}" y="${y - layout.fontSize}" width="${layout.fontSize}" height="${layout.fontSize}" href="data:image/svg+xml;base64,${Buffer.from(await readExploreEmojiArtwork(run.artwork, join(fontsDir, "../emoji"))).toString("base64")}"/>`
        : run.supported ? paths : `<text x="${startX}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${layout.fontSize}" font-weight="${layout.fontWeight}">${escapeXml(run.text)}</text>`;
      return markup;
    }))).join("");
  }))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${background ? `<rect x="0" y="${background.y}" width="${width}" height="${background.height}" fill="#000000" fill-opacity="${background.opacity}"/>` : ""}<g fill="${text.color}"${background ? "" : ` stroke="black" stroke-width="${width / 540}" paint-order="stroke"`}>${lines}</g></svg>`;
}
