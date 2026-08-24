import sharp from "sharp";

import type { CarouselFormat } from "../types.js";
import type { CarouselRenderStyle } from "./carousel-render-style.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";

export type CarouselNormalizedTextPosition = {
  x: number;
  y: number;
};

type RenderCarouselSlideInput = {
  assetUrl: string;
  businessName?: string | null;
  format: CarouselFormat;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  slide: PlannedCarouselSlide;
  textStyle: CarouselRenderStyle;
};

type WrappedText = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

type MeasuredWrappedText = WrappedText & {
  measuredLineExtents: RenderedTextExtents[];
  measuredLineWidths: number[];
};

type RenderedTextExtents = {
  left: number;
  right: number;
  width: number;
};

type TextMode = PlannedCarouselSlide["textMode"];

type RegionSignal = {
  brightness: number;
  contrast: number;
};

type BubbleLineMetrics = {
  baselineOffset: number;
  bubbleWidth: number;
  groupHeight: number;
  lineOverlap: number;
  lineStep: number;
  rectHeight: number;
  rects: Array<{
    estimatedTextWidth: number;
    measuredTextWidth: number;
    requiredWidth: number;
    visualWidth: number;
  }>;
};

type ConnectedBubbleLine = {
  centerY: number;
  left: number;
  right: number;
  width: number;
};

type ConnectedBubbleTransition =
  | "none"
  | "soft-curve"
  | "rounded-shoulder";

export type CarouselBubbleLineDiagnostic = {
  cornerSafety: number;
  estimatedTextWidth: number;
  fontFamily: string;
  fontSize: number;
  measuredTextWidth: number;
  paddingX: number;
  radius: number;
  rectangleWidth: number;
  requiredWidth: number;
  stepRadius: number;
  text: string;
  transitionToNext: ConnectedBubbleTransition;
  visualWidth: number;
  widthSnapSideThreshold: number;
};

export type CarouselRenderDiagnostics = {
  bubbleShapeStrategy: "hybrid-soft-union-connected-path";
  escapedTextPixels: number;
  fontFamily: string;
  maxBubbleWidth: number;
  repaired: boolean;
  textPixels: number;
  textPixelContainmentPassed: boolean;
  lines: CarouselBubbleLineDiagnostic[];
};

type BalancedLines = {
  lines: string[];
  truncated: boolean;
};

export const CAROUSEL_RENDERER_VERSION =
  "social-bubble-renderer-v12-fixed-type";
export const CAROUSEL_FIXED_FONT_SIZE = 44;

const FORMAT_DIMENSIONS: Record<CarouselFormat, { height: number; width: number }> = {
  "1:1": { height: 1080, width: 1080 },
  "4:5": { height: 1350, width: 1080 },
};

const DARK_TEXT = "#111316";
const BODY_TEXT = "#15171a";
const HEADLINE_BUBBLE_FILL = "#ffffff";
const BODY_BUBBLE_FILL = "#ffffff";
const TEXT_FONT_FAMILY = "Geist, Arial, Helvetica, sans-serif";
const HEADLINE_FONT_WEIGHT = 700;
const BODY_FONT_WEIGHT = 600;
const MIN_CORNER_SAFETY = 6;
const CONNECTED_BUBBLE_SIDE_SNAP = 3;

function getMeasuredLineWidths(value: WrappedText) {
  return "measuredLineWidths" in value &&
    Array.isArray(value.measuredLineWidths)
    ? value.measuredLineWidths
    : undefined;
}

