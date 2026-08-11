export type EditOverlayRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type EditOverlayStyle = "clean" | "minimal" | "bubble" | "hook";

export const TEXT_COLOR_VALUES = [
  "#ffffff",
  "#fde047",
  "#fb923c",
  "#f472b6",
  "#67e8f9",
  "#86efac",
] as const;

export type TextColor = (typeof TEXT_COLOR_VALUES)[number];

export const DEFAULT_TEXT_COLOR: TextColor = "#ffffff";

export function isTextColor(value: unknown): value is TextColor {
  return TEXT_COLOR_VALUES.some((color) => color === value);
}

export function resolveTextColor(value: unknown): TextColor {
  return isTextColor(value) ? value : DEFAULT_TEXT_COLOR;
}

export function parseTextColor(value: unknown, fieldName: string): TextColor {
  if (value === undefined || value === null) {
    return DEFAULT_TEXT_COLOR;
  }

  if (!isTextColor(value)) {
    throw new Error(`${fieldName} is not a supported text color.`);
  }

  return value;
}

export type EditOverlayTextLayout = {
  backgroundColor: string | undefined;
  backgroundOpacity: number | null;
  bounds: {
    canvasHeight: number;
    canvasWidth: number;
    containerHeight: number;
    containerWidth: number;
    containerX: number;
    contentMaxWidth: number;
    maxContainerHeight: number;
    maxContainerWidth: number;
    textHeight: number;
    textWidth: number;
  };
  estimatedLineWidths: number[];
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  isTruncated: boolean;
  lineHeight: number;
  lines: string[];
  lineSpacing: number;
  padding: number;
  textColor: string;
  textShadow: string;
};

export const EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT = 8;
export const EDIT_OVERLAY_VERTICAL_INSET_PERCENT = 12;
export const EDIT_OVERLAY_MAX_TEXT_WIDTH_PERCENT =
  100 - EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT * 2;
export const EDIT_OVERLAY_FONT_FAMILY = "Geist";
export const EDIT_OVERLAY_FONT_WEIGHT = 600;
export const EDIT_OVERLAY_TEXT_COLOR = DEFAULT_TEXT_COLOR;
export const EDIT_OVERLAY_SHADOW_COLOR = "rgba(0, 0, 0, 0.45)";
export const EDIT_OVERLAY_FFMPEG_SHADOW_COLOR = "black@0.45";
export const EDIT_OVERLAY_SHADOW_OFFSET_PX = 2;

export const EDIT_OVERLAY_OUTPUT_DIMENSIONS: Record<
  EditOverlayRatio,
  { height: number; width: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
};

const styleFontSizes: Record<EditOverlayStyle, number> = {
  bubble: 62,
  clean: 68,
  hook: 60,
  minimal: 64,
};

const styleMinimumFontSizes: Record<EditOverlayStyle, number> = {
  bubble: 38,
  clean: 42,
  hook: 34,
  minimal: 40,
};

const styleLineSpacing: Record<EditOverlayStyle, number> = {
  bubble: 22,
  clean: 24,
  hook: 14,
  minimal: 22,
};

const styleAverageCharacterWidthFactor: Record<EditOverlayStyle, number> = {
  bubble: 0.58,
  clean: 0.55,
  hook: 0.54,
  minimal: 0.55,
};

const styleBackgroundOpacity: Record<EditOverlayStyle, number | null> = {
  bubble: 0.65,
  clean: null,
  hook: null,
  minimal: 0.35,
};

const maxTextHeightPercent: Record<EditOverlayRatio, number> = {
  "9:16": 34,
  "1:1": 34,
  "4:5": 34,
  "16:9": 42,
};

// Leaves a small safety margin around the real Geist glyph advances so text
// never grazes a style background or the 8% composition safe area.
const EDIT_OVERLAY_WIDTH_SAFETY_FACTOR = 1.1;

export function getEditOverlayOutputDimensions(ratio: EditOverlayRatio) {
  return EDIT_OVERLAY_OUTPUT_DIMENSIONS[ratio];
}

export function getEditOverlayBackgroundOpacity(style: EditOverlayStyle) {
  return styleBackgroundOpacity[style];
}

export function getEditOverlayBackgroundColor(style: EditOverlayStyle) {
  const opacity = getEditOverlayBackgroundOpacity(style);

  return opacity === null ? undefined : `rgba(0, 0, 0, ${opacity})`;
}

