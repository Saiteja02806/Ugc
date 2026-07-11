import sharp from "sharp";

import type { CarouselFormat } from "@/lib/carousel/db";
import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import type { PlannedCarouselSlide } from "@/lib/carousel/slide-plan";

type RenderCarouselSlideInput = {
  assetUrl: string;
  businessName?: string | null;
  format: CarouselFormat;
  slide: PlannedCarouselSlide;
  textStyle: CarouselRenderStyle;
};

type WrappedText = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

type MeasuredWrappedText = WrappedText & {
  measuredLineWidths: number[];
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
    width: number;
  }>;
};

type BalancedLines = {
  lines: string[];
  truncated: boolean;
};

export const CAROUSEL_RENDERER_VERSION =
  "social-bubble-renderer-v6-unified-text-silhouette";

const FORMAT_DIMENSIONS: Record<CarouselFormat, { height: number; width: number }> = {
  "1:1": { height: 1080, width: 1080 },
  "4:5": { height: 1350, width: 1080 },
};

const DARK_TEXT = "#111316";
const BODY_TEXT = "#15171a";
const HEADLINE_BUBBLE_FILL = "#fffdf9";
const BODY_BUBBLE_FILL = "#ffffff";
const TEXT_FONT_FAMILY = "Geist, Arial, Helvetica, sans-serif";
const HEADLINE_FONT_WEIGHT = 700;
const BODY_FONT_WEIGHT = 600;
const TEXT_WIDTH_ALLOWANCE = 8;

