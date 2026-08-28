import "server-only";

import sharp from "sharp";

import { getVerifiedWallTextInterFontPath } from "./wall-text-font";
import type {
  TrendingWallTextContent,
  WallTextFontSize,
} from "./wall-text-types";
import { getWallTextRenderBlocks } from "./wall-text-types";
import {
  getWallTextSafeLineWidth,
  getWallTextFontSize,
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_INLINE_SAFE_PADDING,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_MAXIMUM_FONT_SIZE,
  WALL_TEXT_MINIMUM_FONT_SIZE,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_SECTION_GAP,
  WALL_TEXT_TEXT_WIDTH,
} from "./wall-text-visual-style";

export const WALL_TEXT_RENDER_WIDTH = 1080;
export const WALL_TEXT_RENDER_HEIGHT = 1920;
export const WALL_TEXT_MAXIMUM_BLOCK_HEIGHT = 420;
const lineWidthCache = new Map<string, number>();
export {
  getWallTextSafeLineWidth,
  getWallTextFontSize,
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_INLINE_SAFE_PADDING,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_MAXIMUM_FONT_SIZE,
  WALL_TEXT_MINIMUM_FONT_SIZE,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_SECTION_GAP,
  WALL_TEXT_TEXT_WIDTH,
};

export type WallTextRenderValidation = {
  fontSize: WallTextFontSize;
  height: number;
  lineHeight: number;
  lineWidths: number[];
  maximumLineWidth: number;
  valid: true;
};

export const WALL_TEXT_RENDER_FIT_REJECTED =
  "wall_text_render_fit_rejected";

export class WallTextRenderFitError extends Error {
  readonly code = WALL_TEXT_RENDER_FIT_REJECTED;

  constructor(message: string) {
    super(message);
    this.name = "WallTextRenderFitError";
  }
}

export async function validateWallTextRenderFit(
  content: TrendingWallTextContent,
): Promise<WallTextRenderValidation> {
  const preferredFontSize = getWallTextFontSize(content);
  const fontSizes = [preferredFontSize, 52, 50, 48, 46, 44].filter(
    (fontSize, index, values) =>
      fontSize <= preferredFontSize && values.indexOf(fontSize) === index,
  ) as WallTextFontSize[];
  const fontPath = await getVerifiedWallTextInterFontPath();
  const textBoxWidth =
    (content.finalLayout?.textBox.width ??
      WALL_TEXT_TEXT_WIDTH / WALL_TEXT_RENDER_WIDTH) *
    WALL_TEXT_RENDER_WIDTH;
  const maximumTextWidth = getWallTextSafeLineWidth(textBoxWidth);
  const maximumBlockHeight =
    (content.finalLayout?.textBox.height ??
      WALL_TEXT_MAXIMUM_BLOCK_HEIGHT / WALL_TEXT_RENDER_HEIGHT) *
    WALL_TEXT_RENDER_HEIGHT;
  let widestFailure: { line: string; width: number } | null = null;

  for (const fontSize of fontSizes) {
    const lineWidths: number[] = [];
    const lineHeight = fontSize * WALL_TEXT_LINE_HEIGHT_FACTOR;
    let height = 0;
    let failedLine: { line: string; width: number } | null = null;

    const blocks = getWallTextRenderBlocks(content);
    for (const [segmentIndex, segment] of blocks.entries()) {
      for (const line of segment.lines) {
        const width = await measureWallTextLine({
          fontPath,
          fontSize,
          line,
        });

        if (
          !width ||
          width + WALL_TEXT_OUTLINE_WIDTH * 2 >= maximumTextWidth
        ) {
          failedLine = { line, width };
          break;
        }

        lineWidths.push(width);
        height += lineHeight;
      }

      if (failedLine) {
        break;
      }

      if (segmentIndex < blocks.length - 1) {
        height += WALL_TEXT_SECTION_GAP;
      }
    }

    if (failedLine) {
      if (!widestFailure || failedLine.width > widestFailure.width) {
        widestFailure = failedLine;
      }
      continue;
    }

    if (height <= maximumBlockHeight) {
      return {
        fontSize,
        height: Math.round(height * 100) / 100,
        lineHeight: Math.round(lineHeight * 100) / 100,
        lineWidths,
        maximumLineWidth: Math.max(...lineWidths),
        valid: true,
      };
    }
  }

  if (widestFailure) {
    throw new WallTextRenderFitError(
      `Wall-of-text line does not fit the ${maximumTextWidth}px Inter text area at the ${WALL_TEXT_MINIMUM_FONT_SIZE}px minimum: "${widestFailure.line}"`,
    );
  }

  throw new WallTextRenderFitError(
    "Wall-of-text semantic lines do not fit the supported placement zones.",
  );
}

export function applyWallTextRenderFit(
  content: TrendingWallTextContent,
  render: WallTextRenderValidation,
): TrendingWallTextContent {
  return {
    ...content,
    ...(content.finalLayout
      ? {
          finalLayout: {
            ...content.finalLayout,
            fontSizePx: render.fontSize,
            lineHeightPx: render.lineHeight,
          },
        }
      : {}),
    renderFontSize: render.fontSize,
  };
}

async function measureWallTextLine(params: {
  fontPath: string;
  fontSize: WallTextFontSize;
  line: string;
}) {
  const cacheKey = `${params.fontPath}:${params.fontSize}:${params.line}`;
  const cached = lineWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const metadata = await sharp({
    text: {
      dpi: 72,
      font: `Inter Regular ${params.fontSize}`,
      fontfile: params.fontPath,
      rgba: true,
      text: escapePangoMarkup(params.line),
      wrap: "none",
    },
  }).metadata();
  const width = metadata.width ?? 0;
  if (width > 0) lineWidthCache.set(cacheKey, width);
  return width;
}

function escapePangoMarkup(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
