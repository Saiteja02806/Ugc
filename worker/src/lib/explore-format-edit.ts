import { estimateEditOverlayLineWidth } from "./edit-overlay-render-spec.ts";

export type ExploreFormatText = { value: string; width: number; y: number; fontSize: number; color: string; startMs: number; endMs: number };
export type ExploreFormatEdit = { version: 1; format: "hook" | "wall_text"; trimStartMs: number; trimEndMs: number; originalVolume: number; musicVolume: number; text: ExploreFormatText | null };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const obj = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function parseExploreFormatEdit(value: unknown): ExploreFormatEdit {
  const v = obj(value);
  if (Object.keys(v).some(key => !["version", "format", "trimStartMs", "trimEndMs", "originalVolume", "musicVolume", "text"].includes(key)) || v.version !== 1 || !["hook", "wall_text"].includes(String(v.format)) ||
      !finite(v.trimStartMs) || !finite(v.trimEndMs) || !Number.isInteger(v.trimStartMs) || !Number.isInteger(v.trimEndMs) || v.trimStartMs < 0 || v.trimEndMs > 120_000 || v.trimEndMs - v.trimStartMs < 1000 ||
      !finite(v.originalVolume) || v.originalVolume < 0 || v.originalVolume > 1 || !finite(v.musicVolume) || v.musicVolume < 0 || v.musicVolume > 1) throw new Error("Choose a valid trim range and audio levels.");
  let text: ExploreFormatText | null = null;
  if (v.text !== null) {
    const t = obj(v.text);
    if (Object.keys(t).some(key => !["value", "width", "y", "fontSize", "color", "startMs", "endMs"].includes(key)) || typeof t.value !== "string" || !t.value.trim() || t.value.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(t.value) ||
        !finite(t.width) || t.width < .4 || t.width > .94 || !finite(t.y) || t.y < .03 || t.y > .9 || !finite(t.fontSize) || t.fontSize < 24 || t.fontSize > 84 ||
        typeof t.color !== "string" || !/^#[0-9a-f]{6}$/i.test(t.color) || !finite(t.startMs) || !finite(t.endMs) || !Number.isInteger(t.startMs) || !Number.isInteger(t.endMs) || t.startMs < 0 || t.endMs <= t.startMs || t.endMs > v.trimEndMs - v.trimStartMs) throw new Error("Choose valid text, position, and timing within your trimmed video.");
    text = { value: t.value.replaceAll("\r\n", "\n"), width: t.width, y: t.y, fontSize: t.fontSize, color: t.color.toLowerCase(), startMs: t.startMs, endMs: t.endMs };
  }
  return { version: 1, format: v.format as ExploreFormatEdit["format"], trimStartMs: v.trimStartMs, trimEndMs: v.trimEndMs, originalVolume: v.originalVolume, musicVolume: v.musicVolume, text };
}

/** Explicit lines and blank paragraphs survive. One layout drives preview/export. */
export function formatTextLayout(text: ExploreFormatText, width: number, height: number) {
  const fontSize = text.fontSize * width / 1080;
  const maxWidth = width * text.width;
  const lines: string[] = [];
  for (const paragraph of text.value.split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line + word;
      if (line && estimateEditOverlayLineWidth(candidate, fontSize) > maxWidth) { lines.push(line); line = ""; }
      // Break an unspaced long word safely rather than cropping or losing it.
      for (const character of Array.from(word)) {
        const next = line + character;
        if (estimateEditOverlayLineWidth(next, fontSize) > maxWidth && line) { lines.push(line); line = ""; }
        line += character;
      }
      line += " ";
    }
    lines.push(line.trimEnd());
  }
  const lineHeight = fontSize * 1.35;
  return { fontSize, lineHeight, lines, y: height * text.y, fits: lines.length <= 40 && height * text.y + lines.length * lineHeight <= height * .97 };
}
