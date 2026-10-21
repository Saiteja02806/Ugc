import { exploreEmojiId } from "./explore-emoji.ts";

/** Shared preview/export artwork for semantic marks. Authored Unicode stays
 * unchanged; these small SVG paths cannot inherit a caption's monochrome fill. */
export type FormatInlineSymbol = "cross" | "check" | "check-box" | "arrow-right";
const symbols: Record<string, FormatInlineSymbol> = {
  "❌": "cross", "✖": "cross", "✘": "cross", "✗": "cross",
  "✅": "check-box", "☑": "check-box", "✔": "check", "✓": "check",
  "→": "arrow-right", "➡": "arrow-right",
};
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
export const formatTextGraphemes = (value: string) => Array.from(segmenter.segment(value), item => item.segment);
export function formatInlineSymbol(value: string): FormatInlineSymbol | undefined {
  // Explicit text presentation keeps ordinary typography, including its color.
  const key = value.replaceAll("\ufe0f", "");
  return value.includes("\ufe0e") || !Object.hasOwn(symbols, key) ? undefined : symbols[key];
}
export function needsFormatEmojiFallback(value: string) {
  return !value.includes("\ufe0e") && (/\p{Emoji_Presentation}|\ufe0f|\u20e3/u.test(value) || /\p{Extended_Pictographic}/u.test(value) && /\p{Cn}/u.test(value));
}
export type FormatInlineRun = { value: string; symbol?: FormatInlineSymbol; emoji?: true; artwork?: string };
export function formatInlineRuns(text: string): FormatInlineRun[] {
  const runs: FormatInlineRun[] = [];
  for (const value of formatTextGraphemes(text)) {
    const symbol = formatInlineSymbol(value), artwork = symbol ? undefined : exploreEmojiId(value);
    const emoji = !!artwork || needsFormatEmojiFallback(value), previous = runs.at(-1);
    if (!symbol && !emoji && previous && !previous.symbol && !previous.emoji) previous.value += value;
    else runs.push({ value, ...(symbol ? { symbol } : {}), ...(emoji ? { emoji: true as const } : {}), ...(artwork ? { artwork } : {}) });
  }
  return runs;
}
export function formatTextEmojiError(value: string) {
  const unsupported = formatInlineRuns(value).find(run => run.emoji && !run.symbol && !run.artwork);
  return unsupported ? `This emoji is not supported yet: ${unsupported.value}. Choose another emoji before exporting.` : null;
}
export function measureFormatInlineText(value: string, size: number, measure: (value: string) => number) {
  return formatInlineRuns(value).reduce((width, run) => width + (run.symbol || run.emoji ? size : measure(run.value)), 0);
}
export function formatInlineSymbolPaths(symbol: FormatInlineSymbol) {
  if (symbol === "cross") return [{ fill: "#e53935", d: "M5 2 12 9 19 2 22 5 15 12 22 19 19 22 12 15 5 22 2 19 9 12 2 5Z" }];
  if (symbol === "arrow-right") return [{ fill: "#e53935", d: "M2 9H14V3L23 12 14 21V15H2Z" }];
  const check = { fill: symbol === "check-box" ? "#ffffff" : "#22c55e", d: "M4 11 9 16 20 4 23 7 9 22 1 14Z" };
  return symbol === "check-box" ? [{ fill: "#22a447", d: "M2 0H22Q24 0 24 2V22Q24 24 22 24H2Q0 24 0 22V2Q0 0 2 0Z" }, { ...check, d: "M4 11 9 16 19 5 22 8 9 21 1 14Z" }] : [check];
}
export function formatInlineSymbolSvg(symbol: FormatInlineSymbol, x: number, y: number, size: number) {
  return `<svg data-format-inline-symbol="${symbol}" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" stroke="none">${formatInlineSymbolPaths(symbol).map(path => `<path fill="${path.fill}" d="${path.d}"/>`).join("")}</svg>`;
}
