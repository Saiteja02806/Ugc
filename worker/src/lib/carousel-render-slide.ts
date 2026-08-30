import sharp from "sharp";

import type { CarouselFormat } from "../types.js";
import type { CarouselRenderStyle } from "./carousel-render-style.js";
import {
  CAROUSEL_STRUCTURE_1_HEADLINE_MAX_LINES,
  CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES,
  CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES,
  getCarouselStructure1BodyMaxLines,
  type PlannedCarouselSlide,
} from "./carousel-slide-plan.js";

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

export type CarouselRenderDiagnostics = {
  bubbleShapeStrategy: "plain-white-text-with-shadow";
  fontFamily: string;
  maxTextWidth: number;
  whiteBackgroundGroupCount: number;
};

type BalancedLines = {
  lines: string[];
  truncated: boolean;
};

export const CAROUSEL_RENDERER_VERSION =
  "social-plain-text-renderer-v16-followup-copy-50";
export const CAROUSEL_FIXED_FONT_SIZE = 44;

const FORMAT_DIMENSIONS: Record<CarouselFormat, { height: number; width: number }> = {
  "1:1": { height: 1080, width: 1080 },
  "4:5": { height: 1350, width: 1080 },
};

const BODY_TEXT = "#ffffff";
const TEXT_FONT_FAMILY = "Geist, Arial, Helvetica, sans-serif";
const BODY_FONT_WEIGHT = 600;
const MIN_CORNER_SAFETY = 6;

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
  let states = new Map<number, { lines: string[]; penalty: number }>([
    [0, { lines: [], penalty: 0 }],
  ]);

  for (let lineCount = 1; lineCount <= maxLines; lineCount += 1) {
    const nextStates = new Map<
      number,
      { lines: string[]; penalty: number }
    >();

    for (const [startIndex, state] of states) {
      for (let endIndex = startIndex + 1; endIndex <= words.length; endIndex += 1) {
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
        const shortLastLinePenalty =
          endIndex === words.length && lineWidth < params.maxWidth * 0.34
            ? params.maxWidth * params.maxWidth * 0.16
            : 0;
        const candidate = {
          lines: [
            ...state.lines,
            words.slice(startIndex, endIndex).join(" "),
          ],
          penalty: state.penalty + rag * rag + shortLastLinePenalty,
        };
        const existing = nextStates.get(endIndex);

        if (!existing || candidate.penalty < existing.penalty) {
          nextStates.set(endIndex, candidate);
        }
      }
    }

    states = nextStates;
    const complete = states.get(words.length);

    if (complete) {
      const candidate = {
        lines: complete.lines,
        penalty:
          complete.penalty + complete.lines.length * params.maxWidth * 18,
      };

      if (!best || candidate.penalty < best.penalty) {
        best = candidate;
      }
    }
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
  maxLinesPerValue: number;
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
      maxLines: params.maxLinesPerValue,
      maxTextWidth,
      value,
    });

    if (wrapped.truncated || !wrapped.fits) {
      throw new Error(
        `Carousel list text could not fit within ${params.maxLinesPerValue} lines at the fixed ${params.fontSize}px font size.`,
      );
    }

    if (lines.length + wrapped.lines.length > params.maxLines) {
      throw new Error(
        `Carousel list needs more than ${params.maxLines} visual lines at the fixed ${params.fontSize}px font size.`,
      );
    }

    lines.push(...wrapped.lines);
    extents.push(...wrapped.extents);
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

type PlainTextMetrics = {
  groupHeight: number;
  maximumTextWidth: number;
};

function measurePlainText(params: {
  lineHeight: number;
  lines: string[];
  measuredLineExtents?: RenderedTextExtents[];
  measuredLineWidths?: number[];
}): PlainTextMetrics {
  const maximumTextWidth = params.lines.reduce((widest, line, index) => {
    const extents = params.measuredLineExtents?.[index];
    const measuredWidth = params.measuredLineWidths?.[index];
    const visibleWidth = extents
      ? Math.max(Math.abs(extents.left), Math.abs(extents.right)) * 2
      : (measuredWidth ?? 0);

    return Math.max(widest, Math.ceil(visibleWidth));
  }, 0);

  return {
    groupHeight: params.lines.length * params.lineHeight,
    maximumTextWidth,
  };
}

