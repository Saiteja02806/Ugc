import type {
  TrendingWallTextContent,
  WallTextLayoutBlock,
} from "./wall-text-types.ts";
import { WALL_TEXT_SECTION_GAP } from "./wall-text-visual-style.ts";

export const WALL_TEXT_MANUAL_MAX_CHARACTERS = 600;

export function normalizeWallTextManualCopy(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/gu, " ").trim())
    .join("\n")
    .trim();
}

// Explicit newlines belong to the author. Blank lines use the same compact
// paragraph spacing in the editor, measured layout, and video renderer.
export function getWallTextManualBlocks(value: string): WallTextLayoutBlock[] {
  const normalized = normalizeWallTextManualCopy(value);
  if (!normalized) return [];
  const paragraphs = normalized.split(/(\n{2,})/u);
  const blocks: WallTextLayoutBlock[] = [];
  for (let index = 0; index < paragraphs.length; index += 2) {
    const separator = paragraphs[index + 1];
    blocks.push({
      lines: paragraphs[index]!.split("\n"),
      role: "text",
      gapAfterPx: separator ? (separator.length - 1) * WALL_TEXT_SECTION_GAP : 0,
    });
  }
  return blocks;
}

export function validateWallTextManualCopy(value: string) {
  const normalized = normalizeWallTextManualCopy(value);
  if (!normalized) throw new Error("Wall-of-text copy cannot be empty.");
  if (normalized.length > WALL_TEXT_MANUAL_MAX_CHARACTERS) {
    throw new Error(`Wall-of-text copy must contain at most ${WALL_TEXT_MANUAL_MAX_CHARACTERS} characters.`);
  }
}

export function validateManualWallTextContent(content: TrendingWallTextContent) {
  validateWallTextManualCopy(content.fullText);
  const layout = content.finalLayout;
  const source = content.sourceContent;
  const expected = getWallTextManualBlocks(content.fullText);
  if (
    layout?.version !== "wall-text-final-layout-v9" ||
    layout.textMode !== "manual" ||
    source?.kind !== "text" ||
    source.text !== content.fullText ||
    ![50, 52].includes(layout.fontSizePx) ||
    layout.blocks.length !== expected.length ||
    layout.blocks.some((block, index) => {
      const paragraph = expected[index]!;
      return (
        block.role !== "text" ||
        !block.lines.length ||
        block.lines.some((line) => !line.trim()) ||
        block.lines.join(" ") !== paragraph.lines.join(" ") ||
        block.gapAfterPx !== paragraph.gapAfterPx
      );
    })
  ) {
    throw new Error("Wall-of-text edit is missing its authoritative manual layout.");
  }
}
