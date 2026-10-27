import metrics from "./explore-text-font-metrics.json" with { type: "json" };

export const EXPLORE_TEXT_FONTS = [
  { id: "inter", label: "Inter" },
  { id: "dmsans", label: "DM Sans" },
  { id: "robotocondensed", label: "Roboto Condensed" },
  { id: "montserrat", label: "Montserrat" },
  { id: "poppins", label: "Poppins" },
  { id: "tiktoksans", label: "TikTok Sans" },
  { id: "proximanovaa", label: "Proxima Nova A Semibold" },
] as const;
export type ExploreTextFont = typeof EXPLORE_TEXT_FONTS[number]["id"];
export type ExploreTextWeight = 400 | 500 | 600 | 700;
export const EXPLORE_TEXT_WEIGHTS = [{ value: 400, label: "Regular" }, { value: 500, label: "Medium" }, { value: 700, label: "Bold" }] as const;
/** The supplied Proxima file is one real Semibold face, not three synthetic weights. */
export const exploreTextWeights = (font: ExploreTextFont | undefined) => font === "proximanovaa"
  ? [{ value: 600, label: "Semibold" }] as const : EXPLORE_TEXT_WEIGHTS;
export const resolveExploreTextWeight = (font: ExploreTextFont | undefined, weight: ExploreTextWeight): ExploreTextWeight =>
  font === "proximanovaa" ? 600 : weight === 600 ? 700 : weight;
export const isExploreTextFont = (value: unknown): value is ExploreTextFont => EXPLORE_TEXT_FONTS.some(font => font.id === value);
export const isExploreTextWeight = (value: unknown): value is 400 | 500 | 700 => value === 400 || value === 500 || value === 700;

/** Internal face names match the bundled TTF and browser WOFF2 exactly. */
export function exploreTextFontFamily(font: ExploreTextFont | undefined, weight: ExploreTextWeight) {
  if (!font) return "Arial, Helvetica, sans-serif";
  return `UGCExplore${EXPLORE_TEXT_FONTS.find(item => item.id === font)!.label.replaceAll(" ", "")}W${resolveExploreTextWeight(font, weight)}`;
}

export function exploreTextLineWidth(value: string, font: ExploreTextFont, weight: ExploreTextWeight, size: number, fallback: (value: string, size: number) => number) {
  const advances = (metrics as Record<string, Record<string, number>>)[`${font}-${resolveExploreTextWeight(font, weight)}`];
  return Array.from(value).reduce((total, character) => total + (advances[character] === undefined ? fallback(character, size) : advances[character] * size), 0);
}
