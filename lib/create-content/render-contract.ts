import {
  createHookTextLayout,
  HOOK_TEXT_FIXED_FONT_SIZE,
  HOOK_TEXT_LAYOUT_VERSION,
} from "../trending/hook-text-layout.ts";
import { createWallTextLayout } from "../trending/wall-text-feed-logic.ts";
import {
  WALL_TEXT_CONTENT_LAYOUT_VERSION,
  WALL_TEXT_FINAL_LAYOUT_VERSION,
  type TrendingWallTextContent,
  type TrendingWallTextLayout,
} from "../trending/wall-text-types.ts";
import {
  WALL_TEXT_FIXED_FONT_SIZE,
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
} from "../trending/wall-text-visual-style.ts";

import type { CreateContentCard } from "./card-contract";

export type CreateContentRenderOverlay =
  | {
      format: "hook_text";
      hook: {
        fontSize: number;
        layoutVersion: typeof HOOK_TEXT_LAYOUT_VERSION;
        lines: string[];
      };
      position: { x: number; y: number };
      text: string;
    }
  | {
      format: "wall_text";
      position: { x: number; y: number };
      text: string;
      wall: {
        content: TrendingWallTextContent;
        layout: TrendingWallTextLayout;
      };
    };

/**
 * Makes the preview and the final MP4 share one geometry contract. The card
 * remains deliberately separate from Trending assignments; only the visual
 * treatment is reused.
 */
export function buildCreateContentRenderOverlay(
  card: CreateContentCard,
): CreateContentRenderOverlay {
  const text = card.overlay.text.trim();

  if (!text) {
    throw new Error("Add text to this video before preparing it.");
  }

  if (card.overlay.format === "hook_text") {
    const layout = createHookTextLayout(text);

    return {
      format: "hook_text",
      hook: {
        fontSize: HOOK_TEXT_FIXED_FONT_SIZE,
        layoutVersion: HOOK_TEXT_LAYOUT_VERSION,
        lines: layout.lines,
      },
      position: card.overlay.position,
      text: layout.hookText,
    };
  }

  const layout = createCreateContentWallTextLayout(card.overlay.position);

  return {
    format: "wall_text",
    position: card.overlay.position,
    text,
    wall: {
      content: createCreateContentWallTextContent(text, layout),
      layout,
    },
  };
}

export function createCreateContentWallTextLayout(
  position: { x: number; y: number },
): TrendingWallTextLayout {
  const layout = createWallTextLayout();
  const { height, width } = layout.textBox;

  return {
    ...layout,
    // Create Content is intentionally user-positioned. Its renderer uses the
    // whole 9:16 canvas rather than Trending's face-analysis safe zone.
    safeArea: { bottom: 0, left: 0, right: 0, top: 0 },
    textBox: {
      ...layout.textBox,
      x: clamp(position.x - width / 2, 0, 1 - width),
      y: clamp(position.y - height / 2, 0, 1 - height),
    },
  };
}

export function createCreateContentWallTextContent(
  text: string,
  layout: TrendingWallTextLayout,
): TrendingWallTextContent {
  const lines = getCreateContentWallTextLines(text);

  if (lines.length < 4) {
    throw new Error(
      "Wall-of-Text needs at least four words before it can be scheduled.",
    );
  }

  return {
    finalLayout: {
      blocks: [{ lines, role: "text" }],
      fontFamily: "Arial",
      fontSizePx: WALL_TEXT_FIXED_FONT_SIZE,
      fontWeight: WALL_TEXT_FONT_WEIGHT,
      lineHeightPx: WALL_TEXT_FIXED_FONT_SIZE * WALL_TEXT_LINE_HEIGHT_FACTOR,
      textBox: layout.textBox,
      version: WALL_TEXT_FINAL_LAYOUT_VERSION,
    },
    fullText: text.replace(/\s+/gu, " ").trim(),
    kind: "wall_text",
    layoutVersion: WALL_TEXT_CONTENT_LAYOUT_VERSION,
    pattern: "freeform",
    renderFontSize: WALL_TEXT_FIXED_FONT_SIZE,
    // The renderer keeps semantic segments for compatibility even though the
    // authoritative, visible structure is finalLayout.blocks.
    segments: createWallTextSegments(lines),
  };
}

export function getCreateContentWallTextLines(text: string): string[] {
  const explicitLines = text
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (explicitLines.length >= 4 && explicitLines.length <= 8) {
    return explicitLines;
  }

  const words = text.split(/\s+/u).filter(Boolean);
  const lineCount = Math.min(8, Math.max(4, Math.ceil(words.length / 5)));

  return Array.from({ length: lineCount }, (_, index) => {
    const start = Math.floor((index * words.length) / lineCount);
    const end = Math.floor(((index + 1) * words.length) / lineCount);
    return words.slice(start, end).join(" ");
  }).filter(Boolean);
}

function createWallTextSegments(lines: string[]) {
  const middle = Math.max(1, Math.floor(lines.length / 2));
  const lead = lines.slice(0, middle);
  const closing = lines.slice(middle);

  return [
    { lines: lead.length > 0 ? lead : [lines[0] ?? "Text"], role: "lead" as const },
    {
      lines: closing.length > 0 ? closing : [lines.at(-1) ?? "Text"],
      role: "closing" as const,
    },
  ];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
