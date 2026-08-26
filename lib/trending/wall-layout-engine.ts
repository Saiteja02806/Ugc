import "server-only";

import { join } from "node:path";

import sharp from "sharp";

import {
  WALL_TEXT_CONTENT_LAYOUT_VERSION,
  WALL_TEXT_FINAL_LAYOUT_VERSION,
  type TrendingWallTextContent,
  type TrendingWallTextLayout,
  type WallTextFinalLayout,
  type WallTextFontSize,
  type WallTextFormatId,
  type WallTextLayoutBlock,
  type WallTextSegment,
  type WallTextSourceContent,
} from "./wall-text-types";
import {
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_SECTION_GAP,
} from "./wall-text-visual-style";
import { getWallTextFormat } from "./wall-formats";

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const ABSOLUTE_MAXIMUM_WORDS = 50;
const MINIMUM_WORDS = 8;
const FONT_SIZES: readonly WallTextFontSize[] = [52, 50, 48, 46, 44];
const TEXT_WIDTHS = [660, 640, 620] as const;
const INTERNAL_LINE_WIDTH_RATIO = 0.55;
const MINIMUM_BALANCE_IMPROVEMENT = 0.04;
const measurementCache = new Map<string, number>();

export async function deriveWallTextSpatialBudget(params: {
  formatId: WallTextFormatId;
  layout: TrendingWallTextLayout;
}) {
  const format = getWallTextFormat(params.formatId);
  const lineHeight = 44 * WALL_TEXT_LINE_HEIGHT_FACTOR;
  const availableLines = clamp(
    Math.floor((params.layout.textBox.height * VIDEO_HEIGHT) / lineHeight),
    4,
    7,
  );
  const widthPx = clamp(
    Math.round(params.layout.textBox.width * VIDEO_WIDTH),
    620,
    660,
  );
  const sampleWords = "people notice the quiet details";
  const sampleWidth = (await measureText(sampleWords, 40)) +
    WALL_TEXT_OUTLINE_WIDTH * 2;
  const wordsPerLine = clamp(
    Math.floor((5 * widthPx * 0.9) / sampleWidth),
    3,
    7,
  );
  const spatialMaximum = clamp(
    availableLines * wordsPerLine,
    MINIMUM_WORDS,
    ABSOLUTE_MAXIMUM_WORDS,
  );
  const preferredMinimum = Math.min(
    format.preferredWordRange[0],
    spatialMaximum,
  );
  const preferredMaximum = Math.min(
    format.preferredWordRange[1],
    spatialMaximum,
  );
  const targetWords = clamp(
    Math.round((preferredMinimum + preferredMaximum) / 2),
    MINIMUM_WORDS,
    spatialMaximum,
  );

  return {
    maxWords: ABSOLUTE_MAXIMUM_WORDS,
    spatialMaximum,
    targetWords,
  };
}

export async function createAuthoritativeWallTextContent(params: {
  content: WallTextSourceContent;
  formatId: WallTextFormatId;
  layout: TrendingWallTextLayout;
}) {
  const sourceContent = normalizeSourceContent(params.content);
  const finalLayout = await createWallTextFinalLayout({
    content: sourceContent,
    layout: params.layout,
  });
  const fullText = getFullText(sourceContent);

  return {
    content: {
      finalLayout,
      formatId: params.formatId,
      fullText,
      kind: "wall_text",
      layoutVersion: WALL_TEXT_CONTENT_LAYOUT_VERSION,
      pattern: params.formatId,
      renderFontSize: finalLayout.fontSizePx,
      segments: toCompatibilitySegments(finalLayout.blocks),
      sourceContent,
    } satisfies TrendingWallTextContent,
    layout: {
      ...params.layout,
      textBox: finalLayout.textBox,
    } satisfies TrendingWallTextLayout,
  };
}

