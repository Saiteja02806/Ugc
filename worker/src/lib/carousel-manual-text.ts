import { EXPLORE_TEXT_FONTS, exploreTextFontFamily, exploreTextLineWidth, isExploreTextFont, isExploreTextWeight, type ExploreTextFont } from "./explore-text-fonts.ts";

export { EXPLORE_TEXT_FONTS as CAROUSEL_EDIT_FONTS };
export const CAROUSEL_MANUAL_TEXT_VERSION = "carousel-manual-typography-v2";
type Background = "none" | "line" | "box";
export type CarouselManualTextStyle = {
  font: ExploreTextFont;
  fontSize: number;
  headingSize: number;
  color: string;
  headingColor: string;
  textWidth?: number; align?: "left" | "center" | "right"; lineHeight?: number;
  fontWeight?: 400 | 500 | 700; headingWeight?: 400 | 500 | 700;
  headingBackground?: Background; bodyBackground?: Background; backgroundColor?: string; backgroundOpacity?: number;
  outline?: boolean;
};
export type CarouselManualSlide = {
  headline: string; subtext: string; ctaText: string; slideNumber: number;
  textPosition: { x: number; y: number }; renderFormat: "1:1" | "4:5";
  textStyle?: CarouselManualTextStyle | null;
  storyTextTreatment?: string | null;
};
export function parseCarouselManualTextStyle(value: unknown): CarouselManualTextStyle | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid slideshow text style.");
  const v = value as CarouselManualTextStyle;
  const validRange = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (v.textWidth !== undefined && !validRange(v.textWidth, 160, 888) || v.lineHeight !== undefined && !validRange(v.lineHeight, .95, 2) ||
      v.align !== undefined && !["left", "center", "right"].includes(v.align) ||
      v.fontWeight !== undefined && !isExploreTextWeight(v.fontWeight) || v.headingWeight !== undefined && !isExploreTextWeight(v.headingWeight) ||
      [v.headingBackground, v.bodyBackground].some(b => b !== undefined && !["none", "line", "box"].includes(b)) ||
      v.backgroundColor !== undefined && (typeof v.backgroundColor !== "string" || !/^#[0-9a-f]{6}$/i.test(v.backgroundColor)) ||
      v.backgroundOpacity !== undefined && !validRange(v.backgroundOpacity, 0, 1) || v.outline !== undefined && typeof v.outline !== "boolean") throw new Error("Invalid slideshow text style.");
  if (!isExploreTextFont(v.font) || ![v.fontSize, v.headingSize].every(n => Number.isInteger(n) && n >= 24 && n <= 120) ||
      ![v.color, v.headingColor].every(c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))) throw new Error("Invalid slideshow text style.");
  return { font: v.font, fontSize: v.fontSize, headingSize: v.headingSize, color: v.color.toLowerCase(), headingColor: v.headingColor.toLowerCase(),
    ...Object.fromEntries((["textWidth", "align", "lineHeight", "fontWeight", "headingWeight", "headingBackground", "bodyBackground", "backgroundColor", "backgroundOpacity", "outline"] as const).flatMap(key => v[key] === undefined ? [] : [[key, v[key]]])) };
}
export function defaultCarouselManualTextStyle(source?: Pick<CarouselManualSlide, "storyTextTreatment">): CarouselManualTextStyle {
  const pill = source?.storyTextTreatment === "pill";
  return { font: "inter", fontSize: 60, headingSize: 72, color: "#ffffff", headingColor: pill ? "#111316" : "#ffffff",
    textWidth: 790, align: "center", lineHeight: 1.16, fontWeight: 400, headingWeight: 500,
    headingBackground: pill ? "line" : "none", bodyBackground: "none", backgroundColor: pill ? "#ffffff" : "#111314", backgroundOpacity: 1, outline: true };
}
/** Keep saved v1 heading panels, while new manual changes inherit only explicit source panels. */
export function resolveCarouselManualTextStyle(slide: Pick<CarouselManualSlide, "textStyle" | "storyTextTreatment">) {
  const saved = parseCarouselManualTextStyle(slide.textStyle);
  return saved ? { ...defaultCarouselManualTextStyle(), headingBackground: "line" as Background, backgroundColor: "#ffffff", ...saved } : defaultCarouselManualTextStyle(slide);
}
type Row = { text: string; x: number; y: number; width: number; size: number; lineHeight: number; weight: 400 | 500 | 700; color: string; heading: boolean; group: number; background: Background };
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : .5));

/** Manual edits use the same bundled font advances, wrapping and geometry in
 * browser and worker. Generation's fixed typography remains separate. */
