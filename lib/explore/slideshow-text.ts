export type SlideTextDesign = {
  heading: string; body: string; font: "sans" | "serif" | "mono"; size: number;
  color: string; align: "left" | "center" | "right"; position: "top" | "middle" | "bottom";
  background: "none" | "solid" | "rounded" | "pill"; backgroundColor: string; opacity: number;
};
export const EMPTY_SLIDE_TEXT: SlideTextDesign = { heading: "", body: "", font: "sans", size: 48, color: "#ffffff", align: "center", position: "middle", background: "none", backgroundColor: "#111314", opacity: .85 };
const fonts = { sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "Courier New, monospace" };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
export function parseSlideText(value: unknown): SlideTextDesign {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid slide text.");
  const v = value as SlideTextDesign;
  if (typeof v.heading !== "string" || typeof v.body !== "string" || v.heading.length > 180 || v.body.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.heading + v.body) ||
    !["sans", "serif", "mono"].includes(v.font) || ![28, 36, 48, 64, 80].includes(v.size) || !["left", "center", "right"].includes(v.align) || !["top", "middle", "bottom"].includes(v.position) || !["none", "solid", "rounded", "pill"].includes(v.background) || !/^#[0-9a-f]{6}$/i.test(v.color) || !/^#[0-9a-f]{6}$/i.test(v.backgroundColor) || typeof v.opacity !== "number" || !Number.isFinite(v.opacity) || v.opacity < 0 || v.opacity > 1) throw new Error("Invalid slide text.");
  return { heading: v.heading, body: v.body, font: v.font, size: v.size, color: v.color, align: v.align, position: v.position, background: v.background, backgroundColor: v.backgroundColor, opacity: v.opacity };
}
/** A single vector overlay drives both the live preview and the exported PNG. */
export function slideTextSvg(value: SlideTextDesign, width: number, height: number, measure: (text: string, font: string) => number) {
  const v = parseSlideText(value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 16384 || height > 16384) throw new Error("Invalid slide dimensions.");
  if (!v.heading.trim() && !v.body.trim()) return "";
  const family = fonts[v.font], padding = width * .025, maxWidth = width * .8;
  let size = v.size * width / 1080;
  function lines(text: string, bold: boolean) {
    const result: { text: string; bold: boolean }[] = [];
    for (const paragraph of text.split("\n")) {
      if (!paragraph) { result.push({ text: "", bold }); continue; }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, `${bold ? 700 : 400} ${size}px ${family}`) <= maxWidth) { line = candidate; continue; }
        if (line) result.push({ text: line, bold });
        line = "";
        for (const char of word) {
          if (line && measure(line + char, `${bold ? 700 : 400} ${size}px ${family}`) > maxWidth) { result.push({ text: line, bold }); line = ""; }
          line += char;
        }
      }
      result.push({ text: line, bold });
    }
    return result;
  }
  let rows: { text: string; bold: boolean }[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    rows = [...(v.heading.trim() ? lines(v.heading, true) : []), ...(v.heading.trim() && v.body.trim() ? [{ text: "", bold: false }] : []), ...(v.body.trim() ? lines(v.body, false) : [])];
    if (rows.length * size * 1.3 + padding * 2 <= height * .84) break;
    size *= .9;
  }
  const blockHeight = rows.length * size * 1.3 + padding * 2;
  const y = v.position === "top" ? height * .08 : v.position === "bottom" ? height * .92 - blockHeight : (height - blockHeight) / 2;
  const x = v.align === "left" ? width * .1 : v.align === "right" ? width * .9 : width / 2;
  const radius = v.background === "pill" ? Math.min(blockHeight / 2, width * .08) : v.background === "rounded" ? width * .025 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${v.background !== "none" ? `<rect x="${width * .1 - padding}" y="${y}" width="${maxWidth + padding * 2}" height="${blockHeight}" rx="${radius}" fill="${v.backgroundColor}" fill-opacity="${v.opacity}"/>` : ""}${rows.map((row, index) => `<text x="${x}" y="${y + padding + size + index * size * 1.3}" font-family="${family}" font-size="${size}" font-weight="${row.bold ? 700 : 400}" fill="${v.color}" text-anchor="${v.align === "left" ? "start" : v.align === "right" ? "end" : "middle"}"${v.background === "none" ? ` paint-order="stroke" stroke="#111314" stroke-width="${Math.max(1, size / 20)}" stroke-linejoin="round"` : ""}>${escape(row.text)}</text>`).join("")}</svg>`;
}
