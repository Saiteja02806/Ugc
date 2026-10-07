/** Browser-safe source of truth. IDs and existing renderer versions are stable. */
export const SUBTITLE_STYLE_REGISTRY = [
  { id: "clean", label: "Clean", description: "Simple, readable phrases.", renderVersion: "classic-v1" },
  { id: "bold-box", label: "Bold box", description: "Bold phrases on a dark box.", renderVersion: "classic-v1" },
  { id: "active-word", label: "Active word", description: "Color follows the spoken word.", renderVersion: "classic-v1" },
  { id: "editorial", label: "Editorial", description: "Expressive, measured typography.", renderVersion: "editorial-v1" },
  { id: "word-pop", label: "Word pop", description: "One large word with a subtle entrance.", renderVersion: "word-pop-v1" },
  { id: "karaoke", label: "Karaoke", description: "A phrase fills as each word is spoken.", renderVersion: "karaoke-v1" },
  { id: "marker-highlight", label: "Marker highlight", description: "A marker follows the active word.", renderVersion: "marker-highlight-v1" },
] as const;
export type SubtitleStyle = (typeof SUBTITLE_STYLE_REGISTRY)[number]["id"];
export const SUBTITLE_STYLES = SUBTITLE_STYLE_REGISTRY.map(style => style.id);
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = "clean";
export const isSubtitleStyle = (value: unknown): value is SubtitleStyle =>
  typeof value === "string" && SUBTITLE_STYLES.some(id => id === value);
export function subtitleStyleDefinition(style: SubtitleStyle) {
  return SUBTITLE_STYLE_REGISTRY.find(entry => entry.id === style)!;
}
export const isDynamicSubtitleStyle = (style: SubtitleStyle) =>
  style === "word-pop" || style === "karaoke" || style === "marker-highlight";
export const subtitlePreview = (style: SubtitleStyle) => ({
  video: `/subtitle-previews/v1/${style}.mp4`, poster: `/subtitle-previews/v1/${style}.jpg`,
});
