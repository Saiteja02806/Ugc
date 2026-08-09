import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
  WallTextSegment,
} from "@/lib/trending/wall-text-types";
import {
  clampHookTextPosition,
  createHookTextLayout,
} from "./hook-text-layout.ts";
import type { TrendingTextColor } from "./text-color.ts";
import { getWallTextLinePolicy } from "./wall-text-text-logic.ts";

export const TRENDING_CREATIVE_EDIT_VERSION = "trending-creative-edit-v1" as const;

export type TrendingCreativeEditFormat =
  | "carousel"
  | "hook_video"
  | "wall_text";

export type NormalizedTextPosition = {
  x: number;
  y: number;
};

export type TrendingCreativeEditSource = {
  groupId: string | null;
  mediaAssetId: string | null;
  resolvedAssetId: string;
  resolvedAssetDurationSeconds: number | null;
  resolvedAssetTitle: string;
  resolvedAssetUrl: string;
  resolvedThumbnailUrl: string | null;
  selectionKind: "asset" | "group";
};

export type TrendingCarouselEditSlide = {
  backgroundUrl: string;
  ctaText: string;
  headline: string;
  renderedUrl: string;
  slideId: string;
  slideNumber: number;
  subtext: string;
  textPosition: NormalizedTextPosition;
};