export function createCarouselManualLayout(slide: CarouselManualSlide) {
  const style = resolveCarouselManualTextStyle(slide);
  const frameHeight = slide.renderFormat === "1:1" ? 1080 : 1350;
  const rows: Row[] = []; let top = 0, group = 0;
  const heading = slide.slideNumber === 1 ? slide.headline.trim() || slide.subtext.trim() : slide.subtext.trim() ? slide.headline.trim() : "";
  const body = slide.slideNumber === 1 ? "" : slide.subtext.trim() || slide.headline.trim();
  function add(text: string, isHeading: boolean) {
    if (!text.trim()) return;
    if (rows.length) top += 26;
    group++;
    const size = isHeading ? style.headingSize : style.fontSize;
    const weight = (isHeading ? style.headingWeight : style.fontWeight) ?? (isHeading ? 500 : 400);
    const background = (isHeading ? style.headingBackground : style.bodyBackground) ?? "none";
    const lineHeight = Math.ceil(size * (style.lineHeight ?? 1.16));
    const widthOf = (value: string) => exploreTextLineWidth(value, style.font, weight, size, (_c, s) => s);
    const wrapped: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (widthOf(candidate) <= (style.textWidth ?? 790)) { line = candidate; continue; }
        if (line) wrapped.push(line);
        line = "";
        for (const char of word) {
          if (line && widthOf(line + char) > (style.textWidth ?? 790)) { wrapped.push(line); line = ""; }
          line += char;
        }
      }
      if (line) wrapped.push(line);
      else if (!paragraph.trim()) wrapped.push("");
    }
    if (background !== "none") top += 15;
    for (const text of wrapped) {
      rows.push({ text, x: 0, y: top + size, width: widthOf(text), size, lineHeight, weight, color: isHeading ? style.headingColor : style.color, heading: isHeading, group, background });
      top += lineHeight;
    }
    if (background !== "none") top += 15;
  }
  add(heading, true); add(body, false);
  if (slide.slideNumber !== 1) add(slide.ctaText, false);
  const width = Math.ceil(Math.max(1, ...rows.map(r => r.width + (r.background !== "none" ? 48 : 8))));
  const height = Math.ceil(Math.max(1, top + 8, ...rows.map(row => row.y + row.size * .3 + 4)));
  for (const row of rows) row.x = style.align === "left" ? (row.background === "none" ? 4 : 24) + row.width / 2 : style.align === "right" ? width - (row.background === "none" ? 4 : 24) - row.width / 2 : width / 2;
  const fits = width <= 888 && height <= frameHeight - 192;
  const bounds = { minX: (96 + width / 2) / 1080, maxX: 1 - (96 + width / 2) / 1080,
    minY: (96 + height / 2) / frameHeight, maxY: 1 - (96 + height / 2) / frameHeight };
  const position = fits ? { x: clamp(slide.textPosition.x, bounds.minX, bounds.maxX), y: clamp(slide.textPosition.y, bounds.minY, bounds.maxY) } : { x: .5, y: .5 };
  return { rows, width, height, frameHeight, fits, position, bounds, style };
}
export type CarouselManualLayout = ReturnType<typeof createCarouselManualLayout>;
export function carouselManualTextMarkup(layout: CarouselManualLayout, glyphs?: (row: Row, font: ExploreTextFont) => string) {
  const boxes = new Set<number>();
  const backgrounds = layout.rows.filter(row => row.background !== "none" && row.text).map(row => {
    if (row.background === "box") {
      if (boxes.has(row.group)) return "";
      boxes.add(row.group);
      const last = layout.rows.filter(r => r.group === row.group).at(-1)!;
      return `<rect x="0" y="${row.y - row.size - 15}" width="${layout.width}" height="${last.y - row.y + row.lineHeight + 30}" rx="14" fill="${layout.style.backgroundColor}" fill-opacity="${layout.style.backgroundOpacity}"/>`;
    }
    return `<rect x="${row.x - row.width / 2 - 24}" y="${row.y - row.size - 15}" width="${row.width + 48}" height="${row.lineHeight + 30}" rx="14" fill="${layout.style.backgroundColor}" fill-opacity="${layout.style.backgroundOpacity}"/>`;
  }).join("");
  return backgrounds + layout.rows.map(row => `<g fill="${row.color}"${row.background !== "none" || !layout.style.outline ? "" : ' stroke="#111316" stroke-width="4" paint-order="stroke" stroke-linejoin="round"'}>${glyphs ? glyphs(row, layout.style.font) : `<text x="${row.x}" y="${row.y}" font-family="${exploreTextFontFamily(layout.style.font, row.weight)}" font-size="${row.size}" font-weight="${row.weight}" font-kerning="none" text-anchor="middle">${escape(row.text)}</text>`}</g>`).join("");
}
