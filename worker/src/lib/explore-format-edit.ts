import { estimateEditOverlayLineWidth } from "./edit-overlay-render-spec.ts";
import { exploreTextFontFamily, exploreTextLineWidth, isExploreTextFont, isExploreTextWeight, resolveExploreTextWeight, type ExploreTextFont, type ExploreTextWeight } from "./explore-text-fonts.ts";
import { formatInlineRuns, formatInlineSymbolSvg, formatTextGraphemes, measureFormatInlineText } from "./explore-inline-symbols.ts";
export { formatInlineSymbolPaths } from "./explore-inline-symbols.ts";
export { formatTextEmojiError } from "./explore-inline-symbols.ts";

export { EXPLORE_TEXT_FONTS, EXPLORE_TEXT_WEIGHTS, exploreTextFontFamily, exploreTextWeights, resolveExploreTextWeight } from "./explore-text-fonts.ts";
export type { ExploreTextFont, ExploreTextWeight } from "./explore-text-fonts.ts";

export type FormatTextPreset = "bold" | "snapchat-classic" | "reference-social" | "reference-classic";
export type ExploreFormatText = { value: string; width: number; x?: number; y: number; fontSize: number; color: string; startMs: number; endMs: number; preset?: FormatTextPreset; backgroundOpacity?: number; font?: ExploreTextFont; fontWeight?: ExploreTextWeight; outlineWidth?: number; lineHeight?: number; align?: "left"; boxColor?: string };
export type ExploreFormatEdit = { version: 1; format: "hook" | "wall_text"; trimStartMs: number; trimEndMs: number; originalVolume: number; musicVolume: number; text: ExploreFormatText | null; textOverlays?: ExploreFormatText[] };
/** Historical automatic-plan style; saved edits keep explicit/legacy typography. */
export const DEFAULT_FORMAT_TEXT_STYLE = { font: "proximanovaa", fontWeight: 600, color: "#ffffff", outlineWidth: 8 } as const;
/** Explicit new-edit treatment; historical jobs/drafts keep the legacy default. */
export const REFERENCE_FORMAT_TEXT_STYLE = { preset: "reference-social", font: "tiktoksans", fontWeight: 700, color: "#ffffff", outlineWidth: 6, lineHeight: 1.2 } as const;
export const MAX_FORMAT_TEXT_OVERLAYS = 20;
export const FORMAT_TEXT_SEQUENCE_RENDER_VERSION = "explore-format-edit-text-v2";
export function formatTextOverlays(edit: ExploreFormatEdit): ExploreFormatText[] {
  return edit.textOverlays ?? (edit.text ? [edit.text] : []);
}
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const obj = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function parseExploreFormatEdit(value: unknown): ExploreFormatEdit {
  const v = obj(value);
  if (Object.keys(v).some(key => !["version", "format", "trimStartMs", "trimEndMs", "originalVolume", "musicVolume", "text", "textOverlays"].includes(key)) || v.version !== 1 || !["hook", "wall_text"].includes(String(v.format)) ||
      !finite(v.trimStartMs) || !finite(v.trimEndMs) || !Number.isInteger(v.trimStartMs) || !Number.isInteger(v.trimEndMs) || v.trimStartMs < 0 || v.trimEndMs > 120_000 || v.trimEndMs - v.trimStartMs < 1000 ||
      !finite(v.originalVolume) || v.originalVolume < 0 || v.originalVolume > 1 || !finite(v.musicVolume) || v.musicVolume < 0 || v.musicVolume > 1) throw new Error("Choose a valid trim range and audio levels.");
  const trimmedDurationMs = v.trimEndMs - v.trimStartMs;
  function parseText(value: unknown): ExploreFormatText {
    const t = obj(value);
    if (t.align !== undefined && t.align !== "left") throw new Error("Choose a supported text alignment.");
    if (t.boxColor !== undefined && (typeof t.boxColor !== "string" || !/^#[0-9a-f]{6}$/iu.test(t.boxColor))) throw new Error("Choose a valid text box color.");
    const textLimit = v.format === "wall_text" ? 6000 : 600;
    if (Object.keys(t).some(key => !["value", "width", "x", "y", "fontSize", "color", "startMs", "endMs", "preset", "backgroundOpacity", "font", "fontWeight", "outlineWidth", "lineHeight", "align", "boxColor"].includes(key)) || typeof t.value !== "string" || !t.value.trim() || t.value.length > textLimit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(t.value) ||
        !finite(t.width) || t.width < .4 || t.width > .94 || !finite(t.y) || t.y < .03 || t.y > .9 || !finite(t.fontSize) || t.fontSize < 24 || t.fontSize > 84 ||
        typeof t.color !== "string" || !/^#[0-9a-f]{6}$/i.test(t.color) || !finite(t.startMs) || !finite(t.endMs) || !Number.isInteger(t.startMs) || !Number.isInteger(t.endMs) || t.startMs < 0 || t.endMs <= t.startMs || t.endMs > trimmedDurationMs) throw new Error("Choose valid text, position, and timing within your trimmed video.");
    if (t.x !== undefined && (!finite(t.x) || t.x < .03 || t.x > .97)) throw new Error("Choose a valid horizontal text position.");
    if (t.preset !== undefined && !["bold", "snapchat-classic", "reference-social", "reference-classic"].includes(String(t.preset)) || t.backgroundOpacity !== undefined && (t.preset !== "snapchat-classic" || !finite(t.backgroundOpacity) || t.backgroundOpacity < 0 || t.backgroundOpacity > 1)) throw new Error("Choose a supported text preset and background opacity.");
    if (t.font !== undefined && !isExploreTextFont(t.font) || t.fontWeight !== undefined && (!(isExploreTextWeight(t.fontWeight) || t.fontWeight === 600 && t.font === "proximanovaa") || t.font === undefined && t.fontWeight === 500)) throw new Error("Choose a supported font and weight.");
    if (t.outlineWidth !== undefined && (!finite(t.outlineWidth) || t.outlineWidth < 0 || t.outlineWidth > 16)) throw new Error("Choose an outline thickness from 0 to 16.");
    if (t.lineHeight !== undefined && (!finite(t.lineHeight) || t.lineHeight < 1 || t.lineHeight > 1.5)) throw new Error("Choose valid text line spacing.");
    return { value: t.value.replaceAll("\r\n", "\n"), width: t.width, y: t.y, fontSize: t.fontSize, color: t.color.toLowerCase(), startMs: t.startMs, endMs: t.endMs, ...(t.align === "left" ? { align: "left" as const } : {}), ...(typeof t.boxColor === "string" ? { boxColor: t.boxColor.toLowerCase() } : {}),
      ...(t.x === undefined ? {} : { x: t.x }), ...(t.preset === undefined ? {} : { preset: t.preset as FormatTextPreset }), ...(t.backgroundOpacity === undefined ? {} : { backgroundOpacity: t.backgroundOpacity as number }),
      ...(t.font === undefined ? {} : { font: t.font as ExploreTextFont }), ...(t.fontWeight === undefined ? {} : { fontWeight: t.fontWeight as ExploreTextWeight }),
      ...(t.outlineWidth === undefined ? {} : { outlineWidth: t.outlineWidth }), ...(t.lineHeight === undefined ? {} : { lineHeight: t.lineHeight }) };
  }
  const text = v.text === null ? null : parseText(v.text);
  let textOverlays: ExploreFormatText[] | undefined;
  if (v.textOverlays !== undefined) {
    if (text || !Array.isArray(v.textOverlays) || v.textOverlays.length > MAX_FORMAT_TEXT_OVERLAYS) throw new Error("Choose up to 20 text overlays using one supported text format.");
    textOverlays = v.textOverlays.map(parseText);
  }
  // Omit the new field from legacy edits so durable request fingerprints survive.
  return { version: 1, format: v.format as ExploreFormatEdit["format"], trimStartMs: v.trimStartMs, trimEndMs: v.trimEndMs, originalVolume: v.originalVolume, musicVolume: v.musicVolume, text,
    ...(textOverlays === undefined ? {} : { textOverlays }) };
}

/** Explicit lines and blank paragraphs survive. One layout drives preview/export. */
export function formatTextLayout(text: ExploreFormatText, width: number, height: number) {
  const fontSize = text.fontSize * width / 1080;
  const maxWidth = width * text.width;
  const fontWeight = resolveExploreTextWeight(text.font, text.fontWeight ?? (text.preset === "snapchat-classic" ? 400 : 700));
  const measure = (value: string) => measureFormatInlineText(value, fontSize, part => text.font ? exploreTextLineWidth(part, text.font, fontWeight, fontSize, estimateEditOverlayLineWidth) : estimateEditOverlayLineWidth(part, fontSize));

  const lines: string[] = [];
  for (const paragraph of text.value.split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line + word;
      if (line && measure(candidate) > maxWidth) { lines.push(line); line = ""; }
      // Break an unspaced long word safely rather than cropping or losing it.
      for (const character of formatTextGraphemes(word)) {
        const next = line + character;
        if (measure(next) > maxWidth && line) { lines.push(line); line = ""; }
        line += character;
      }
      line += " ";
    }
    lines.push(line.trimEnd());
  }
  const classic = text.preset === "snapchat-classic", padding = classic || text.boxColor ? width * .018 : 0;
  const lineHeight = fontSize * (text.lineHeight ?? (classic ? 1.2 : 1.35));
  const textWidth = Math.max(0, ...lines.map(measure));
  const inset = Math.min(width / 2, textWidth / 2 + width * .03);
  const x = Math.max(inset, Math.min(width - inset, width * (text.x ?? .5)));
  const background = text.boxColor ? { x: x - textWidth / 2 - padding, y: height * text.y, width: textWidth + padding * 2, height: lines.length * lineHeight + padding * 2, opacity: 1, color: text.boxColor } : classic ? { x: 0, y: height * text.y, width, height: lines.length * lineHeight + padding * 2, opacity: text.backgroundOpacity ?? .58 } : null;
  return { fontSize, lineHeight, lines, x, textWidth, y: height * text.y + padding, fontWeight, fontFamily: exploreTextFontFamily(text.font, fontWeight), background, outlineJoin: text.preset === "reference-social" || text.preset === "reference-classic" ? "round" as const : "miter" as const, outlineWidth: (text.outlineWidth ?? 2) * width / 1080,
    fits: lines.length <= 40 && height * text.y + padding * 2 + lines.length * lineHeight <= height * .97 };
}

/** Normalized positions survive responsive previews, saved drafts and exports. */
export function positionFormatText(text: ExploreFormatText, x: number, y: number, width: number, height: number): ExploreFormatText {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return text;
  const layout = formatTextLayout({ ...text, x }, width, height);
  const padding = layout.background ? width * .018 : 0;
  // A subpixel inset avoids floating-point rounding past the strict fit bound.
  const maxY = Math.max(.03, Math.min(.9, .97 - (layout.lines.length * layout.lineHeight + padding * 2 + .001) / height));
  return { ...text, x: layout.x / width, y: Math.max(.03, Math.min(maxY, y)) };
}

/** Selecting a preset changes typography, never authored copy or timing. */
export function applyFormatTextPreset(text: ExploreFormatText, preset: FormatTextPreset): ExploreFormatText {
  const plain = { ...text }; delete plain.preset; delete plain.backgroundOpacity; delete plain.boxColor;
  if (preset === "reference-social" || preset === "reference-classic") return { ...plain, ...REFERENCE_FORMAT_TEXT_STYLE, preset, font: preset === "reference-classic" ? "dmsans" : "tiktoksans" };
  if (plain.fontWeight !== undefined) plain.fontWeight = resolveExploreTextWeight(plain.font, preset === "snapchat-classic" ? 400 : 700);
  return preset === "snapchat-classic" ? { ...plain, preset, backgroundOpacity: .58, fontSize: 56, color: "#ffffff", width: .94, y: .075 }
    : { ...plain, fontSize: 48, width: .8, y: .18, color: "#ffffff" };
}

const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

export function formatTextLineRuns(line: string, text: ExploreFormatText, layout: ReturnType<typeof formatTextLayout>) {
  const runs = formatInlineRuns(line).map(run => ({ ...run, width: run.symbol || run.emoji ? layout.fontSize : text.font ? exploreTextLineWidth(run.value, text.font, layout.fontWeight, layout.fontSize, estimateEditOverlayLineWidth) : estimateEditOverlayLineWidth(run.value, layout.fontSize) }));
  let x = layout.x - (text.align === "left" ? layout.textWidth : runs.reduce((sum, run) => sum + run.width, 0)) / 2;
  return runs.map(run => { const positioned = { ...run, x }; x += run.width; return positioned; });
}

/** The same layout supplies React preview and transparent caption PNG export. */
export function createFormatTextSvg(text: ExploreFormatText, width: number, height: number): string {
  const layout = formatTextLayout(text, width, height), background = layout.background;
  const lines = layout.lines.map((line, i) => {
    const y = layout.y + i * layout.lineHeight + layout.fontSize;
    if (!formatInlineRuns(line).some(run => run.symbol)) return `<text x="${text.align === "left" ? layout.x - layout.textWidth / 2 : layout.x}" y="${y}"${text.align === "left" ? ' text-anchor="start"' : ""}>${escapeXml(line)}</text>`;
    return formatTextLineRuns(line, text, layout).map(run => run.symbol ? formatInlineSymbolSvg(run.symbol, run.x, y - layout.fontSize, layout.fontSize) : `<text x="${run.x}" y="${y}" text-anchor="start">${escapeXml(run.value)}</text>`).join("");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background ? `<rect x="${background.x}" y="${background.y}" width="${background.width}" height="${background.height}" fill="${"color" in background ? background.color : "#000000"}" fill-opacity="${background.opacity}"/>` : ""}<g fill="${escapeXml(text.color)}" font-family="${escapeXml(layout.fontFamily)}" font-weight="${layout.fontWeight}" font-size="${layout.fontSize}"${text.font ? ' style="font-kerning:none;font-variant-ligatures:none"' : ""} text-anchor="middle"${background ? "" : ` stroke="black" stroke-width="${layout.outlineWidth}"${layout.outlineJoin === "round" ? ' stroke-linejoin="round"' : ""} paint-order="stroke"`}>${lines}</g></svg>`;

}
