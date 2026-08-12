import type { TrendingWallTextContent } from "./wall-text-types.ts";

export const WALL_TEXT_FONT_WEIGHT = 700;
export const WALL_TEXT_LINE_HEIGHT_FACTOR = 52 / 48;
export const WALL_TEXT_MAXIMUM_FONT_SIZE = 52;
export const WALL_TEXT_MINIMUM_FONT_SIZE = 44;
export const WALL_TEXT_OUTLINE_WIDTH = 4;
export const WALL_TEXT_TEXT_WIDTH = 620;

export function getWallTextFontSize(content: TrendingWallTextContent) {
  if (
    content.renderFontSize === 44 ||
    content.renderFontSize === 46 ||
    content.renderFontSize === 48 ||
    content.renderFontSize === 50 ||
    content.renderFontSize === 52
  ) {
    return content.renderFontSize;
  }

  const wordCount = content.fullText.split(/\s+/u).filter(Boolean).length;
  const lineCount = (content.finalLayout?.blocks ?? content.segments).reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  if (wordCount <= 18 && lineCount <= 5) {
    return 52;
  }

  if (wordCount <= 21 && lineCount <= 6) {
    return 48;
  }

  if (wordCount <= 23) {
    return 46;
  }

  return 44;
}
