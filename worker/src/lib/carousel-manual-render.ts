import sharp from "sharp";
import opentype from "opentype.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { carouselManualTextMarkup, createCarouselManualLayout, type CarouselManualSlide } from "./carousel-manual-text.js";
import { serializeGlyphPath } from "./svg-glyph-path.js";

const fonts = new Map<string, Promise<opentype.Font>>();
const fontsDir = ["../../assets/fonts/", "../../src/assets/fonts/", "../assets/fonts/"].map(path => fileURLToPath(new URL(path, import.meta.url)))
  .find(path => existsSync(resolve(path, "explore-text/inter-400.ttf")));
export async function createCarouselManualSvg(slide: CarouselManualSlide) {
  if (!fontsDir) throw new Error("The slideshow font bundle is unavailable.");
  const layout = createCarouselManualLayout(slide);
  if (!layout.fits) throw new Error(`Slide ${slide.slideNumber}: text does not fit. Reduce the font size or shorten the text.`);
  const loaded = new Map<number, opentype.Font>();
  for (const weight of new Set(layout.rows.map(row => row.weight))) {
    const file = resolve(fontsDir, "explore-text", `${layout.style.font}-${weight}.ttf`);
    let pending = fonts.get(file);
    if (!pending) { pending = readFile(file).then(bytes => opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)).catch(error => { fonts.delete(file); throw error; }); fonts.set(file, pending); }
    loaded.set(weight, await pending);
  }
  const markup = carouselManualTextMarkup(layout, row => {
    const font = loaded.get(row.weight)!;
    // Unsupported glyphs must not silently become missing-character boxes.
    if (Array.from(row.text).some(c => !font.hasChar(c))) throw new Error(`Slide ${slide.slideNumber}: this font does not support all characters in the text.`);
    let x = row.x - row.width / 2;
    return Array.from(row.text).map(c => { const glyph = font.charToGlyph(c), path = serializeGlyphPath(glyph.getPath(x, row.y, row.size)); x += (glyph.advanceWidth ?? font.unitsPerEm) / font.unitsPerEm * row.size; return `<path d="${path}"/>`; }).join("");
  });
  return { layout, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${layout.frameHeight}"><g transform="translate(${layout.position.x * 1080 - layout.width / 2},${layout.position.y * layout.frameHeight - layout.height / 2})">${markup}</g></svg>` };
}
export async function renderCarouselManualSlide(input: { assetUrl: string; slide: CarouselManualSlide }) {
  const { layout, svg } = await createCarouselManualSvg(input.slide);
  const response = await fetch(input.assetUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Could not load slide background (${response.status}).`);
  const buffer = await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize(1080, layout.frameHeight, { fit: "cover", position: "centre" })
    .composite([{ input: Buffer.from(svg) }]).webp({ effort: 5, quality: 92 }).toBuffer();
  return { buffer, diagnostics: { manualTextStyle: layout.style, position: layout.position, fontSize: layout.style.fontSize, headingSize: layout.style.headingSize } };
}