export function getEditOverlayTextShadow() {
  return `${EDIT_OVERLAY_SHADOW_OFFSET_PX}px ${EDIT_OVERLAY_SHADOW_OFFSET_PX}px 0 ${EDIT_OVERLAY_SHADOW_COLOR}`;
}

export function getEditOverlayPaddingForFontSize(
  style: EditOverlayStyle,
  fontSize: number,
) {
  if (style === "clean" || style === "hook") {
    return 0;
  }

  return style === "bubble"
    ? Math.max(18, Math.round(fontSize * 0.45))
    : Math.max(12, Math.round(fontSize * 0.3));
}

export function getEditOverlayRenderMetrics(
  style: EditOverlayStyle,
  ratio: EditOverlayRatio,
) {
  const fontSize = styleFontSizes[style];
  const lineSpacing = styleLineSpacing[style];
  const padding = getEditOverlayPaddingForFontSize(style, fontSize);
  const outputDimensions = getEditOverlayOutputDimensions(ratio);

  return {
    averageCharacterWidthFactor: styleAverageCharacterWidthFactor[style],
    backgroundColor: getEditOverlayBackgroundColor(style),
    backgroundOpacity: getEditOverlayBackgroundOpacity(style),
    fontFamily: EDIT_OVERLAY_FONT_FAMILY,
    fontSize,
    fontSizeContainerWidthPercent: (fontSize / outputDimensions.width) * 100,
    fontWeight: EDIT_OVERLAY_FONT_WEIGHT,
    lineHeight: (fontSize + lineSpacing) / fontSize,
    lineSpacing,
    maxTextHeightPercent: maxTextHeightPercent[ratio],
    maxTextWidthPercent: EDIT_OVERLAY_MAX_TEXT_WIDTH_PERCENT,
    minFontSize: styleMinimumFontSizes[style],
    padding,
    paddingContainerWidthPercent: (padding / outputDimensions.width) * 100,
    textColor: EDIT_OVERLAY_TEXT_COLOR,
    textShadow: getEditOverlayTextShadow(),
  };
}

/**
 * Produces the pixel geometry shared by previews and the final render.
 *
 * The 84% width is the outside edge of the overlay container. Padding is
 * deducted before wrapping, so bubble and minimal text can never use the same
 * width and then grow past the safe area when their background is added.
 */
export function buildEditOverlayTextLayout(
  text: string,
  style: EditOverlayStyle,
  ratio: EditOverlayRatio,
  textColor?: unknown,
): EditOverlayTextLayout {
  const metrics = getEditOverlayRenderMetrics(style, ratio);
  const { height: canvasHeight, width: canvasWidth } =
    getEditOverlayOutputDimensions(ratio);
  const maxContainerWidth = Math.round(
    canvasWidth * (metrics.maxTextWidthPercent / 100),
  );
  const maxContainerHeight = Math.round(
    canvasHeight * (metrics.maxTextHeightPercent / 100),
  );
  const requestedManualLineCount = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n").length;
  let fallback: EditOverlayTextLayout | null = null;

  for (
    let fontSize = metrics.fontSize;
    fontSize >= metrics.minFontSize;
    fontSize -= 2
  ) {
    const layout = buildLayoutAtFontSize({
      canvasHeight,
      canvasWidth,
      fontSize,
      maxContainerHeight,
      maxContainerWidth,
      ratio,
      style,
      text,
    });
    layout.textColor = resolveTextColor(textColor);
    fallback = layout;

    if (
      layout.bounds.containerHeight <= maxContainerHeight &&
      (style !== "hook" ||
        layout.lines.length === requestedManualLineCount)
    ) {
      return layout;
    }
  }

  const overflowLayout =
    fallback ??
    buildLayoutAtFontSize({
      canvasHeight,
      canvasWidth,
      fontSize: metrics.minFontSize,
      maxContainerHeight,
      maxContainerWidth,
      ratio,
      style,
      text,
    });

  overflowLayout.textColor = resolveTextColor(textColor);

  return truncateEditOverlayLayoutToHeight(overflowLayout);
}

