import "server-only";

import { join } from "node:path";

import sharp from "sharp";

import type { TrendingWallTextContent } from "./wall-text-types";
import { getWallTextRenderBlocks } from "./wall-text-types";
import {
  getWallTextFontSize,
  WALL_TEXT_FONT_WEIGHT,
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
export {
  getWallTextFontSize,
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_MAXIMUM_FONT_SIZE,
  WALL_TEXT_MINIMUM_FONT_SIZE,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_SECTION_GAP,
  WALL_TEXT_TEXT_WIDTH,
};

export type WallTextRenderValidation = {
  fontSize: number;
  height: number;
  lineHeight: number;
  lineWidths: number[];
  maximumLineWidth: number;
  valid: true;
};

export async function validateWallTextRenderFit(
  content: TrendingWallTextContent,
): Promise<WallTextRenderValidation> {
  const preferredFontSize = getWallTextFontSize(content);
  const fontSizes = [preferredFontSize, 50, 48, 46, 44].filter(
    (fontSize, index, values) =>
      fontSize <= preferredFontSize && values.indexOf(fontSize) === index,
  );
  const fontPath = getInterFontPath();
  const maximumTextWidth =
    (content.finalLayout?.textBox.width ?? WALL_TEXT_TEXT_WIDTH / WALL_TEXT_RENDER_WIDTH) *
    WALL_TEXT_RENDER_WIDTH;
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
        const metadata = await sharp({
          text: {
            dpi: 72,
            font: `Inter Bold ${fontSize}`,
            fontfile: fontPath,
            rgba: true,
            text: escapePangoMarkup(line),
            wrap: "none",
          },
        }).metadata();
        const width = metadata.width ?? 0;

        if (
          !width ||
          width + WALL_TEXT_OUTLINE_WIDTH * 2 > maximumTextWidth
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
    throw new Error(
      `Wall-of-text line does not fit the ${maximumTextWidth}px Inter text area at the ${WALL_TEXT_MINIMUM_FONT_SIZE}px minimum: "${widestFailure.line}"`,
    );
  }

  throw new Error(
    "Wall-of-text semantic lines do not fit the supported placement zones.",
  );
}

function getInterFontPath() {
  return join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-700-normal.woff",
  );
}

function escapePangoMarkup(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
