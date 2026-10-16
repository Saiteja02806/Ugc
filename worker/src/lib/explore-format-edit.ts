import { estimateEditOverlayLineWidth } from "./edit-overlay-render-spec.ts";
import { exploreTextFontFamily, exploreTextLineWidth, isExploreTextFont, isExploreTextWeight, type ExploreTextFont, type ExploreTextWeight } from "./explore-text-fonts.ts";
export { EXPLORE_TEXT_FONTS, EXPLORE_TEXT_WEIGHTS, exploreTextFontFamily } from "./explore-text-fonts.ts";
export type { ExploreTextFont, ExploreTextWeight } from "./explore-text-fonts.ts";

export type FormatTextPreset = "bold" | "snapchat-classic";
export type ExploreFormatText = { value: string; width: number; y: number; fontSize: number; color: string; startMs: number; endMs: number; preset?: FormatTextPreset; backgroundOpacity?: number; font?: ExploreTextFont; fontWeight?: ExploreTextWeight };
export type ExploreFormatEdit = { version: 1; format: "hook" | "wall_text"; trimStartMs: number; trimEndMs: number; originalVolume: number; musicVolume: number; text: ExploreFormatText | null; textOverlays?: ExploreFormatText[] };
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
    if (Object.keys(t).some(key => !["value", "width", "y", "fontSize", "color", "startMs", "endMs", "preset", "backgroundOpacity", "font", "fontWeight"].includes(key)) || typeof t.value !== "string" || !t.value.trim() || t.value.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(t.value) ||
        !finite(t.width) || t.width < .4 || t.width > .94 || !finite(t.y) || t.y < .03 || t.y > .9 || !finite(t.fontSize) || t.fontSize < 24 || t.fontSize > 84 ||
        typeof t.color !== "string" || !/^#[0-9a-f]{6}$/i.test(t.color) || !finite(t.startMs) || !finite(t.endMs) || !Number.isInteger(t.startMs) || !Number.isInteger(t.endMs) || t.startMs < 0 || t.endMs <= t.startMs || t.endMs > trimmedDurationMs) throw new Error("Choose valid text, position, and timing within your trimmed video.");
    if (t.preset !== undefined && t.preset !== "bold" && t.preset !== "snapchat-classic" || t.backgroundOpacity !== undefined && (t.preset !== "snapchat-classic" || !finite(t.backgroundOpacity) || t.backgroundOpacity < 0 || t.backgroundOpacity > 1)) throw new Error("Choose a supported text preset and background opacity.");
    if (t.font !== undefined && !isExploreTextFont(t.font) || t.fontWeight !== undefined && (!isExploreTextWeight(t.fontWeight) || t.font === undefined && t.fontWeight === 500)) throw new Error("Choose a supported font and weight.");
    return { value: t.value.replaceAll("\r\n", "\n"), width: t.width, y: t.y, fontSize: t.fontSize, color: t.color.toLowerCase(), startMs: t.startMs, endMs: t.endMs,
      ...(t.preset === undefined ? {} : { preset: t.preset as FormatTextPreset }), ...(t.backgroundOpacity === undefined ? {} : { backgroundOpacity: t.backgroundOpacity as number }),
      ...(t.font === undefined ? {} : { font: t.font as ExploreTextFont }), ...(t.fontWeight === undefined ? {} : { fontWeight: t.fontWeight as ExploreTextWeight }) };
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
  const fontWeight = text.fontWeight ?? (text.preset === "snapchat-classic" ? 400 : 700);
  const measure = (value: string) => text.font ? exploreTextLineWidth(value, text.font, fontWeight, fontSize, estimateEditOverlayLineWidth) : estimateEditOverlayLineWidth(value, fontSize);
  const lines: string[] = [];
  for (const paragraph of text.value.split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line + word;
      if (line && measure(candidate) > maxWidth) { lines.push(line); line = ""; }
      // Break an unspaced long word safely rather than cropping or losing it.
      for (const character of Array.from(word)) {
        const next = line + character;
        if (measure(next) > maxWidth && line) { lines.push(line); line = ""; }
        line += character;
      }
      line += " ";
    }
    lines.push(line.trimEnd());
  }
  const classic = text.preset === "snapchat-classic", padding = classic ? width * .018 : 0;
  const lineHeight = fontSize * (classic ? 1.2 : 1.35);
  const background = classic ? { x: 0, y: height * text.y, width, height: lines.length * lineHeight + padding * 2, opacity: text.backgroundOpacity ?? .58 } : null;
  return { fontSize, lineHeight, lines, y: height * text.y + padding, fontWeight, fontFamily: exploreTextFontFamily(text.font, fontWeight), background,
    fits: lines.length <= 40 && height * text.y + padding * 2 + lines.length * lineHeight <= height * .97 };
}

/** Selecting a preset changes typography, never authored copy or timing. */
export function applyFormatTextPreset(text: ExploreFormatText, preset: FormatTextPreset): ExploreFormatText {
  const plain = { ...text }; delete plain.preset; delete plain.backgroundOpacity;
  if (plain.fontWeight !== undefined) plain.fontWeight = preset === "snapchat-classic" ? 400 : 700;
  return preset === "snapchat-classic" ? { ...plain, preset, backgroundOpacity: .58, fontSize: 56, color: "#ffffff", width: .94, y: .075 }
    : { ...plain, fontSize: 48, width: .8, y: .18, color: "#ffffff" };
}

const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** The same layout supplies React preview and transparent caption PNG export. */
export function createFormatTextSvg(text: ExploreFormatText, width: number, height: number): string {
  const layout = formatTextLayout(text, width, height), background = layout.background;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background ? `<rect x="0" y="${background.y}" width="${width}" height="${background.height}" fill="#000000" fill-opacity="${background.opacity}"/>` : ""}<g fill="${escapeXml(text.color)}" font-family="${escapeXml(layout.fontFamily)}" font-weight="${layout.fontWeight}" font-size="${layout.fontSize}"${text.font ? ' style="font-kerning:none;font-variant-ligatures:none"' : ""} text-anchor="middle"${background ? "" : ` stroke="black" stroke-width="${width / 540}" paint-order="stroke"`}>${layout.lines.map((line,i)=>`<text x="${width / 2}" y="${layout.y + i * layout.lineHeight + layout.fontSize}">${escapeXml(line)}</text>`).join("")}</g></svg>`;
}