export function buildResolvedEditOverlayTextLayout(params: {
  fontSize: number;
  lines: readonly string[];
  ratio: EditOverlayRatio;
  style: EditOverlayStyle;
  textColor?: unknown;
}): EditOverlayTextLayout {
  const metrics = getEditOverlayRenderMetrics(params.style, params.ratio);
  const normalizedLines = params.lines
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);

  if (
    normalizedLines.length < 1 ||
    (params.style === "hook" && normalizedLines.length > 3) ||
    !Number.isInteger(params.fontSize) ||
    params.fontSize < metrics.minFontSize ||
    params.fontSize > metrics.fontSize ||
    params.fontSize % 2 !== 0
  ) {
    throw new Error("The saved text layout is outside the supported limits.");
  }

  const { height: canvasHeight, width: canvasWidth } =
    getEditOverlayOutputDimensions(params.ratio);
  const maxContainerWidth = Math.round(
    canvasWidth * (metrics.maxTextWidthPercent / 100),
  );
  const maxContainerHeight = Math.round(
    canvasHeight * (metrics.maxTextHeightPercent / 100),
  );
  const layout = buildLayoutAtFontSize({
    canvasHeight,
    canvasWidth,
    fontSize: params.fontSize,
    maxContainerHeight,
    maxContainerWidth,
    ratio: params.ratio,
    style: params.style,
    text: normalizedLines.join("\n"),
  });
  layout.textColor = resolveTextColor(params.textColor);

  if (
    layout.isTruncated ||
    layout.bounds.containerHeight > maxContainerHeight ||
    layout.lines.length !== normalizedLines.length ||
    layout.lines.some((line, index) => line !== normalizedLines[index])
  ) {
    throw new Error(
      "The saved text lines do not fit the saved font size without wrapping.",
    );
  }

  return layout;
}

function buildLayoutAtFontSize(params: {
  canvasHeight: number;
  canvasWidth: number;
  fontSize: number;
  maxContainerHeight: number;
  maxContainerWidth: number;
  ratio: EditOverlayRatio;
  style: EditOverlayStyle;
  text: string;
}): EditOverlayTextLayout {
  const metrics = getEditOverlayRenderMetrics(params.style, params.ratio);
  const padding = getEditOverlayPaddingForFontSize(
    params.style,
    params.fontSize,
  );
  const contentMaxWidth = Math.max(
    1,
    params.maxContainerWidth - padding * 2,
  );
  const lineSpacing = Math.max(
    1,
    Math.round(
      metrics.lineSpacing * (params.fontSize / metrics.fontSize),
    ),
  );
  const lineHeight = params.fontSize + lineSpacing;
  const lines = wrapTextToWidth(params.text, params.fontSize, contentMaxWidth);
  const estimatedLineWidths = lines.map((line) =>
    Math.min(
      contentMaxWidth,
      Math.ceil(estimateEditOverlayLineWidth(line, params.fontSize)),
    ),
  );
  const textWidth = Math.max(0, ...estimatedLineWidths);
  const textHeight =
    lines.length * params.fontSize +
    Math.max(0, lines.length - 1) * lineSpacing;
  const containerWidth = Math.min(
    params.maxContainerWidth,
    textWidth + padding * 2,
  );
  const containerHeight = textHeight + padding * 2;

  return {
    backgroundColor: metrics.backgroundColor,
    backgroundOpacity: metrics.backgroundOpacity,
    bounds: {
      canvasHeight: params.canvasHeight,
      canvasWidth: params.canvasWidth,
      containerHeight,
      containerWidth,
      containerX: Math.round((params.canvasWidth - containerWidth) / 2),
      contentMaxWidth,
      maxContainerHeight: params.maxContainerHeight,
      maxContainerWidth: params.maxContainerWidth,
      textHeight,
      textWidth,
    },
    estimatedLineWidths,
    fontFamily: metrics.fontFamily,
    fontSize: params.fontSize,
    fontWeight: metrics.fontWeight,
    isTruncated: false,
    lineHeight,
    lines,
    lineSpacing,
    padding,
    textColor: metrics.textColor,
    textShadow: metrics.textShadow,
  };
}