export async function createWallTextFinalLayout(params: {
  content: WallTextSourceContent;
  layout: TrendingWallTextLayout;
}): Promise<WallTextFinalLayout> {
  const sourceBlocks = toSourceBlocks(params.content);
  const centerX = params.layout.textBox.x + params.layout.textBox.width / 2;
  const maximumHeight = params.layout.textBox.height * VIDEO_HEIGHT;

  for (const fontSize of FONT_SIZES) {
    for (const widthPx of TEXT_WIDTHS) {
      const width = widthPx / VIDEO_WIDTH;
      const x = centerX - width / 2;
      if (
        x < params.layout.safeArea.left ||
        x + width > 1 - params.layout.safeArea.right + 0.001
      ) {
        continue;
      }

      const blocks: WallTextLayoutBlock[] = [];
      for (const block of sourceBlocks) {
        blocks.push({
          lines:
            block.role === "text"
              ? await wrapPlainWallText(block.text, widthPx, fontSize)
              : await wrapMeasuredText(block.text, widthPx, fontSize),
          role: block.role,
        });
      }

      const lineHeightPx = Math.round(fontSize * WALL_TEXT_LINE_HEIGHT_FACTOR * 100) / 100;
      const lineCount = blocks.reduce((total, block) => total + block.lines.length, 0);
      const blockHeight =
        lineCount * lineHeightPx +
        Math.max(0, blocks.length - 1) * WALL_TEXT_SECTION_GAP;

      if (
        blockHeight <= maximumHeight &&
        (params.content.kind !== "text" ||
          (lineCount >= 4 && lineCount <= 7))
      ) {
        return {
          blocks,
          fontFamily: "Inter",
          fontSizePx: fontSize,
          fontWeight: WALL_TEXT_FONT_WEIGHT,
          lineHeightPx,
          textBox: {
            ...params.layout.textBox,
            width,
            x,
          },
          version: WALL_TEXT_FINAL_LAYOUT_VERSION,
        };
      }
    }
  }

  throw new Error(
    "Wall-of-text copy does not fit the publishing safe area at the minimum supported font size.",
  );
}

function normalizeSourceContent(content: WallTextSourceContent): WallTextSourceContent {
  if (content.kind === "text") {
    const text = normalizeText(content.text);
    if (!text) throw new Error("Wall-of-text copy cannot be empty.");
    return { kind: "text", text };
  }
  if (content.kind === "prose") {
    const text = normalizeText(content.text);
    if (!text) throw new Error("Wall-of-text prose cannot be empty.");
    return { kind: "prose", text };
  }

  const title = normalizeText(content.title);
  const items = content.items.map(normalizeText).filter(Boolean);
  if (!title || items.length < 3 || items.length > 5) {
    throw new Error("Wall-of-text lists need a title and three to five items.");
  }
  return { items, kind: "list", title };
}

function toSourceBlocks(content: WallTextSourceContent) {
  if (content.kind === "text") {
    return [{ role: "text" as const, text: content.text }];
  }
  if (content.kind === "prose") {
    return [{ role: "prose" as const, text: content.text }];
  }
  return [
    { role: "title" as const, text: content.title },
    ...content.items.map((text) => ({ role: "item" as const, text })),
  ];
}

async function wrapPlainWallText(
  value: string,
  maximumWidth: number,
  fontSize: WallTextFontSize,
) {
  const words = value.split(/\s+/u).filter(Boolean);
  if (words.length < 8) {
    throw new Error("Wall-of-text copy needs enough words to form four readable lines.");
  }
  const idealLineCount = clamp(Math.round(words.length / 4.5), 4, 7);
  const lineCounts = [...new Set([
    idealLineCount,
    idealLineCount - 1,
    idealLineCount + 1,
    4,
    5,
    6,
    7,
  ])].filter((count) => count >= 4 && count <= 7 && words.length >= count * 2);

  for (const lineCount of lineCounts) {
    const lines = await partitionMeasuredLines({
      fontSize,
      lineCount,
      maximumWidth,
      words,
    });
    if (lines) return lines;
  }

  throw new Error(
    "Wall-of-text copy cannot be arranged into four to seven balanced lines.",
  );
}

