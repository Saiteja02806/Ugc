import { formatTextLayout, type ExploreFormatText } from "./explore-format-edit.ts";

/** Frozen in new automatic plans; missing means the historical shrink-only layout. */
export const HOOK_INITIAL_TEXT_LAYOUT_VERSION = 1 as const;

/** Initial Hook styling only. Never call this to restore or restyle a user's overlay. */
export function fitInitialHookText(text: ExploreFormatText, width: number, height: number): ExploreFormatText {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Review the video dimensions before fitting Hook text.");
  const baselineLines = formatTextLayout(text, width, height).lines.length;
  for (let fontSize = 84; fontSize >= 24; fontSize -= 2) {
    const candidate = { ...text, width: .94, fontSize };
    const layout = formatTextLayout(candidate, width, height);
    // Do not add lines just to enlarge a short hook. Keep the outline inside
    // the same safe bounds, and retain the automatic caption's vertical limit.
    if (layout.fits && layout.lines.length <= baselineLines &&
        layout.textWidth + layout.outlineWidth <= width * .94 &&
        text.y * height + layout.lines.length * layout.lineHeight <= height * .72) return candidate;
  }
  throw new Error("Review the automatic text's fit before using this video.");
}