function truncateEditOverlayLayoutToHeight(
  layout: EditOverlayTextLayout,
): EditOverlayTextLayout {
  if (layout.bounds.containerHeight <= layout.bounds.maxContainerHeight) {
    return layout;
  }

  const availableTextHeight = Math.max(
    layout.fontSize,
    layout.bounds.maxContainerHeight - layout.padding * 2,
  );
  const maxLineCount = Math.max(
    1,
    Math.floor(
      (availableTextHeight + layout.lineSpacing) / layout.lineHeight,
    ),
  );
  const lines = layout.lines.slice(0, maxLineCount);
  const lastLineIndex = lines.length - 1;

  lines[lastLineIndex] = appendEllipsisWithinWidth(
    lines[lastLineIndex] ?? "",
    layout.fontSize,
    layout.bounds.contentMaxWidth,
  );

  const estimatedLineWidths = lines.map((line) =>
    Math.min(
      layout.bounds.contentMaxWidth,
      Math.ceil(estimateEditOverlayLineWidth(line, layout.fontSize)),
    ),
  );
  const textWidth = Math.max(0, ...estimatedLineWidths);
  const textHeight =
    lines.length * layout.fontSize +
    Math.max(0, lines.length - 1) * layout.lineSpacing;
  const containerWidth = Math.min(
    layout.bounds.maxContainerWidth,
    textWidth + layout.padding * 2,
  );

  return {
    ...layout,
    bounds: {
      ...layout.bounds,
      containerHeight: textHeight + layout.padding * 2,
      containerWidth,
      containerX: Math.round(
        (layout.bounds.canvasWidth - containerWidth) / 2,
      ),
      textHeight,
      textWidth,
    },
    estimatedLineWidths,
    isTruncated: true,
    lines,
  };
}

function appendEllipsisWithinWidth(
  line: string,
  fontSize: number,
  maxWidth: number,
) {
  const characters = Array.from(line.trimEnd());

  while (
    characters.length > 0 &&
    estimateEditOverlayLineWidth(`${characters.join("")}…`, fontSize) >
      maxWidth
  ) {
    characters.pop();
  }

  return `${characters.join("")}…`;
}

function wrapTextToWidth(
  text: string,
  fontSize: number,
  maxWidth: number,
) {
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const manualLines = normalizedText ? normalizedText.split("\n") : [""];

  return manualLines.flatMap((line) =>
    wrapManualLineToWidth(line, fontSize, maxWidth),
  );
}

function wrapManualLineToWidth(
  line: string,
  fontSize: number,
  maxWidth: number,
) {
  const normalizedLine = line.replace(/[^\S\n]+/g, " ").trim();

  if (!normalizedLine) {
    return [""];
  }

  const words = normalizedLine
    .split(" ")
    .flatMap((word) => splitLongWordToWidth(word, fontSize, maxWidth));
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (estimateEditOverlayLineWidth(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [normalizedLine];
}

function splitLongWordToWidth(
  word: string,
  fontSize: number,
  maxWidth: number,
) {
  if (estimateEditOverlayLineWidth(word, fontSize) <= maxWidth) {
    return [word];
  }

  const chunks: string[] = [];
  let chunk = "";

  for (const character of Array.from(word)) {
    const candidate = `${chunk}${character}`;

    if (
      chunk &&
      estimateEditOverlayLineWidth(candidate, fontSize) > maxWidth
    ) {
      chunks.push(chunk);
      chunk = character;
      continue;
    }

    chunk = candidate;
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : [word];
}

/**
 * A deterministic, conservative approximation of Geist SemiBold advance
 * widths. Both renderers use it for the same wrapping and container geometry,
 * while drawing the natural font glyphs without horizontal distortion.
 */
export function estimateEditOverlayLineWidth(
  text: string,
  fontSize: number,
) {
  let emWidth = 0;

  for (const character of Array.from(text)) {
    emWidth += getCharacterWidthInEm(character);
  }

  return emWidth * fontSize * EDIT_OVERLAY_WIDTH_SAFETY_FACTOR;
}

function getCharacterWidthInEm(character: string) {
  if (character === " ") {
    return 0.26;
  }

  if (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      character,
    ) ||
    /\p{Extended_Pictographic}/u.test(character)
  ) {
    return 1;
  }

  if (/^[ilI1|]$/.test(character)) {
    return 0.27;
  }

  if (/^[.,'`:;!]$/.test(character)) {
    return 0.25;
  }

  if (/^[fjrt()\[\]{}]$/.test(character)) {
    return 0.38;
  }

  if (/^[mw]$/.test(character)) {
    return 0.76;
  }

  if (/^[MW@%&]$/.test(character)) {
    return 0.82;
  }

  if (/^[A-Z]$/.test(character)) {
    return 0.62;
  }

  if (/^[0-9]$/.test(character)) {
    return 0.56;
  }

  if (/^[\-–—_+<>=/?\\]$/.test(character)) {
    return 0.46;
  }

  if (/^[a-z]$/.test(character)) {
    return 0.52;
  }

  return character.length > 1 ? 1 : 0.62;
}