async function partitionMeasuredLines(params: {
  fontSize: WallTextFontSize;
  lineCount: number;
  maximumWidth: number;
  words: readonly string[];
}) {
  const widthCache = new Map<string, number>();
  const measure = async (start: number, end: number) => {
    const key = `${start}:${end}`;
    const cached = widthCache.get(key);
    if (cached !== undefined) return cached;
    const width =
      (await measureText(params.words.slice(start, end).join(" "), params.fontSize)) +
      WALL_TEXT_OUTLINE_WIDTH * 2;
    widthCache.set(key, width);
    return width;
  };
  const memo = new Map<string, { lines: string[]; score: number } | null>();

  const solve = async (
    start: number,
    linesRemaining: number,
  ): Promise<{ lines: string[]; score: number } | null> => {
    const key = `${start}:${linesRemaining}`;
    if (memo.has(key)) return memo.get(key)!;
    const wordsRemaining = params.words.length - start;
    if (wordsRemaining < linesRemaining * 2) return null;
    if (linesRemaining === 1) {
      const width = await measure(start, params.words.length);
      if (width > params.maximumWidth) return null;
      return {
        lines: [params.words.slice(start).join(" ")],
        score: Math.pow(width / params.maximumWidth - 0.72, 2) * 0.35,
      };
    }

    let best: { lines: string[]; score: number } | null = null;
    const maximumEnd = params.words.length - (linesRemaining - 1) * 2;
    for (let end = start + 2; end <= maximumEnd; end += 1) {
      const width = await measure(start, end);
      if (width > params.maximumWidth) break;
      const rest = await solve(end, linesRemaining - 1);
      if (!rest) continue;
      const fill = width / params.maximumWidth;
      const unsafeBreak = endsWithLayoutBreakWord(params.words[end - 1]!) ? 0.45 : 0;
      const score = Math.pow(fill - 0.86, 2) + unsafeBreak + rest.score;
      if (!best || score < best.score) {
        best = {
          lines: [params.words.slice(start, end).join(" "), ...rest.lines],
          score,
        };
      }
    }
    memo.set(key, best);
    return best;
  };

  const result = await solve(0, params.lineCount);
  if (!result) return null;
  const widths = await measureLines(result.lines, params.fontSize);
  const widestInternal = Math.max(...widths.slice(0, -1));
  if (widths.slice(0, -1).some((width) => width < widestInternal * 0.55)) {
    return null;
  }
  return result.lines;
}

function endsWithLayoutBreakWord(value: string) {
  return new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "if",
    "in", "of", "on", "or", "so", "than", "that", "the", "to", "with",
  ]).has(value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, ""));
}