export type TrendingCarouselEditContent = {
  format: "carousel";
  slides: TrendingCarouselEditSlide[];
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingHookEditContent = {
  fontSize: number;
  format: "hook_video";
  hookText: string;
  lines: string[];
  position: NormalizedTextPosition;
  textColor: TrendingTextColor;
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingWallTextEditContent = {
  content: TrendingWallTextContent;
  format: "wall_text";
  layout: TrendingWallTextLayout;
  textColor: TrendingTextColor;
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingCreativeEditContent =
  | TrendingCarouselEditContent
  | TrendingHookEditContent
  | TrendingWallTextEditContent;

export type TrendingCreativeEditRenderState =
  | "draft"
  | "failed"
  | "queued"
  | "ready"
  | "rendering";

export type TrendingCreativeEditRecord = {
  assignmentId: string;
  content: TrendingCreativeEditContent;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  id: string | null;
  renderError: string | null;
  renderJobId: string | null;
  renderOutput: {
    slides: Array<{
      renderedS3Key: string | null;
      renderedUrl: string;
      slideNumber: number;
    }>;
  } | null;
  renderState: TrendingCreativeEditRenderState;
  revision: number;
  source: TrendingCreativeEditSource | null;
  updatedAt: string | null;
};

export type TrendingCreativeEditSaveInput = {
  assignmentId: string;
  expectedRevision: number;
  content:
    | {
        format: "carousel";
        slides: Array<Omit<TrendingCarouselEditSlide, "backgroundUrl" | "renderedUrl">>;
        version: typeof TRENDING_CREATIVE_EDIT_VERSION;
      }
    | TrendingHookEditContent
    | TrendingWallTextEditContent;
  source?: {
    groupId?: string | null;
    mediaAssetId?: string | null;
    resolvedAssetId?: string | null;
    selectionKind: "asset" | "group";
  } | null;
};

export function clampNormalizedTextPosition(
  value: NormalizedTextPosition,
  bounds = { maxX: 0.9, maxY: 0.9, minX: 0.1, minY: 0.1 },
): NormalizedTextPosition {
  return {
    x: clamp(value.x, bounds.minX, bounds.maxX),
    y: clamp(value.y, bounds.minY, bounds.maxY),
  };
}

export function createHookEditLines(value: string) {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();

  if (!normalized) {
    return [];
  }

  try {
    return createHookTextLayout(normalized, {
      enforceMaximum: false,
      enforceMinimum: false,
    }).lines;
  } catch {
    return normalized
      .split("\n")
      .map((line) => line.replace(/\s+/gu, " ").trim())
      .filter(Boolean)
      .slice(0, 2);
  }
}

export function createHookEditContent(
  value: string,
  current: TrendingHookEditContent,
): TrendingHookEditContent {
  try {
    const layout = createHookTextLayout(value, {
      enforceMaximum: false,
      enforceMinimum: false,
    });

    return {
      ...current,
      fontSize: layout.fontSize,
      hookText: value,
      lines: layout.lines,
      position: clampHookTextPosition(current.position, layout.positionBounds),
    };
  } catch {
    return {
      ...current,
      hookText: value,
      lines: createHookEditLines(value),
    };
  }
}

export function createWallTextEditContent(
  fullText: string,
  current: TrendingWallTextContent,
): TrendingWallTextContent {
  const normalized = fullText.trim().replace(/\r\n?/gu, "\n");
  const explicitLines = normalized
    .split(/\n+/gu)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const sentenceGroups = normalized
    .replace(/\s+/gu, " ")
    .match(/[^.!?]+(?:[.!?]+|$)/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  const sourceGroups =
    explicitLines.length >= 2
      ? explicitLines
      : sentenceGroups.length >= 2
        ? sentenceGroups
        : splitWordsIntoGroups(
            normalized.replace(/\s+/gu, " "),
            Math.min(3, Math.max(2, current.segments.length)),
          );
  const segmentCount = Math.min(3, Math.max(2, sourceGroups.length));
  const linePolicy = getWallTextLinePolicy(current.pattern);
  let groupedText = distributeTextGroups(sourceGroups, segmentCount);
  let lineCounts = findWallTextLineCounts(groupedText, linePolicy);

  if (!lineCounts) {
    groupedText = splitWordsIntoGroups(
      normalized.replace(/\s+/gu, " "),
      segmentCount,
    );
    lineCounts = findWallTextLineCounts(groupedText, linePolicy);
  }

  const segments = buildWallTextSegments(groupedText, lineCounts);
  const currentWithoutFontSize = { ...current };
  delete currentWithoutFontSize.renderFontSize;

  return {
    ...currentWithoutFontSize,
    fullText: normalized.replace(/\s+/gu, " "),
    segments,
  };
}

const WALL_TEXT_UNSAFE_LINE_END_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "over",
  "so",
  "than",
  "that",
  "the",
  "to",
  "under",
  "when",
  "while",
  "with",
  "yet",
]);

function findWallTextLineCounts(
  groups: string[],
  linePolicy: ReturnType<typeof getWallTextLinePolicy>,
) {
  const wordCounts = groups.map(
    (group) => group.split(/\s+/u).filter(Boolean).length,
  );
  let bestCounts: number[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  function visit(index: number, counts: number[]) {
    if (index === wordCounts.length) {
      const total = counts.reduce((sum, count) => sum + count, 0);

      if (total < linePolicy.minimum || total > linePolicy.maximum) {
        return;
      }

      const densities = counts.map(
        (count, groupIndex) => wordCounts[groupIndex]! / count,
      );
      const average =
        densities.reduce((sum, density) => sum + density, 0) /
        densities.length;
      const score =
        Math.abs(total - linePolicy.ideal) * 100 +
        densities.reduce(
          (sum, density) => sum + Math.abs(density - average),
          0,
        );

      if (score < bestScore) {
        bestCounts = [...counts];
        bestScore = score;
      }
      return;
    }

    const wordCount = wordCounts[index]!;

    for (let lineCount = 1; lineCount <= 4; lineCount += 1) {
      if (wordCount >= lineCount * 2 && wordCount <= lineCount * 6) {
        counts.push(lineCount);
        visit(index + 1, counts);
        counts.pop();
      }
    }
  }

  visit(0, []);
  return bestCounts;
}

function buildWallTextSegments(
  groups: string[],
  lineCounts: number[] | null,
): WallTextSegment[] {
  return groups.map((group, index) => {
    const words = group.split(/\s+/u).filter(Boolean);
    const requestedLineCount = lineCounts?.[index];
    const lines = requestedLineCount
      ? splitWallTextWords(words, requestedLineCount)
      : splitWallTextWordsFallback(words);

    return {
      lines,
      role:
        index === 0
          ? "lead"
          : index === groups.length - 1
            ? "closing"
            : "support",
    };
  });
}

function splitWallTextWords(words: string[], lineCount: number) {
  let bestLines: string[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const idealLength = words.length / lineCount;

  function visit(wordIndex: number, lines: string[]) {
    const linesRemaining = lineCount - lines.length;

    if (linesRemaining === 0) {
      if (wordIndex !== words.length) return;

      const score = lines.reduce((total, line, index) => {
        const wordCount = line.split(" ").length;
        const unsafePenalty =
          index < lines.length - 1 && endsWithUnsafeWallTextWord(line)
            ? 1000
            : 0;
        return (
          total + Math.abs(wordCount - idealLength) * 10 + unsafePenalty
        );
      }, 0);

      if (score < bestScore) {
        bestLines = [...lines];
        bestScore = score;
      }
      return;
    }

    const wordsRemaining = words.length - wordIndex;

    for (let size = 2; size <= 6; size += 1) {
      const after = wordsRemaining - size;

      if (
        after < (linesRemaining - 1) * 2 ||
        after > (linesRemaining - 1) * 6
      ) {
        continue;
      }

      lines.push(words.slice(wordIndex, wordIndex + size).join(" "));
      visit(wordIndex + size, lines);
      lines.pop();
    }
  }

  visit(0, []);
  return bestLines ?? splitWallTextWordsFallback(words);
}

function splitWallTextWordsFallback(words: string[]) {
  if (words.length === 0) return [];

  const lineCount = Math.min(4, Math.max(1, Math.ceil(words.length / 5)));

  return Array.from({ length: lineCount }, (_, index) => {
    const start = Math.floor((index * words.length) / lineCount);
    const end = Math.floor(((index + 1) * words.length) / lineCount);
    return words.slice(start, end).join(" ");
  }).filter(Boolean);
}

function endsWithUnsafeWallTextWord(value: string) {
  const words = value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);

  return WALL_TEXT_UNSAFE_LINE_END_WORDS.has(words.at(-1) ?? "");
}

function splitWordsIntoGroups(value: string, requestedGroupCount: number) {
  const words = value.split(/\s+/u).filter(Boolean);
  const groupCount = Math.min(requestedGroupCount, words.length);

  if (groupCount < 2) {
    return [value];
  }

  return Array.from({ length: groupCount }, (_, index) => {
    const start = Math.floor((index * words.length) / groupCount);
    const end = Math.floor(((index + 1) * words.length) / groupCount);
    return words.slice(start, end).join(" ");
  }).filter(Boolean);
}

function distributeTextGroups(values: string[], groupCount: number) {
  const groups: string[] = [];
  let sourceIndex = 0;

  for (let index = 0; index < groupCount; index += 1) {
    const remainingValues = values.length - sourceIndex;
    const remainingGroups = groupCount - index;
    const valuesInGroup = Math.max(
      1,
      Math.ceil(remainingValues / remainingGroups),
    );
    groups.push(
      values
        .slice(sourceIndex, sourceIndex + valuesInGroup)
        .join(" ")
        .trim(),
    );
    sourceIndex += valuesInGroup;
  }

  return groups;
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}