function getMeasuredLineExtents(value: WrappedText) {
  return "measuredLineExtents" in value &&
    Array.isArray(value.measuredLineExtents)
    ? value.measuredLineExtents
    : undefined;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(value: string, fontSize: number) {
  return Array.from(value).reduce((width, character) => {
    if (character === " ") {
      return width + fontSize * 0.28;
    }

    if (/[A-Z0-9]/.test(character)) {
      return width + fontSize * 0.62;
    }

    if (/[il.,'|:;]/.test(character)) {
      return width + fontSize * 0.28;
    }

    if (/[mwMW@%]/.test(character)) {
      return width + fontSize * 0.78;
    }

    return width + fontSize * 0.52;
  }, 0);
}

async function measureRenderedTextExtents(params: {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lines: string[];
}) {
  const padding = Math.ceil(params.fontSize * 1.5);

  return Promise.all(
    params.lines.map(async (line) => {
      const estimatedWidth = Math.ceil(estimateTextWidth(line, params.fontSize));
      const width = Math.max(320, estimatedWidth * 2 + padding * 2);
      const height = Math.ceil(params.fontSize * 3 + padding * 2);
      const anchorX = Math.round(width / 2);
      const baselineY = Math.round(padding + params.fontSize * 1.45);
      const svg = Buffer.from(`
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <text x="${anchorX}" y="${baselineY}" fill="#000000" font-family="${params.fontFamily}" font-size="${params.fontSize}" font-weight="${params.fontWeight}" letter-spacing="${params.letterSpacing}" text-anchor="middle">${escapeXml(line)}</text>
        </svg>
      `);
      const { data, info } = await sharp(svg)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let maxX = -1;

      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const alpha = data[(y * info.width + x) * info.channels + 3] ?? 0;

          if (alpha > 8) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }

      if (maxX < minX) {
        return {
          left: estimatedWidth / 2,
          right: estimatedWidth / 2,
          width: estimatedWidth,
        };
      }

      return {
        left: Math.max(0, anchorX - minX),
        right: Math.max(0, maxX - anchorX + 1),
        width: maxX - minX + 1,
      };
    }),
  );
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getSlideTextMode(slide: PlannedCarouselSlide) {
  return slide.textMode ?? "headline_body";
}

function getListOverlayLines(slide: PlannedCarouselSlide, textMode: TextMode) {
  if (textMode !== "question_list" && textMode !== "checklist") {
    return [];
  }

  const body = normalizeText(slide.body);
  const marker = textMode === "checklist" ? "-" : null;
  const listItems = (slide.listItems ?? [])
    .map(normalizeText)
    .filter(Boolean)
    .map((item, index) => (marker ? `${marker} ${item}` : `${index + 1}. ${item}`));

  return [body, ...listItems].filter(Boolean);
}

function trimDanglingEnding(value: string) {
  return value
    .replace(/\s+(and|or|with|for|to|of|the|a|an|in|on|at|by|from)$/i, "")
    .trim();
}

function addTerminalPeriod(value: string) {
  return /[.?!]$/.test(value) ? value : `${value}.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLineWidth(
  words: string[],
  startIndex: number,
  endIndex: number,
  fontSize: number,
) {
  return estimateTextWidth(words.slice(startIndex, endIndex).join(" "), fontSize);
}

function buildBalancedLines(params: {
  fontSize: number;
  maxLines: number;
  maxWidth: number;
  value: string;
}): BalancedLines {
  const words = params.value.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return { lines: [], truncated: false };
  }

  const maxLines = Math.min(params.maxLines, words.length);
  let best: { lines: string[]; penalty: number } | null = null;

  function search(
    startIndex: number,
    remainingLines: number,
    currentLines: string[],
    currentPenalty: number,
  ) {
    if (remainingLines === 0) {
      if (startIndex === words.length) {
        const lineCountPenalty = currentLines.length * params.maxWidth * 18;
        const candidate = {
          lines: currentLines,
          penalty: currentPenalty + lineCountPenalty,
        };

        if (!best || candidate.penalty < best.penalty) {
          best = candidate;
        }
      }

      return;
    }

    const wordsLeft = words.length - startIndex;

    if (wordsLeft < remainingLines) {
      return;
    }

    const maxEndIndex = words.length - remainingLines + 1;

    for (let endIndex = startIndex + 1; endIndex <= maxEndIndex; endIndex += 1) {
      const lineWidth = getLineWidth(
        words,
        startIndex,
        endIndex,
        params.fontSize,
      );

      if (lineWidth > params.maxWidth) {
        if (endIndex === startIndex + 1) {
          continue;
        }

        break;
      }

      const rag = params.maxWidth - lineWidth;
      const isLastLine = remainingLines === 1;
      const shortLastLinePenalty =
        isLastLine && lineWidth < params.maxWidth * 0.34
          ? params.maxWidth * params.maxWidth * 0.16
          : 0;

      search(
        endIndex,
        remainingLines - 1,
        [...currentLines, words.slice(startIndex, endIndex).join(" ")],
        currentPenalty + rag * rag + shortLastLinePenalty,
      );
    }
  }

  for (let lineCount = 1; lineCount <= maxLines; lineCount += 1) {
    search(0, lineCount, [], 0);
  }

  const bestCandidate = best as { lines: string[]; penalty: number } | null;

  if (bestCandidate) {
    return { lines: bestCandidate.lines, truncated: false };
  }

  const lines: string[] = [];
  let currentLine = "";
  let consumedWords = 0;

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (estimateTextWidth(nextLine, params.fontSize) > params.maxWidth && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = nextLine;
    }

    consumedWords += 1;

    if (lines.length === params.maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < params.maxLines) {
    lines.push(currentLine.trim());
  }

  const truncated = consumedWords < words.length || lines.length > params.maxLines;

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = addTerminalPeriod(
      trimDanglingEnding(lines[lines.length - 1].replace(/[.]+$/, "")),
    );
  }

  return { lines: lines.slice(0, params.maxLines), truncated };
}

async function fitMeasuredText(value: string, params: {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  getCornerSafety: (fontSize: number) => number;
  lineHeightRatio: number;
  maxLines: number;
  maxWidth: number;
  paddingX: number;
}): Promise<MeasuredWrappedText> {
  if (!normalizeText(value)) {
    return {
      fontSize: 0,
      lineHeight: 0,
      lines: [],
      measuredLineExtents: [],
      measuredLineWidths: [],
    };
  }

  const cornerSafety = params.getCornerSafety(params.fontSize);
  const maxTextWidth =
    params.maxWidth - 2 * (params.paddingX + cornerSafety);
  const wrapped = await buildMeasuredLines({
    fontFamily: params.fontFamily,
    fontSize: params.fontSize,
    fontWeight: params.fontWeight,
    maxLines: params.maxLines,
    maxTextWidth,
    value,
  });

  if (!wrapped.truncated && wrapped.fits) {
    return {
      fontSize: params.fontSize,
      lineHeight: Math.round(params.fontSize * params.lineHeightRatio),
      lines: wrapped.lines,
      measuredLineExtents: wrapped.extents,
      measuredLineWidths: wrapped.extents.map((extent) => extent.width),
    };
  }

  throw new Error(
    `Carousel text could not fit within ${params.maxLines} lines at the fixed ${params.fontSize}px font size.`,
  );
}

async function buildMeasuredLines(params: {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  maxLines: number;
  maxTextWidth: number;
  value: string;
}) {
  let estimatedMaxWidth = params.maxTextWidth;
  let lastResult: {
    extents: RenderedTextExtents[];
    fits: boolean;
    lines: string[];
    truncated: boolean;
  } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wrapped = buildBalancedLines({
      fontSize: params.fontSize,
      maxLines: params.maxLines,
      maxWidth: estimatedMaxWidth,
      value: params.value,
    });
    const extents = await measureRenderedTextExtents({
      fontFamily: params.fontFamily,
      fontSize: params.fontSize,
      fontWeight: params.fontWeight,
      letterSpacing: 0,
      lines: wrapped.lines,
    });
    const symmetricWidths = extents.map(
      (extent) => Math.max(extent.left, extent.right) * 2,
    );
    const fits = symmetricWidths.every(
      (lineWidth) => lineWidth <= params.maxTextWidth,
    );

    lastResult = {
      extents,
      fits,
      lines: wrapped.lines,
      truncated: wrapped.truncated,
    };

    if (fits) {
      return lastResult;
    }

    const largestOverflowRatio = symmetricWidths.reduce(
      (ratio, lineWidth) => Math.max(ratio, lineWidth / params.maxTextWidth),
      1,
    );

    estimatedMaxWidth = Math.max(
      Math.round(estimatedMaxWidth / largestOverflowRatio) - 2,
      Math.round(params.maxTextWidth * 0.7),
    );
  }

  return (
    lastResult ?? {
      extents: [],
      fits: true,
      lines: [],
      truncated: false,
    }
  );
}

async function fitStackedText(values: string[], params: {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  getCornerSafety: (fontSize: number) => number;
  lineHeightRatio: number;
  maxLines: number;
  maxWidth: number;
  paddingX: number;
}): Promise<MeasuredWrappedText> {
  const cleanValues = values.map(normalizeText).filter(Boolean);

  if (cleanValues.length === 0) {
    return {
      fontSize: 0,
      lineHeight: 0,
      lines: [],
      measuredLineExtents: [],
      measuredLineWidths: [],
    };
  }

  if (cleanValues.length > params.maxLines) {
    throw new Error(
      `Carousel list needs ${cleanValues.length} visual lines but only ${params.maxLines} are allowed.`,
    );
  }

  const cornerSafety = params.getCornerSafety(params.fontSize);
  const maxTextWidth =
    params.maxWidth - 2 * (params.paddingX + cornerSafety);
  const lines: string[] = [];
  const extents: RenderedTextExtents[] = [];

  for (const value of cleanValues) {
    const wrapped = await buildMeasuredLines({
      fontFamily: params.fontFamily,
      fontSize: params.fontSize,
      fontWeight: params.fontWeight,
      maxLines: 1,
      maxTextWidth,
      value,
    });

    if (wrapped.truncated || !wrapped.fits || wrapped.lines.length !== 1) {
      throw new Error(
        `Carousel list text could not fit at the fixed ${params.fontSize}px font size.`,
      );
    }

    lines.push(wrapped.lines[0]);
    extents.push(wrapped.extents[0]);
  }

  return {
    fontSize: params.fontSize,
    lineHeight: Math.round(params.fontSize * params.lineHeightRatio),
    lines,
    measuredLineExtents: extents,
    measuredLineWidths: extents.map((extent) => extent.width),
  };
}

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Could not download carousel background image (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getRegionSignal(params: {
  backgroundBuffer: Buffer;
  height: number;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  position: PlannedCarouselSlide["textPosition"];
  width: number;
}): Promise<RegionSignal> {
  const { data, info } = await sharp(params.backgroundBuffer)
    .rotate()
    .resize(params.width, params.height, {
      fit: "cover",
      position: "center",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const xCenterRatio = params.normalizedTextPosition
    ? clamp(params.normalizedTextPosition.x, 0.1, 0.9)
    : 0.5;
  const xStart = Math.round(
    info.width * Math.max(0.05, xCenterRatio - 0.39),
  );
  const xEnd = Math.round(
    info.width * Math.min(0.95, xCenterRatio + 0.39),
  );
  const [yStartRatio, yEndRatio] = params.normalizedTextPosition
    ? [
        Math.max(0.05, params.normalizedTextPosition.y - 0.2),
        Math.min(0.95, params.normalizedTextPosition.y + 0.2),
      ]
    : params.position === "top"
      ? [0.12, 0.48]
      : params.position === "center"
        ? [0.28, 0.72]
        : [0.46, 0.86];
  const yStart = Math.round(info.height * yStartRatio);
  const yEnd = Math.round(info.height * yEndRatio);
  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let y = yStart; y < yEnd; y += 8) {
    for (let x = xStart; x < xEnd; x += 8) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? red;
      const blue = data[offset + 2] ?? red;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      count += 1;
      sum += luminance;
      sumSquares += luminance * luminance;
    }
  }

  if (count === 0) {
    return { brightness: 128, contrast: 0 };
  }

  const brightness = sum / count;
  const variance = sumSquares / count - brightness * brightness;

  return {
    brightness,
    contrast: Math.sqrt(Math.max(0, variance)),
  };
}

function getBodyText(slide: PlannedCarouselSlide) {
  const body = normalizeText(slide.body);
  const subtext = normalizeText(slide.subtext);
  const ctaText = normalizeText(slide.ctaText);
  const headline = normalizeComparableText(normalizeText(slide.headline));
  const listItems = (slide.listItems ?? [])
    .map((item, index) => {
      const text = normalizeText(item);

      return text ? `${index + 1}. ${text}` : "";
    })
    .filter(Boolean);
  const textMode = getSlideTextMode(slide);

  if (textMode === "question_list" || textMode === "checklist") {
    return [body, ...listItems].filter(Boolean).join(" ");
  }

  if (body && normalizeComparableText(body) !== headline) {
    return body;
  }

  if (subtext && normalizeComparableText(subtext) !== headline) {
    return subtext;
  }

  if (ctaText && normalizeComparableText(ctaText) !== headline) {
    return ctaText;
  }

  return "";
}

function measureBubbleLines(params: {
  cornerSafety: number;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maxBubbleWidth: number;
  measuredLineExtents?: RenderedTextExtents[];
  measuredLineWidths?: number[];
  mode: "connected" | "single";
  paddingX: number;
  paddingY: number;
  lineOverlap?: number;
  radius: number;
}): BubbleLineMetrics {
  const rectHeight = Math.round(params.fontSize + params.paddingY * 2);
  const lineOverlap =
    params.lineOverlap ??
    (params.mode === "connected"
      ? clamp(Math.round(params.fontSize * 0.22), 7, 11)
      : 0);
  const lineStep =
    params.mode === "connected"
      ? rectHeight - lineOverlap
      : Math.round(params.lineHeight);
  const rects = params.lines.map((line, index) => {
    const measuredExtents = params.measuredLineExtents?.[index];
    const measuredLineWidth = params.measuredLineWidths?.[index];
    const lineWidth =
      typeof measuredLineWidth === "number"
        ? measuredLineWidth
        : estimateTextWidth(line, params.fontSize);
    const symmetricTextWidth = measuredExtents
      ? Math.max(measuredExtents.left, measuredExtents.right) * 2
      : lineWidth;
    const requiredWidth = Math.ceil(
      symmetricTextWidth +
        2 * (params.paddingX + params.cornerSafety),
    );

    if (requiredWidth > params.maxBubbleWidth) {
      throw new Error(
        `Carousel bubble needs ${requiredWidth}px for visible text but maxBubbleWidth is ${params.maxBubbleWidth}px.`,
      );
    }

    return {
      estimatedTextWidth: Math.round(estimateTextWidth(line, params.fontSize)),
      measuredTextWidth: Math.round(lineWidth),
      requiredWidth,
      visualWidth: requiredWidth,
    };
  });
  const maxLineWidth = rects.reduce(
    (widestLine, rect) => Math.max(widestLine, rect.visualWidth),
    0,
  );

  return {
    baselineOffset: Math.round(params.paddingY + params.fontSize * 0.78),
    bubbleWidth: maxLineWidth,
    groupHeight:
      params.lines.length > 0
        ? Math.round(rectHeight + (params.lines.length - 1) * lineStep)
        : 0,
    lineOverlap,
    lineStep,
    rectHeight,
    rects,
  };
}

export function snapConnectedBubbleVisualWidths(params: {
  requiredWidths: number[];
  sideThreshold?: number;
}) {
  const sideThreshold = Math.max(
    0,
    params.sideThreshold ?? CONNECTED_BUBBLE_SIDE_SNAP,
  );
  const visualWidths = params.requiredWidths.map((width) => Math.round(width));
  let groupStart = 0;

  for (let index = 1; index <= visualWidths.length; index += 1) {
    const staysInGroup =
      index < visualWidths.length &&
      Math.abs(
        params.requiredWidths[index] - params.requiredWidths[index - 1],
      ) /
        2 <
        sideThreshold;

    if (staysInGroup) {
      continue;
    }

    const groupWidth = Math.max(...visualWidths.slice(groupStart, index));

    for (let groupIndex = groupStart; groupIndex < index; groupIndex += 1) {
      visualWidths[groupIndex] = groupWidth;
    }

    groupStart = index;
  }

  return visualWidths;
}

function formatPathCoordinate(value: number) {
  const rounded = Math.round(value * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function classifyConnectedBubbleTransition(params: {
  fromX: number;
  softCurveSideThreshold: number;
  toX: number;
}): ConnectedBubbleTransition {
  const sideChange = Math.abs(params.toX - params.fromX);

  if (sideChange === 0) {
    return "none";
  }

  return sideChange <= params.softCurveSideThreshold
    ? "soft-curve"
    : "rounded-shoulder";
}

function appendConnectedBubbleTransition(params: {
  boundaryY: number;
  commands: string[];
  direction: "down" | "up";
  fromX: number;
  lineStep: number;
  softCurveSideThreshold: number;
  stepRadius: number;
  toX: number;
}) {
  const transition = classifyConnectedBubbleTransition(params);

  if (transition === "none") {
    return transition;
  }

  const directionSign = params.direction === "down" ? 1 : -1;
  const availableHalfHeight = Math.max(1, Math.floor(params.lineStep / 2) - 1);

  if (transition === "soft-curve") {
    const curveHalfHeight = Math.min(params.stepRadius, availableHalfHeight);
    const startY = params.boundaryY - directionSign * curveHalfHeight;
    const endY = params.boundaryY + directionSign * curveHalfHeight;

    params.commands.push(
      `L ${formatPathCoordinate(params.fromX)} ${formatPathCoordinate(startY)}`,
      `C ${formatPathCoordinate(params.fromX)} ${formatPathCoordinate(params.boundaryY)} ${formatPathCoordinate(params.toX)} ${formatPathCoordinate(params.boundaryY)} ${formatPathCoordinate(params.toX)} ${formatPathCoordinate(endY)}`,
    );

    return transition;
  }

  const sideChange = Math.abs(params.toX - params.fromX);
  const horizontalSign = Math.sign(params.toX - params.fromX);
  const radius = Math.min(
    params.stepRadius,
    availableHalfHeight,
    sideChange / 2,
  );
  const startY = params.boundaryY - directionSign * radius;
  const endY = params.boundaryY + directionSign * radius;
  const firstShoulderX = params.fromX + horizontalSign * radius;
  const secondShoulderX = params.toX - horizontalSign * radius;

  params.commands.push(
    `L ${formatPathCoordinate(params.fromX)} ${formatPathCoordinate(startY)}`,
    `Q ${formatPathCoordinate(params.fromX)} ${formatPathCoordinate(params.boundaryY)} ${formatPathCoordinate(firstShoulderX)} ${formatPathCoordinate(params.boundaryY)}`,
  );

  if (firstShoulderX !== secondShoulderX) {
    params.commands.push(
      `L ${formatPathCoordinate(secondShoulderX)} ${formatPathCoordinate(params.boundaryY)}`,
    );
  }

  params.commands.push(
    `Q ${formatPathCoordinate(params.toX)} ${formatPathCoordinate(params.boundaryY)} ${formatPathCoordinate(params.toX)} ${formatPathCoordinate(endY)}`,
  );

  return transition;
}

function buildHybridConnectedBubblePath(params: {
  bottom: number;
  lineStep: number;
  lines: ConnectedBubbleLine[];
  outerRadius: number;
  softCurveSideThreshold: number;
  stepRadius: number;
  top: number;
}) {
  const firstLine = params.lines[0];
  const lastLine = params.lines.at(-1);

  if (!firstLine || !lastLine) {
    return { pathData: "", transitions: [] as ConnectedBubbleTransition[] };
  }

  const boundaries = params.lines.slice(0, -1).map((line, index) => {
    const nextLine = params.lines[index + 1];

    return Math.round((line.centerY + nextLine.centerY) / 2);
  });
  const topRadius = Math.max(
    0,
    Math.min(
      params.outerRadius,
      firstLine.width / 2,
      (params.bottom - params.top) / 2,
    ),
  );
  const bottomRadius = Math.max(
    0,
    Math.min(
      params.outerRadius,
      lastLine.width / 2,
      (params.bottom - params.top) / 2,
    ),
  );
  const commands = [
    `M ${formatPathCoordinate(firstLine.left + topRadius)} ${formatPathCoordinate(params.top)}`,
    `L ${formatPathCoordinate(firstLine.right - topRadius)} ${formatPathCoordinate(params.top)}`,
    `Q ${formatPathCoordinate(firstLine.right)} ${formatPathCoordinate(params.top)} ${formatPathCoordinate(firstLine.right)} ${formatPathCoordinate(params.top + topRadius)}`,
  ];
  const transitions: ConnectedBubbleTransition[] = [];

  for (let index = 0; index < boundaries.length; index += 1) {
    transitions.push(
      appendConnectedBubbleTransition({
        boundaryY: boundaries[index],
        commands,
        direction: "down",
        fromX: params.lines[index].right,
        lineStep: params.lineStep,
        softCurveSideThreshold: params.softCurveSideThreshold,
        stepRadius: params.stepRadius,
        toX: params.lines[index + 1].right,
      }),
    );
  }

  commands.push(
    `L ${formatPathCoordinate(lastLine.right)} ${formatPathCoordinate(params.bottom - bottomRadius)}`,
    `Q ${formatPathCoordinate(lastLine.right)} ${formatPathCoordinate(params.bottom)} ${formatPathCoordinate(lastLine.right - bottomRadius)} ${formatPathCoordinate(params.bottom)}`,
    `L ${formatPathCoordinate(lastLine.left + bottomRadius)} ${formatPathCoordinate(params.bottom)}`,
    `Q ${formatPathCoordinate(lastLine.left)} ${formatPathCoordinate(params.bottom)} ${formatPathCoordinate(lastLine.left)} ${formatPathCoordinate(params.bottom - bottomRadius)}`,
  );

  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    appendConnectedBubbleTransition({
      boundaryY: boundaries[index],
      commands,
      direction: "up",
      fromX: params.lines[index + 1].left,
      lineStep: params.lineStep,
      softCurveSideThreshold: params.softCurveSideThreshold,
      stepRadius: params.stepRadius,
      toX: params.lines[index].left,
    });
  }

  commands.push(
    `L ${formatPathCoordinate(firstLine.left)} ${formatPathCoordinate(params.top + topRadius)}`,
    `Q ${formatPathCoordinate(firstLine.left)} ${formatPathCoordinate(params.top)} ${formatPathCoordinate(firstLine.left + topRadius)} ${formatPathCoordinate(params.top)}`,
    "Z",
  );

  return { pathData: commands.join(" "), transitions };
}

export function buildConnectedBubblePath(params: {
  centerX: number;
  groupHeight: number;
  groupY: number;
  lineCenterOffset: number;
  lineStep: number;
  outerRadius: number;
  stepRadius: number;
  widths: number[];
}) {
  if (params.widths.length === 0) {
    return {
      pathData: "",
      transitions: [] as ConnectedBubbleTransition[],
      widths: [],
    };
  }

  const widths = params.widths.map((width) => Math.round(width));
  // Visual band centers keep taller glyphs inside when adjacent widths change.
  const lines = widths.map((width, index): ConnectedBubbleLine => ({
    centerY:
      params.groupY + params.lineCenterOffset + index * params.lineStep,
    left: Math.round(params.centerX - width / 2),
    right: Math.round(params.centerX + width / 2),
    width,
  }));
  const geometry = buildHybridConnectedBubblePath({
    bottom: params.groupY + params.groupHeight,
    lineStep: params.lineStep,
    lines,
    outerRadius: params.outerRadius,
    softCurveSideThreshold: params.stepRadius,
    stepRadius: params.stepRadius,
    top: params.groupY,
  });

  return {
    pathData: geometry.pathData,
    transitions: geometry.transitions,
    widths,
  };
}

type BubbleMarkup = {
  bubble: string;
  diagnostics: CarouselBubbleLineDiagnostic[];
  mask: string;
  text: string;
};

function buildBubbleText(params: {
  className: string;
  cornerSafety: number;
  fill: string;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maxBubbleWidth: number;
  measuredLineExtents?: RenderedTextExtents[];
  measuredLineWidths?: number[];
  mode: "connected" | "single";
  paddingX: number;
  paddingY: number;
  lineOverlap?: number;
  radius: number;
  shadow?: boolean;
  x: number;
  y: number;
}): BubbleMarkup {
  const metrics = measureBubbleLines({
    cornerSafety: params.cornerSafety,
    fontSize: params.fontSize,
    lineHeight: params.lineHeight,
    lines: params.lines,
    maxBubbleWidth: params.maxBubbleWidth,
    measuredLineExtents: params.measuredLineExtents,
    measuredLineWidths: params.measuredLineWidths,
    mode: params.mode,
    paddingX: params.paddingX,
    paddingY: params.paddingY,
    lineOverlap: params.lineOverlap,
    radius: params.radius,
  });

  if (params.lines.length === 0) {
    return { bubble: "", diagnostics: [], mask: "", text: "" };
  }

  const groupY = Math.round(params.y);
  const stepRadius = clamp(Math.round(params.fontSize * 0.5), 18, 24);
  const visualWidths = snapConnectedBubbleVisualWidths({
    requiredWidths: metrics.rects.map((rect) => rect.requiredWidth),
  });

  metrics.rects.forEach((rect, index) => {
    rect.visualWidth = visualWidths[index];
  });

  const bubbleGeometry = buildConnectedBubblePath({
    centerX: params.x,
    groupHeight: metrics.groupHeight,
    groupY,
    lineCenterOffset: metrics.rectHeight / 2,
    lineStep: metrics.lineStep,
    outerRadius: params.radius,
    stepRadius,
    widths: metrics.rects.map((rect) => rect.visualWidth),
  });
  const bubblePath = `<path d="${bubbleGeometry.pathData}" fill="${params.fill}"/>`;
  const maskPath = `<path d="${bubbleGeometry.pathData}" fill="#ffffff"/>`;
  const textLines = params.lines
    .map((line, index) => {
      const textY = groupY + metrics.baselineOffset + index * metrics.lineStep;

      return `<text x="${params.x}" y="${textY}" class="${params.className}" font-size="${params.fontSize}" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("");

  return {
    bubble: `<g${params.shadow ? ' filter="url(#bubbleShadow)"' : ""}>${bubblePath}</g>`,
    diagnostics: params.lines.map((line, index) => ({
      cornerSafety: params.cornerSafety,
      estimatedTextWidth: metrics.rects[index].estimatedTextWidth,
      fontFamily: TEXT_FONT_FAMILY,
      fontSize: params.fontSize,
      measuredTextWidth: metrics.rects[index].measuredTextWidth,
      paddingX: params.paddingX,
      radius: params.radius,
      rectangleWidth: bubbleGeometry.widths[index],
      requiredWidth: metrics.rects[index].requiredWidth,
      stepRadius,
      text: line,
      transitionToNext: bubbleGeometry.transitions[index] ?? "none",
      visualWidth: bubbleGeometry.widths[index],
      widthSnapSideThreshold: CONNECTED_BUBBLE_SIDE_SNAP,
    })),
    mask: maskPath,
    text: textLines,
  };
}

function getPreferredCenterRatio(position: PlannedCarouselSlide["textPosition"]) {
  if (position === "top") {
    return 0.35;
  }

  if (position === "bottom") {
    return 0.62;
  }

  return 0.5;
}

function getImageBrightness(signal: RegionSignal, textStyle: CarouselRenderStyle) {
  const styleAdjustment = textStyle === "plain" ? 0.02 : 0;

  if (signal.contrast > 76) {
    return 0.92 + styleAdjustment;
  }

  if (signal.brightness > 206) {
    return 0.94 + styleAdjustment;
  }

  return 0.96 + styleAdjustment;
}

type OverlayLayers = {
  bubbleMask: Buffer;
  diagnostics: Omit<
    CarouselRenderDiagnostics,
    | "escapedTextPixels"
    | "repaired"
    | "textPixelContainmentPassed"
    | "textPixels"
  >;
  overlay: Buffer;
  textMask: Buffer;
};

function getHeadlineRadius(fontSize: number) {
  return clamp(Math.round(fontSize * 0.42), 18, 22);
}

function getBodyRadius(fontSize: number) {
  return clamp(Math.round(fontSize * 0.45), 18, 22);
}

function getHeadlineWrapCornerSafety(fontSize: number) {
  return clamp(Math.round(fontSize * 0.28), 14, 16) + MIN_CORNER_SAFETY;
}

function getBodyWrapCornerSafety(fontSize: number) {
  return clamp(Math.round(fontSize * 0.3), 14, 16) + MIN_CORNER_SAFETY;
}

function getBubbleCornerSafety(radius: number, safetyBoost: number) {
  return clamp(Math.round(radius * 0.45), 8, 10) + safetyBoost;
}

function buildSvgDocument(params: {
  content: string;
  definitions?: string;
  height: number;
  style?: string;
  width: number;
}) {
  return Buffer.from(`
<svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
  ${params.definitions ? `<defs>${params.definitions}</defs>` : ""}
  ${params.content}
  ${params.style ? `<style>${params.style}</style>` : ""}
</svg>`);
}

async function buildOverlaySvg(params: {
  format: CarouselFormat;
  height: number;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  safetyBoost: number;
  slide: PlannedCarouselSlide;
  width: number;
}): Promise<OverlayLayers> {
  const isSquare = params.format === "1:1";
  const safeMarginX = isSquare ? 108 : 96;
  const safeMarginY = isSquare ? 112 : 136;
  const maxBubbleWidth = Math.min(
    params.width - safeMarginX * 2,
    Math.round(params.width * 0.78),
  );
  const textMode = getSlideTextMode(params.slide);
  const rawHeadlineText = normalizeText(params.slide.headline);
  const stackedBodyLines = getListOverlayLines(params.slide, textMode);
  const hasStackedBody = stackedBodyLines.length > 0;
  const rawBodyText = hasStackedBody ? "" : getBodyText(params.slide);
  const shouldRenderHeadline =
    Boolean(rawHeadlineText) &&
    textMode !== "body_only" &&
    textMode !== "single_statement";
  const headlineText = shouldRenderHeadline ? rawHeadlineText : "";
  const bodyText =
    shouldRenderHeadline || rawBodyText ? rawBodyText : rawHeadlineText;
  const bodyOnlyMode = !headlineText;
  const headlinePaddingX = 18;
  const headlinePaddingY = 7;
  const headlineLineOverlap = 8;
  const bodyPaddingX = 18;
  const bodyPaddingY = 6;
  const bodyLineOverlap = 9;
  const headline = await fitMeasuredText(headlineText, {
    fontSize: CAROUSEL_FIXED_FONT_SIZE,
    fontFamily: TEXT_FONT_FAMILY,
    fontWeight: HEADLINE_FONT_WEIGHT,
    getCornerSafety: (fontSize) =>
      getHeadlineWrapCornerSafety(fontSize) + params.safetyBoost,
    lineHeightRatio: 1.04,
    maxLines: 2,
    maxWidth: maxBubbleWidth,
    paddingX: headlinePaddingX,
  });
  const body = hasStackedBody
    ? await fitStackedText(stackedBodyLines, {
        fontSize: CAROUSEL_FIXED_FONT_SIZE,
        fontFamily: TEXT_FONT_FAMILY,
        fontWeight: BODY_FONT_WEIGHT,
        getCornerSafety: (fontSize) =>
          getBodyWrapCornerSafety(fontSize) + params.safetyBoost,
        lineHeightRatio: 1.04,
        maxLines: 4,
        maxWidth: maxBubbleWidth,
        paddingX: bodyPaddingX,
      })
    : bodyText
      ? await fitMeasuredText(bodyText, {
          fontSize: CAROUSEL_FIXED_FONT_SIZE,
          fontFamily: TEXT_FONT_FAMILY,
          fontWeight: BODY_FONT_WEIGHT,
          getCornerSafety: (fontSize) =>
            getBodyWrapCornerSafety(fontSize) + params.safetyBoost,
          lineHeightRatio: bodyOnlyMode ? 1.04 : 1.05,
          maxLines: 4,
          maxWidth: maxBubbleWidth,
          paddingX: bodyPaddingX,
        })
      : {
          fontSize: 0,
          lineHeight: 0,
          lines: [],
          measuredLineExtents: [],
          measuredLineWidths: [],
        };
  const headlineRadius = getHeadlineRadius(headline.fontSize);
  const headlineCornerSafety = getBubbleCornerSafety(
    headlineRadius,
    params.safetyBoost,
  );
  const bodyRadius = getBodyRadius(body.fontSize);
  const bodyCornerSafety = getBubbleCornerSafety(
    bodyRadius,
    params.safetyBoost,
  );
  const headlineMetrics = measureBubbleLines({
    cornerSafety: headlineCornerSafety,
    fontSize: headline.fontSize,
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    maxBubbleWidth,
    measuredLineExtents: headline.measuredLineExtents,
    measuredLineWidths: headline.measuredLineWidths,
    mode: "connected",
    paddingX: headlinePaddingX,
    paddingY: headlinePaddingY,
    lineOverlap: headlineLineOverlap,
    radius: headlineRadius,
  });
  const bodyMetrics = measureBubbleLines({
    cornerSafety: bodyCornerSafety,
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    lines: body.lines,
    maxBubbleWidth,
    measuredLineExtents: getMeasuredLineExtents(body),
    measuredLineWidths: getMeasuredLineWidths(body),
    mode: "connected",
    paddingX: bodyPaddingX,
    paddingY: bodyPaddingY,
    lineOverlap: bodyLineOverlap,
    radius: bodyRadius,
  });
  const blockGap =
    body.lines.length > 0 ? clamp(Math.round(body.fontSize * 0.56), 20, 28) : 0;
  const blockHeight = headlineMetrics.groupHeight + blockGap + bodyMetrics.groupHeight;
  const preferredCenterY = Math.round(
    params.height *
      (params.normalizedTextPosition
        ? clamp(params.normalizedTextPosition.y, 0.1, 0.9)
        : getPreferredCenterRatio(params.slide.textPosition)),
  );
  const blockTop = clamp(
    Math.round(preferredCenterY - blockHeight / 2),
    safeMarginY,
    params.height - safeMarginY - blockHeight,
  );
  const widestBubble = Math.max(
    0,
    ...headlineMetrics.rects.map((rect) => rect.visualWidth),
    ...bodyMetrics.rects.map((rect) => rect.visualWidth),
  );
  const textX = params.normalizedTextPosition
    ? Math.round(
        clamp(
          params.width * clamp(params.normalizedTextPosition.x, 0.1, 0.9),
          safeMarginX + widestBubble / 2,
          params.width - safeMarginX - widestBubble / 2,
        ),
      )
    : Math.round(params.width / 2);
  const headlineY = blockTop;
  const bodyY = headlineY + headlineMetrics.groupHeight + blockGap;
  const headlineMarkup = buildBubbleText({
    className: "headline",
    cornerSafety: headlineCornerSafety,
    fill: HEADLINE_BUBBLE_FILL,
    fontSize: headline.fontSize,
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    maxBubbleWidth,
    measuredLineExtents: headline.measuredLineExtents,
    measuredLineWidths: headline.measuredLineWidths,
    mode: "connected",
    paddingX: headlinePaddingX,
    paddingY: headlinePaddingY,
    lineOverlap: headlineLineOverlap,
    radius: headlineRadius,
    shadow: true,
    x: textX,
    y: headlineY,
  });
  const bodyMarkup = buildBubbleText({
    className: "body",
    cornerSafety: bodyCornerSafety,
    fill: BODY_BUBBLE_FILL,
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    lines: body.lines,
    maxBubbleWidth,
    measuredLineExtents: getMeasuredLineExtents(body),
    measuredLineWidths: getMeasuredLineWidths(body),
    mode: "connected",
    paddingX: bodyPaddingX,
    paddingY: bodyPaddingY,
    lineOverlap: bodyLineOverlap,
    radius: bodyRadius,
    shadow: true,
    x: textX,
    y: bodyY,
  });
  const style = `
    .headline { fill: ${DARK_TEXT}; font-family: ${TEXT_FONT_FAMILY}; font-weight: ${HEADLINE_FONT_WEIGHT}; letter-spacing: 0; }
    .body { fill: ${BODY_TEXT}; font-family: ${TEXT_FONT_FAMILY}; font-weight: ${BODY_FONT_WEIGHT}; letter-spacing: 0; }
  `;
  const definitions = `
    <filter id="bubbleShadow" x="-25%" y="-35%" width="150%" height="170%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.16"/>
    </filter>
  `;

  return {
    bubbleMask: buildSvgDocument({
      content: `${headlineMarkup.mask}${bodyMarkup.mask}`,
      height: params.height,
      width: params.width,
    }),
    diagnostics: {
      bubbleShapeStrategy: "hybrid-soft-union-connected-path",
      fontFamily: TEXT_FONT_FAMILY,
      lines: [...headlineMarkup.diagnostics, ...bodyMarkup.diagnostics],
      maxBubbleWidth,
    },
    overlay: buildSvgDocument({
      content: `${headlineMarkup.bubble}${bodyMarkup.bubble}${headlineMarkup.text}${bodyMarkup.text}`,
      definitions,
      height: params.height,
      style,
      width: params.width,
    }),
    textMask: buildSvgDocument({
      content: `${headlineMarkup.text}${bodyMarkup.text}`,
      height: params.height,
      style,
      width: params.width,
    }),
  };
}

async function validateTextPixelContainment(layers: OverlayLayers) {
  const [bubble, text] = await Promise.all([
    sharp(layers.bubbleMask).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(layers.textMask).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  let escapedTextPixels = 0;
  let textPixels = 0;

  for (let index = 3; index < text.data.length; index += text.info.channels) {
    const textAlpha = text.data[index] ?? 0;

    if (textAlpha <= 8) {
      continue;
    }

    textPixels += 1;
    const pixelIndex = Math.floor(index / text.info.channels);
    const bubbleAlpha =
      bubble.data[pixelIndex * bubble.info.channels + 3] ?? 0;

    if (bubbleAlpha <= 8) {
      escapedTextPixels += 1;
    }
  }

  return { escapedTextPixels, textPixels };
}

async function buildValidatedOverlay(params: {
  format: CarouselFormat;
  height: number;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  slide: PlannedCarouselSlide;
  width: number;
}) {
  const attempts = [
    { safetyBoost: 0 },
    { safetyBoost: 8 },
  ];
  let lastContainment = { escapedTextPixels: 0, textPixels: 0 };

  for (const [attemptIndex, attempt] of attempts.entries()) {
    const layers = await buildOverlaySvg({ ...params, ...attempt });
    const containment = await validateTextPixelContainment(layers);

    lastContainment = containment;

    if (containment.escapedTextPixels === 0) {
      return {
        diagnostics: {
          ...layers.diagnostics,
          ...containment,
          repaired: attemptIndex > 0,
          textPixelContainmentPassed: true,
        } satisfies CarouselRenderDiagnostics,
        overlay: layers.overlay,
      };
    }
  }

  throw new Error(
    `Carousel text containment failed after repair: ${lastContainment.escapedTextPixels} visible text pixels escaped the bubble.`,
  );
}

export async function inspectCarouselSlideLayout(input: {
  format: CarouselFormat;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  slide: PlannedCarouselSlide;
}) {
  const dimensions = FORMAT_DIMENSIONS[input.format];

  return (await buildValidatedOverlay({
    format: input.format,
    height: dimensions.height,
    normalizedTextPosition: input.normalizedTextPosition,
    slide: input.slide,
    width: dimensions.width,
  })).diagnostics;
}

export async function renderCarouselSlideWithDiagnostics(
  input: RenderCarouselSlideInput,
) {
  const dimensions = FORMAT_DIMENSIONS[input.format];
  const backgroundBuffer = await downloadImageBuffer(input.assetUrl);
  const signal = await getRegionSignal({
    backgroundBuffer,
    height: dimensions.height,
    normalizedTextPosition: input.normalizedTextPosition,
    position: input.slide.textPosition,
    width: dimensions.width,
  });
  const overlay = await buildValidatedOverlay({
    format: input.format,
    height: dimensions.height,
    normalizedTextPosition: input.normalizedTextPosition,
    slide: input.slide,
    width: dimensions.width,
  });

  const buffer = await sharp(backgroundBuffer)
    .rotate()
    .resize(dimensions.width, dimensions.height, {
      fit: "cover",
      position: "center",
    })
    .modulate({
      brightness: getImageBrightness(signal, input.textStyle),
      saturation: 0.96,
    })
    .composite([
      {
        input: overlay.overlay,
        left: 0,
        top: 0,
      },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  return { buffer, diagnostics: overlay.diagnostics };
}

export async function renderCarouselSlide(input: RenderCarouselSlideInput) {
  return (await renderCarouselSlideWithDiagnostics(input)).buffer;
}