async function wrapMeasuredText(
  value: string,
  maximumWidth: number,
  fontSize: WallTextFontSize,
) {
  const words = value.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const candidateWidth =
      (await measureText(candidate, fontSize)) + WALL_TEXT_OUTLINE_WIDTH * 2;

    if (!current && candidateWidth > maximumWidth) {
      throw new Error(
        "Wall-of-text contains a word that cannot fit the publishing text box.",
      );
    }

    if (candidateWidth <= maximumWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  const internallyBalanced = await rebalanceInternalLines(
    lines,
    maximumWidth,
    fontSize,
  );

  return rebalanceLastLine(internallyBalanced, maximumWidth, fontSize);
}

async function rebalanceInternalLines(
  lines: string[],
  maximumWidth: number,
  fontSize: WallTextFontSize,
) {
  const balanced = [...lines];

  for (let lineIndex = 1; lineIndex < balanced.length - 1; lineIndex += 1) {
    const original = balanced.slice(lineIndex - 1, lineIndex + 2);
    const originalWidths = await measureLines(original, fontSize);
    const widestNeighbor = Math.max(originalWidths[0]!, originalWidths[2]!);

    if (originalWidths[1]! >= widestNeighbor * INTERNAL_LINE_WIDTH_RATIO) {
      continue;
    }

    const candidates = createLocalBalanceCandidates(original);
    let best = original;
    let bestScore = getLineBalanceScore(originalWidths);

    for (const candidate of candidates) {
      const widths = await measureLines(candidate, fontSize);

      if (widths.some((width) => width > maximumWidth)) {
        continue;
      }

      const score = getLineBalanceScore(widths);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (
      best !== original &&
      bestScore >= getLineBalanceScore(originalWidths) + MINIMUM_BALANCE_IMPROVEMENT
    ) {
      balanced.splice(lineIndex - 1, 3, ...best);
    }
  }

  return balanced;
}

function createLocalBalanceCandidates(lines: string[]) {
  const candidates: string[][] = [];
  const previousWords = lines[0]!.split(/\s+/u);
  const currentWords = lines[1]!.split(/\s+/u);
  const nextWords = lines[2]!.split(/\s+/u);

  if (previousWords.length > 1) {
    const moved = previousWords.at(-1)!;
    candidates.push([
      previousWords.slice(0, -1).join(" "),
      [moved, ...currentWords].join(" "),
      nextWords.join(" "),
    ]);
  }

  if (nextWords.length > 1) {
    candidates.push([
      previousWords.join(" "),
      [...currentWords, nextWords[0]!].join(" "),
      nextWords.slice(1).join(" "),
    ]);
  }

  if (previousWords.length > 1 && nextWords.length > 1) {
    candidates.push([
      previousWords.slice(0, -1).join(" "),
      [previousWords.at(-1)!, ...currentWords, nextWords[0]!].join(" "),
      nextWords.slice(1).join(" "),
    ]);
  }

  return candidates;
}

async function measureLines(lines: string[], fontSize: WallTextFontSize) {
  return Promise.all(
    lines.map(async (line) =>
      (await measureText(line, fontSize)) + WALL_TEXT_OUTLINE_WIDTH * 2,
    ),
  );
}

function getLineBalanceScore(widths: number[]) {
  const widest = Math.max(...widths);
  return widest > 0 ? Math.min(...widths) / widest : 0;
}

async function rebalanceLastLine(
  lines: string[],
  maximumWidth: number,
  fontSize: WallTextFontSize,
) {
  if (lines.length < 2 || lines.at(-1)!.split(/\s+/u).length > 1) return lines;
  const previousWords = lines.at(-2)!.split(/\s+/u);
  if (previousWords.length < 3) return lines;
  const moved = previousWords.pop()!;
  const previousLine = previousWords.join(" ");
  const lastLine = `${moved} ${lines.at(-1)!}`;
  const lastLineWidth =
    (await measureText(lastLine, fontSize)) + WALL_TEXT_OUTLINE_WIDTH * 2;

  return lastLineWidth <= maximumWidth
    ? [...lines.slice(0, -2), previousLine, lastLine]
    : lines;
}

async function measureText(value: string, fontSize: WallTextFontSize) {
  const cacheKey = `${fontSize}:${value}`;
  const cached = measurementCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const metadata = await sharp({
    text: {
      dpi: 72,
      font: `Inter Regular ${fontSize}`,
      fontfile: getInterFontPath(),
      rgba: true,
      text: escapePangoMarkup(value),
      wrap: "none",
    },
  }).metadata();
  const width = metadata.width ?? 0;
  if (!width) throw new Error("Could not measure Wall-of-text copy with Inter.");
  measurementCache.set(cacheKey, width);
  return width;
}

function getFullText(content: WallTextSourceContent) {
  return content.kind === "text" || content.kind === "prose"
    ? content.text
    : `${content.title}: ${content.items.join("; ")}.`;
}

function toCompatibilitySegments(blocks: WallTextLayoutBlock[]): WallTextSegment[] {
  const lines = blocks.flatMap((block) => block.lines);
  if (lines.length < 2) return [{ lines, role: "lead" }];
  if (lines.length === 2) {
    return [
      { lines: [lines[0]!], role: "lead" },
      { lines: [lines[1]!], role: "closing" },
    ];
  }
  const split = Math.ceil((lines.length - 1) / 2);
  return [
    { lines: [lines[0]!], role: "lead" },
    { lines: lines.slice(1, 1 + split), role: "support" },
    { lines: lines.slice(1 + split), role: "closing" },
  ].filter((segment) => segment.lines.length > 0) as WallTextSegment[];
}

function getInterFontPath() {
  return join(process.cwd(), "node_modules", "@fontsource", "inter", "files", "inter-latin-400-normal.woff");
}

function normalizeText(value: string) {
  return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function escapePangoMarkup(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
