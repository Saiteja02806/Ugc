export const TRENDING_TEXT_COLOR_OPTIONS = [
  { label: "White", value: "#ffffff" },
  { label: "Yellow", value: "#fde047" },
  { label: "Orange", value: "#fb923c" },
  { label: "Pink", value: "#f472b6" },
  { label: "Sky", value: "#67e8f9" },
  { label: "Mint", value: "#86efac" },
] as const;

export const TRENDING_TEXT_COLOR_VALUES = TRENDING_TEXT_COLOR_OPTIONS.map(
  (option) => option.value,
) as [TrendingTextColor, ...TrendingTextColor[]];

export type TrendingTextColor =
  (typeof TRENDING_TEXT_COLOR_OPTIONS)[number]["value"];

export const DEFAULT_TRENDING_TEXT_COLOR: TrendingTextColor = "#ffffff";

export function isTrendingTextColor(value: unknown): value is TrendingTextColor {
  return TRENDING_TEXT_COLOR_OPTIONS.some((option) => option.value === value);
}

/** Keeps previously saved edits renderable after text color was introduced. */
export function resolveTrendingTextColor(value: unknown): TrendingTextColor {
  return isTrendingTextColor(value) ? value : DEFAULT_TRENDING_TEXT_COLOR;
}