function buildPlainWhiteText(params: {
  className: string;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  x: number;
  y: number;
}) {
  if (params.lines.length === 0) return "";

  const baselineStart = Math.round(params.y + params.fontSize * 0.78);
  const lines = params.lines
    .map(
      (line, index) =>
        `<text x="${params.x}" y="${baselineStart + index * params.lineHeight}" class="${params.className}" font-size="${params.fontSize}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");

  return `<g>${lines}</g>`;
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
  diagnostics: CarouselRenderDiagnostics;
  overlay: Buffer;
};

function getBodyWrapCornerSafety(fontSize: number) {
  return clamp(Math.round(fontSize * 0.3), 14, 16) + MIN_CORNER_SAFETY;
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
  slide: PlannedCarouselSlide;
  width: number;
}): Promise<OverlayLayers> {
  const isSquare = params.format === "1:1";
  const safeMarginX = isSquare ? 108 : 96;
  const safeMarginY = isSquare ? 112 : 136;
  const maxTextWidth = Math.min(
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
  const bodyPaddingX = 18;
  const headline = await fitMeasuredText(headlineText, {
    fontSize: CAROUSEL_FIXED_FONT_SIZE,
    fontFamily: TEXT_FONT_FAMILY,
    fontWeight: BODY_FONT_WEIGHT,
    getCornerSafety: getBodyWrapCornerSafety,
    lineHeightRatio: 1.04,
    maxLines: CAROUSEL_STRUCTURE_1_HEADLINE_MAX_LINES,
    maxWidth: maxTextWidth,
    paddingX: bodyPaddingX,
  });
  const body = hasStackedBody
    ? await fitStackedText(stackedBodyLines, {
        fontSize: CAROUSEL_FIXED_FONT_SIZE,
        fontFamily: TEXT_FONT_FAMILY,
        fontWeight: BODY_FONT_WEIGHT,
        getCornerSafety: getBodyWrapCornerSafety,
        lineHeightRatio: 1.04,
        maxLines: CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES,
        maxLinesPerValue: CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES,
        maxWidth: maxTextWidth,
        paddingX: bodyPaddingX,
      })
    : bodyText
      ? await fitMeasuredText(bodyText, {
          fontSize: CAROUSEL_FIXED_FONT_SIZE,
          fontFamily: TEXT_FONT_FAMILY,
          fontWeight: BODY_FONT_WEIGHT,
          getCornerSafety: getBodyWrapCornerSafety,
          lineHeightRatio: bodyOnlyMode ? 1.04 : 1.05,
          maxLines: getCarouselStructure1BodyMaxLines(params.slide.slideNumber),
          maxWidth: maxTextWidth,
          paddingX: bodyPaddingX,
        })
      : {
          fontSize: 0,
          lineHeight: 0,
          lines: [],
          measuredLineExtents: [],
          measuredLineWidths: [],
        };
  const headlineMetrics = measurePlainText({
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    measuredLineExtents: headline.measuredLineExtents,
    measuredLineWidths: headline.measuredLineWidths,
  });
  const bodyMetrics = measurePlainText({
    lineHeight: body.lineHeight,
    lines: body.lines,
    measuredLineExtents: getMeasuredLineExtents(body),
    measuredLineWidths: getMeasuredLineWidths(body),
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
  const widestTextGroup = Math.max(
    headlineMetrics.maximumTextWidth,
    bodyMetrics.maximumTextWidth,
  );
  const textX = params.normalizedTextPosition
    ? Math.round(
        clamp(
          params.width * clamp(params.normalizedTextPosition.x, 0.1, 0.9),
          safeMarginX + widestTextGroup / 2,
          params.width - safeMarginX - widestTextGroup / 2,
        ),
      )
    : Math.round(params.width / 2);
  const headlineY = blockTop;
  const bodyY = headlineY + headlineMetrics.groupHeight + blockGap;
  const headlineMarkup = buildPlainWhiteText({
    className: "text",
    fontSize: headline.fontSize,
    lineHeight: headline.lineHeight,
    lines: headline.lines,
    x: textX,
    y: headlineY,
  });
  const bodyMarkup = buildPlainWhiteText({
    className: "text",
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    lines: body.lines,
    x: textX,
    y: bodyY,
  });
  const style = `
    .text { fill: ${BODY_TEXT}; font-family: ${TEXT_FONT_FAMILY}; font-weight: ${BODY_FONT_WEIGHT}; letter-spacing: 0; paint-order: stroke fill; stroke: #000000; stroke-linejoin: round; stroke-opacity: 0.72; stroke-width: 3px; }
  `;

  return {
    diagnostics: {
      bubbleShapeStrategy: "plain-white-text-with-shadow",
      fontFamily: TEXT_FONT_FAMILY,
      maxTextWidth,
      whiteBackgroundGroupCount: 0,
    },
    overlay: buildSvgDocument({
      content: `${headlineMarkup}${bodyMarkup}`,
      height: params.height,
      style,
      width: params.width,
    }),
  };
}

async function buildValidatedOverlay(params: {
  format: CarouselFormat;
  height: number;
  normalizedTextPosition?: CarouselNormalizedTextPosition;
  slide: PlannedCarouselSlide;
  width: number;
}) {
  const layers = await buildOverlaySvg(params);

  return {
    diagnostics: layers.diagnostics,
    overlay: layers.overlay,
  };
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
