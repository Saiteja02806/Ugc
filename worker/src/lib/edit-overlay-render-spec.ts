export type EditOverlayRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type EditOverlayStyle = "clean" | "minimal" | "bubble";

export const EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT = 8;
export const EDIT_OVERLAY_VERTICAL_INSET_PERCENT = 12;
export const EDIT_OVERLAY_MAX_TEXT_WIDTH_PERCENT =
  100 - EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT * 2;
export const EDIT_OVERLAY_FONT_FAMILY = "Geist";
export const EDIT_OVERLAY_FONT_WEIGHT = 600;
export const EDIT_OVERLAY_TEXT_COLOR = "#ffffff";
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
  minimal: 64,
};

const styleMinimumFontSizes: Record<EditOverlayStyle, number> = {
  bubble: 38,
  clean: 42,
  minimal: 40,
};

const styleLineSpacing: Record<EditOverlayStyle, number> = {
  bubble: 10,
  clean: 8,
  minimal: 8,
};

const styleAverageCharacterWidthFactor: Record<EditOverlayStyle, number> = {
  bubble: 0.58,
  clean: 0.55,
  minimal: 0.55,
};

const styleBackgroundOpacity: Record<EditOverlayStyle, number | null> = {
  bubble: 0.65,
  clean: null,
  minimal: 0.35,
};

const maxTextHeightPercent: Record<EditOverlayRatio, number> = {
  "9:16": 34,
  "1:1": 34,
  "4:5": 34,
  "16:9": 42,
};

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
  if (style === "clean") {
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
