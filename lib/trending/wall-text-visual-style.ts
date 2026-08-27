import type { TrendingWallTextContent } from "./wall-text-types.ts";

export const WALL_TEXT_FONT_WEIGHT = 400;
export const LEGACY_WALL_TEXT_FONT_WEIGHT = 700;
export const WALL_TEXT_LINE_HEIGHT_FACTOR = 1.1;
export const WALL_TEXT_MAXIMUM_FONT_SIZE = 52;
export const WALL_TEXT_MINIMUM_FONT_SIZE = 44;
export const WALL_TEXT_OUTLINE_WIDTH = 2;
export const WALL_TEXT_SECTION_GAP = 18;
// A wider reading column prevents already-measured lines from being visually
// rewrapped into two- or three-word rows on the 9:16 canvas.
export const WALL_TEXT_TEXT_WIDTH = 780;

export function getWallTextFontSize(content: TrendingWallTextContent) {
  const declaredSize = Number(
    content.renderFontSize ?? content.finalLayout?.fontSizePx,
  );
  if (
    declaredSize === 36 ||
    declaredSize === 38 ||
    declaredSize === 40 ||
    declaredSize === 42 ||
    declaredSize === 44 ||
    declaredSize === 46 ||
    declaredSize === 48 ||
    declaredSize === 50 ||
    declaredSize === 52
  ) {
    return declaredSize;
  }
  const wordCount = content.fullText.split(/\s+/u).filter(Boolean).length;
  const lineCount = (content.finalLayout?.blocks ?? content.segments).reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  if (wordCount <= 18 && lineCount <= 5) {
    return WALL_TEXT_MAXIMUM_FONT_SIZE;
  }

  if (wordCount <= 21 && lineCount <= 6) {
    return 48;
  }

  if (wordCount <= 23) {
    return 46;
  }

  return WALL_TEXT_MINIMUM_FONT_SIZE;
}