function getMeasuredLineWidths(value: WrappedText) {
  return "measuredLineWidths" in value &&
    Array.isArray(value.measuredLineWidths)
    ? value.measuredLineWidths
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

async function measureRenderedTextWidths(params: {
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
      const baselineY = Math.round(padding + params.fontSize * 1.45);
      const svg = Buffer.from(`
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <text x="${padding}" y="${baselineY}" fill="#000000" font-family="${params.fontFamily}" font-size="${params.fontSize}" font-weight="${params.fontWeight}" letter-spacing="${params.letterSpacing}">${escapeXml(line)}</text>
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

      return maxX >= minX ? maxX - minX + 1 : estimatedWidth;
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
  fontFamily: string;
  fontWeight: number;
  horizontalAllowance: number;
  lineHeightRatio: number;
  maxLines: number;
  maxWidth: number;
  minFontSize: number;
  paddingX: number;
  startFontSize: number;
}): Promise<MeasuredWrappedText> {
  let fallback: MeasuredWrappedText | null = null;

  for (
    let fontSize = params.startFontSize;
    fontSize >= params.minFontSize;
    fontSize -= 2
  ) {
    const wrapped = buildBalancedLines({
      fontSize,
      maxLines: params.maxLines,
      maxWidth: params.maxWidth - params.paddingX * 2 - params.horizontalAllowance,
      value,
    });
    const measuredLineWidths = await measureRenderedTextWidths({
      fontFamily: params.fontFamily,
      fontSize,
      fontWeight: params.fontWeight,
      letterSpacing: 0,
      lines: wrapped.lines,
    });
    const fits = measuredLineWidths.every(
      (lineWidth) =>
        lineWidth + params.paddingX * 2 + params.horizontalAllowance <=
        params.maxWidth,
    );
    const result = {
      fontSize,
      lineHeight: Math.round(fontSize * params.lineHeightRatio),
      lines: wrapped.lines,
      measuredLineWidths,
    };

    if (!fallback && fits) {
      fallback = result;
    }

    if (fits && !wrapped.truncated) {
      return result;
    }
  }

  if (fallback) {
    return fallback;
  }

  const fontSize = params.minFontSize;
  const wrapped = buildBalancedLines({
    fontSize,
    maxLines: params.maxLines,
    maxWidth: params.maxWidth - params.paddingX * 2 - params.horizontalAllowance,
    value,
  });

  return {
    fontSize,
    lineHeight: Math.round(fontSize * params.lineHeightRatio),
    lines: wrapped.lines,
    measuredLineWidths: await measureRenderedTextWidths({
      fontFamily: params.fontFamily,
      fontSize,
      fontWeight: params.fontWeight,
      letterSpacing: 0,
      lines: wrapped.lines,
    }),
  };
}

function fitStackedText(values: string[], params: {
  lineHeightRatio: number;
  maxLines: number;
  maxWidth: number;
  minFontSize: number;
  startFontSize: number;
}): WrappedText {
  const cleanValues = values.map(normalizeText).filter(Boolean);
  let fallback: WrappedText | null = null;

  if (cleanValues.length === 0) {
    return { fontSize: 0, lineHeight: 0, lines: [] };
  }

  for (
    let fontSize = params.startFontSize;
    fontSize >= params.minFontSize;
    fontSize -= 2
  ) {
    const lines: string[] = [];

    for (const value of cleanValues) {
      const remainingLines = params.maxLines - lines.length;

      if (remainingLines <= 0) {
        break;
      }

      const wrapped = buildBalancedLines({
        fontSize,
        maxLines: Math.min(2, remainingLines),
        maxWidth: params.maxWidth,
        value,
      });

      lines.push(...wrapped.lines);
    }

    const fits =
      lines.length > 0 &&
      lines.length <= params.maxLines &&
      lines.every((line) => estimateTextWidth(line, fontSize) <= params.maxWidth);
    const result = {
      fontSize,
      lineHeight: Math.round(fontSize * params.lineHeightRatio),
      lines,
    };

    if (!fallback && fits) {
      fallback = result;
    }

    if (fits && lines.length >= Math.min(cleanValues.length, params.maxLines)) {
      return result;
    }
  }

  return (
    fallback ?? {
      fontSize: params.minFontSize,
      lineHeight: Math.round(params.minFontSize * params.lineHeightRatio),
      lines: cleanValues.slice(0, params.maxLines),
    }
  );
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
  const xStart = Math.round(info.width * 0.11);
  const xEnd = Math.round(info.width * 0.89);
  const [yStartRatio, yEndRatio] =
    params.position === "top"
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
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maxBubbleWidth: number;
  measuredLineWidths?: number[];
  mode: "connected" | "single";
  paddingX: number;
  paddingY: number;
  lineOverlap?: number;
  widthAllowance?: number;
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
  const widthSafety =
    params.widthAllowance ??
    Math.round(params.fontSize * (params.mode === "connected" ? 0.46 : 0.24));
  const rects = params.lines.map((line, index) => {
    const measuredLineWidth = params.measuredLineWidths?.[index];
    const lineWidth =
      typeof measuredLineWidth === "number"
        ? measuredLineWidth
        : estimateTextWidth(line, params.fontSize);

    return {
      width: Math.min(
        Math.round(lineWidth + params.paddingX * 2 + widthSafety),
        params.maxBubbleWidth,
      ),
    };
  });
  const maxLineWidth = rects.reduce(
    (widestLine, rect) => Math.max(widestLine, rect.width),
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

function buildBubbleText(params: {
  className: string;
  fill: string;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maxBubbleWidth: number;
  measuredLineWidths?: number[];
  mode: "connected" | "single";
  paddingX: number;
  paddingY: number;
  lineOverlap?: number;
  radius: number;
  shadow?: boolean;
  widthAllowance?: number;
  x: number;
  y: number;
}) {
  const metrics = measureBubbleLines({
    fontSize: params.fontSize,
    lineHeight: params.lineHeight,
    lines: params.lines,
    maxBubbleWidth: params.maxBubbleWidth,
    measuredLineWidths: params.measuredLineWidths,
    mode: params.mode,
    paddingX: params.paddingX,
    paddingY: params.paddingY,
    lineOverlap: params.lineOverlap,
    widthAllowance: params.widthAllowance,
  });

  if (params.lines.length === 0) {
    return "";
  }

  if (params.mode === "single") {
    const rectX = Math.round(params.x - metrics.bubbleWidth / 2);
    const rectY = Math.round(params.y);
    const textLines = params.lines
      .map((line, index) => {
        const textY = rectY + metrics.baselineOffset + index * metrics.lineStep;

        return `<text x="${params.x}" y="${textY}" class="${params.className}" font-size="${params.fontSize}" text-anchor="middle">${escapeXml(line)}</text>`;
      })
      .join("");

    return `<g${params.shadow ? ' filter="url(#bubbleShadow)"' : ""}>
      <rect x="${rectX}" y="${rectY}" width="${metrics.bubbleWidth}" height="${metrics.groupHeight}" rx="${params.radius}" fill="${params.fill}" fill-opacity="0.97"/>
      ${textLines}
    </g>`;
  }

  const groupY = Math.round(params.y);
  const clipId = `${params.className}-bubble-silhouette`;
  const silhouetteRects = params.lines
    .map((_, index) => {
      const rect = metrics.rects[index];

      if (!rect) {
        return "";
      }

      return `<rect x="${Math.round(params.x - rect.width / 2)}" y="${Math.round(
        groupY + index * metrics.lineStep,
      )}" width="${rect.width}" height="${metrics.rectHeight}" rx="${params.radius}"/>`;
    })
    .join("");
  const textLines = params.lines
    .map((line, index) => {
      const textY = groupY + metrics.baselineOffset + index * metrics.lineStep;

      return `<text x="${params.x}" y="${textY}" class="${params.className}" font-size="${params.fontSize}" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("");

  return `<defs>
    <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
      ${silhouetteRects}
    </clipPath>
  </defs>
  <g${params.shadow ? ' filter="url(#bubbleShadow)"' : ""}>
    <rect x="${Math.round(params.x - metrics.bubbleWidth / 2)}" y="${groupY}" width="${metrics.bubbleWidth}" height="${metrics.groupHeight}" fill="${params.fill}" fill-opacity="0.97" clip-path="url(#${clipId})"/>
    ${textLines}
  </g>`;
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

async function buildOverlaySvg(params: {
  format: CarouselFormat;
  height: number;
  slide: PlannedCarouselSlide;
  width: number;
}) {
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
  const textWidthAllowance = TEXT_WIDTH_ALLOWANCE;
  const headline = await fitMeasuredText(headlineText, {
    fontFamily: TEXT_FONT_FAMILY,
    fontWeight: HEADLINE_FONT_WEIGHT,
    horizontalAllowance: textWidthAllowance,
    lineHeightRatio: 1.04,
    maxLines: 2,
    maxWidth: maxBubbleWidth,
    minFontSize: isSquare ? 40 : 42,
    paddingX: headlinePaddingX,
    startFontSize: isSquare ? 50 : 54,
  });
  const body = hasStackedBody
    ? fitStackedText(stackedBodyLines, {
        lineHeightRatio: 1.04,
        maxLines: 4,
        maxWidth: maxBubbleWidth - bodyPaddingX * 2 - textWidthAllowance,
        minFontSize: bodyOnlyMode ? (isSquare ? 32 : 34) : isSquare ? 30 : 32,
        startFontSize: bodyOnlyMode ? (isSquare ? 40 : 42) : isSquare ? 36 : 38,
      })
    : bodyText
      ? await fitMeasuredText(bodyText, {
          fontFamily: TEXT_FONT_FAMILY,
          fontWeight: BODY_FONT_WEIGHT,
          horizontalAllowance: textWidthAllowance,
          lineHeightRatio: bodyOnlyMode ? 1.04 : 1.05,
          maxLines: 4,
          maxWidth: maxBubbleWidth,
          minFontSize: bodyOnlyMode ? (isSquare ? 34 : 36) : isSquare ? 32 : 34,
          paddingX: bodyPaddingX,
          startFontSize: bodyOnlyMode ? (isSquare ? 42 : 44) : isSquare ? 38 : 40,
        })
      : { fontSize: 0, lineHeight: 0, lines: [] };
  const headlineMetrics = measureBubbleLines({
    fontSize: headline.fontSize,
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    maxBubbleWidth,
    measuredLineWidths: headline.measuredLineWidths,
    mode: "connected",
    paddingX: headlinePaddingX,
    paddingY: headlinePaddingY,
    lineOverlap: headlineLineOverlap,
    widthAllowance: textWidthAllowance,
  });
  const bodyMetrics = measureBubbleLines({
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    lines: body.lines,
    maxBubbleWidth,
    measuredLineWidths: getMeasuredLineWidths(body),
    mode: "connected",
    paddingX: bodyPaddingX,
    paddingY: bodyPaddingY,
    lineOverlap: bodyLineOverlap,
    widthAllowance: textWidthAllowance,
  });
  const blockGap =
    body.lines.length > 0 ? clamp(Math.round(body.fontSize * 0.56), 20, 28) : 0;
  const blockHeight = headlineMetrics.groupHeight + blockGap + bodyMetrics.groupHeight;
  const preferredCenterY = Math.round(
    params.height * getPreferredCenterRatio(params.slide.textPosition),
  );
  const blockTop = clamp(
    Math.round(preferredCenterY - blockHeight / 2),
    safeMarginY,
    params.height - safeMarginY - blockHeight,
  );
  const textX = Math.round(params.width / 2);
  const headlineY = blockTop;
  const bodyY = headlineY + headlineMetrics.groupHeight + blockGap;

  return Buffer.from(`
<svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="bubbleShadow" x="-25%" y="-35%" width="150%" height="170%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.16"/>
    </filter>
  </defs>
  ${buildBubbleText({
    className: "headline",
    fill: HEADLINE_BUBBLE_FILL,
    fontSize: headline.fontSize,
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    maxBubbleWidth,
    measuredLineWidths: headline.measuredLineWidths,
    mode: "connected",
    paddingX: headlinePaddingX,
    paddingY: headlinePaddingY,
    lineOverlap: headlineLineOverlap,
    radius: clamp(Math.round(headline.fontSize * 0.2), 8, 12),
    shadow: true,
    widthAllowance: textWidthAllowance,
    x: textX,
    y: headlineY,
  })}
  ${buildBubbleText({
    className: "body",
    fill: BODY_BUBBLE_FILL,
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    lines: body.lines,
    maxBubbleWidth,
    measuredLineWidths: getMeasuredLineWidths(body),
    mode: "connected",
    paddingX: bodyPaddingX,
    paddingY: bodyPaddingY,
    lineOverlap: bodyLineOverlap,
    radius: clamp(Math.round(body.fontSize * 0.22), 8, 12),
    shadow: true,
    widthAllowance: textWidthAllowance,
    x: textX,
    y: bodyY,
  })}
  <style>
    .headline { fill: ${DARK_TEXT}; font-family: ${TEXT_FONT_FAMILY}; font-weight: ${HEADLINE_FONT_WEIGHT}; letter-spacing: 0; }
    .body { fill: ${BODY_TEXT}; font-family: ${TEXT_FONT_FAMILY}; font-weight: ${BODY_FONT_WEIGHT}; letter-spacing: 0; }
  </style>
</svg>`);
}

export async function renderCarouselSlide(input: RenderCarouselSlideInput) {
  const dimensions = FORMAT_DIMENSIONS[input.format];
  const backgroundBuffer = await downloadImageBuffer(input.assetUrl);
  const signal = await getRegionSignal({
    backgroundBuffer,
    height: dimensions.height,
    position: input.slide.textPosition,
    width: dimensions.width,
  });
  const overlay = await buildOverlaySvg({
    format: input.format,
    height: dimensions.height,
    slide: input.slide,
    width: dimensions.width,
  });

  return sharp(backgroundBuffer)
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
        input: overlay,
        left: 0,
        top: 0,
      },
    ])
    .webp({ quality: 90 })
    .toBuffer();
}
