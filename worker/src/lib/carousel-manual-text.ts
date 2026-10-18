import { EXPLORE_TEXT_FONTS, exploreTextFontFamily, exploreTextLineWidth, isExploreTextFont, type ExploreTextFont } from "./explore-text-fonts.js";

export { EXPLORE_TEXT_FONTS as CAROUSEL_EDIT_FONTS };
export const CAROUSEL_MANUAL_TEXT_VERSION = "carousel-manual-typography-v1";
export type CarouselManualTextStyle = {
  font: ExploreTextFont;
  fontSize: number;
  headingSize: number;
  color: string;
  headingColor: string;
};
export type CarouselManualSlide = {
  headline: string; subtext: string; ctaText: string; slideNumber: number;
  textPosition: { x: number; y: number }; renderFormat: "1:1" | "4:5";
  textStyle?: CarouselManualTextStyle | null;
};
export function parseCarouselManualTextStyle(value: unknown): CarouselManualTextStyle | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid slideshow text style.");
  const v = value as CarouselManualTextStyle;
  if (!isExploreTextFont(v.font) || ![v.fontSize, v.headingSize].every(n => Number.isInteger(n) && n >= 24 && n <= 120) ||
      ![v.color, v.headingColor].every(c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))) throw new Error("Invalid slideshow text style.");
  return { font: v.font, fontSize: v.fontSize, headingSize: v.headingSize, color: v.color.toLowerCase(), headingColor: v.headingColor.toLowerCase() };
}
export function defaultCarouselManualTextStyle(): CarouselManualTextStyle {
  return { font: "inter", fontSize: 60, headingSize: 72, color: "#ffffff", headingColor: "#111316" };
}
type Row = { text: string; x: number; y: number; width: number; size: number; weight: 400 | 500 | 700; color: string; heading: boolean };
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : .5));

/** Manual edits use the same bundled font advances, wrapping and geometry in
 * browser and worker. Generation's fixed typography remains separate. */
export function createCarouselManualLayout(slide: CarouselManualSlide) {
  const style = parseCarouselManualTextStyle(slide.textStyle) ?? defaultCarouselManualTextStyle();
  const frameHeight = slide.renderFormat === "1:1" ? 1080 : 1350;
  const rows: Row[] = []; let top = 0;
  const heading = slide.slideNumber === 1 ? slide.headline.trim() || slide.subtext.trim() : slide.subtext.trim() ? slide.headline.trim() : "";
  const body = slide.slideNumber === 1 ? "" : slide.subtext.trim() || slide.headline.trim();
  function add(text: string, isHeading: boolean) {
    if (!text.trim()) return;
    if (rows.length) top += 26;
    const size = isHeading ? style.headingSize : style.fontSize;
    const weight = isHeading ? 500 : 400;
    const widthOf = (value: string) => exploreTextLineWidth(value, style.font, weight, size, (_c, s) => s);
    const wrapped: string[] = [];
    for (const paragraph of text.split(/\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (widthOf(candidate) <= 790) { line = candidate; continue; }
        if (line) wrapped.push(line);
        line = "";
        for (const char of word) {
          if (line && widthOf(line + char) > 790) { wrapped.push(line); line = ""; }
          line += char;
        }
      }
      if (line) wrapped.push(line);
      else if (!paragraph.trim()) wrapped.push("");
    }
    if (isHeading) top += 15;
    for (const text of wrapped) {
      rows.push({ text, x: 0, y: top + size, width: widthOf(text), size, weight, color: isHeading ? style.headingColor : style.color, heading: isHeading });
      top += Math.ceil(size * 1.16);
    }
    if (isHeading) top += 15;
  }
  add(heading, true); add(body, false);
  if (slide.slideNumber !== 1) add(slide.ctaText, false);
  const width = Math.ceil(Math.max(1, ...rows.map(r => r.width + (r.heading ? 48 : 8))));
  const height = Math.max(1, top + 8);
  for (const row of rows) row.x = width / 2;
  const fits = width <= 888 && height <= frameHeight - 192;
  const bounds = { minX: (96 + width / 2) / 1080, maxX: 1 - (96 + width / 2) / 1080,
    minY: (96 + height / 2) / frameHeight, maxY: 1 - (96 + height / 2) / frameHeight };
  const position = fits ? { x: clamp(slide.textPosition.x, bounds.minX, bounds.maxX), y: clamp(slide.textPosition.y, bounds.minY, bounds.maxY) } : { x: .5, y: .5 };
  return { rows, width, height, frameHeight, fits, position, bounds, style };
}
export type CarouselManualLayout = ReturnType<typeof createCarouselManualLayout>;
export function carouselManualTextMarkup(layout: CarouselManualLayout, glyphs?: (row: Row, font: ExploreTextFont) => string) {
  const backgrounds = layout.rows.filter(row => row.heading && row.text).map(row => `<rect x="${(layout.width - row.width) / 2 - 24}" y="${row.y - row.size - 15}" width="${row.width + 48}" height="${Math.ceil(row.size * 1.16) + 30}" rx="14" fill="#ffffff"/>`).join("");
  return backgrounds + layout.rows.map(row => `<g fill="${row.color}"${row.heading ? "" : ' stroke="#111316" stroke-width="4" paint-order="stroke" stroke-linejoin="round"'}>${glyphs ? glyphs(row, layout.style.font) : `<text x="${row.x}" y="${row.y}" font-family="${exploreTextFontFamily(layout.style.font, row.weight)}" font-size="${row.size}" font-weight="${row.weight}" font-kerning="none" text-anchor="middle">${escape(row.text)}</text>`}</g>`).join("");
}
