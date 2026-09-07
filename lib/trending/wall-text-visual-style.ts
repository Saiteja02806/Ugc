import type { TrendingWallTextContent, WallTextFontSize } from "./wall-text-types.ts";

export const WALL_TEXT_FONT_WEIGHT = 700;
export const WALL_TEXT_FONT_FAMILY = "Arial";
export const WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT = 700;
export const WALL_TEXT_AVENIR_NEXT_DEMI_BOLD_FONT_WEIGHT = 600;
export const WALL_TEXT_ARIAL_REGULAR_FONT_WEIGHT = 400;
export const LEGACY_WALL_TEXT_FONT_FAMILY = "Inter";
export const LEGACY_WALL_TEXT_REGULAR_FONT_WEIGHT = 400;
export const LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT = 500;
export const LEGACY_WALL_TEXT_FONT_WEIGHT = 700;
export const WALL_TEXT_LINE_HEIGHT_FACTOR = 1.1;
// New layouts wrap at this size; they never shrink to keep fewer lines.
export const WALL_TEXT_FIXED_FONT_SIZE = 50;
export const WALL_TEXT_MAXIMUM_FONT_SIZE = 52;
export const WALL_TEXT_MINIMUM_FONT_SIZE = 44;
// V7 keeps the supplied Arial Bold face but lightens its edge treatment for
// bright footage. V6 stays at 4px so already-rendered cards do not change.
export const WALL_TEXT_OUTLINE_WIDTH = 3;
export const WALL_TEXT_PREVIOUS_ARIAL_BOLD_OUTLINE_WIDTH = 4;
// The V5 Avenir treatment uses a 2px stroke. The supplied reference uses a
// stronger outlined Arial treatment, so V6 and prior Arial/Inter layouts use
// the standard 4px outline.
export const WALL_TEXT_AVENIR_NEXT_DEMI_BOLD_OUTLINE_WIDTH = 2;
export const WALL_TEXT_SHADOW_OPACITY = 0.3;
export const WALL_TEXT_LEGACY_SHADOW_OPACITY = 0.45;
export const WALL_TEXT_SECTION_GAP = 18;
// The text box is the outer placement rectangle. Keep a real visual gap
// inside it so rendered glyphs, outline, and shadow never touch its edges.
// At the 780px production box this leaves a 750px inner writing area.
export const WALL_TEXT_INLINE_SAFE_PADDING = 15;
// A wider reading column prevents already-measured lines from being visually
// rewrapped into two- or three-word rows on the 9:16 canvas.
export const WALL_TEXT_TEXT_WIDTH = 780;

const ARIAL_BOLD_TYPOGRAPHY = {
  fontFamily:
    "var(--font-wall-text-arial-bold), Arial, 'Helvetica Neue', sans-serif",
  fontWeight: WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT,
} as const;

const AVENIR_NEXT_TYPOGRAPHY = {
  fontFamily:
    "var(--font-wall-text-avenir-next), 'Avenir Next', 'Helvetica Neue', sans-serif",
  fontWeight: WALL_TEXT_AVENIR_NEXT_DEMI_BOLD_FONT_WEIGHT,
} as const;

export function getWallTextSafeLineWidth(textBoxWidth: number) {
  return Math.max(0, textBoxWidth - WALL_TEXT_INLINE_SAFE_PADDING * 2);
}

export function getWallTextOutlineWidth(content: TrendingWallTextContent) {
  if (content.finalLayout?.version === "wall-text-final-layout-v7") {
    return WALL_TEXT_OUTLINE_WIDTH;
  }
  if (content.finalLayout?.version === "wall-text-final-layout-v5") {
    return WALL_TEXT_AVENIR_NEXT_DEMI_BOLD_OUTLINE_WIDTH;
  }
  return WALL_TEXT_PREVIOUS_ARIAL_BOLD_OUTLINE_WIDTH;
}

export function getWallTextShadowOpacity(content: TrendingWallTextContent) {
  return content.finalLayout?.version === "wall-text-final-layout-v7"
    ? WALL_TEXT_SHADOW_OPACITY
    : WALL_TEXT_LEGACY_SHADOW_OPACITY;
}

export function getWallTextFontSize(content: TrendingWallTextContent): WallTextFontSize {
  const declaredSize = Number(
    content.renderFontSize ?? content.finalLayout?.fontSizePx,
  );
  if (
    declaredSize === 36 ||
    declaredSize === 38 ||
    declaredSize === 40 ||
    declaredSize === 42 ||
    declaredSize === 44 ||
    declaredSize === 46 ||
    declaredSize === 48 ||
    declaredSize === 50 ||
    declaredSize === 52
  ) {
    return declaredSize;
  }
  const wordCount = content.fullText.split(/\s+/u).filter(Boolean).length;
  const lineCount = (content.finalLayout?.blocks ?? content.segments).reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  if (wordCount <= 18 && lineCount <= 5) {
    return WALL_TEXT_MAXIMUM_FONT_SIZE;
  }

  if (wordCount <= 21 && lineCount <= 6) {
    return 48;
  }

  if (wordCount <= 23) {
    return 46;
  }

  return WALL_TEXT_MINIMUM_FONT_SIZE;
}

export function getWallTextTypography(content: TrendingWallTextContent) {
  if (content.finalLayout?.version === "wall-text-final-layout-v6" ||
      content.finalLayout?.version === "wall-text-final-layout-v7") {
    return ARIAL_BOLD_TYPOGRAPHY;
  }

  if (content.finalLayout?.version === "wall-text-final-layout-v5") {
    return AVENIR_NEXT_TYPOGRAPHY;
  }

  if (content.finalLayout?.version === "wall-text-final-layout-v3") {
    return {
      fontFamily:
        "var(--font-wall-text-arial), Arial, 'Helvetica Neue', sans-serif",
      fontWeight: LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT,
    } as const;
  }

  if (content.finalLayout?.version === "wall-text-final-layout-v4") {
    return {
      fontFamily:
        "var(--font-wall-text-arial-regular), Arial, 'Helvetica Neue', sans-serif",
      fontWeight: WALL_TEXT_ARIAL_REGULAR_FONT_WEIGHT,
    } as const;
  }

  return {
    fontFamily:
      `var(--font-wall-text-inter), ${LEGACY_WALL_TEXT_FONT_FAMILY}, Arial, 'Helvetica Neue', sans-serif`,
    fontWeight: LEGACY_WALL_TEXT_REGULAR_FONT_WEIGHT,
  } as const;
}

export function getWallTextEditorTypography(content: TrendingWallTextContent) {
  // Typing invalidates measured lines, not the intended visual treatment.
  // Keep the draft at the typography that the save-time layout engine uses,
  // including when editing an older card. Never fabricate a finalLayout:
  // the temporary paragraph still needs browser wrapping until it is saved.
  if (!content.finalLayout) {
    return {
      ...ARIAL_BOLD_TYPOGRAPHY,
      fontSize: WALL_TEXT_FIXED_FONT_SIZE,
      outlineWidth: WALL_TEXT_OUTLINE_WIDTH,
      shadowOpacity: WALL_TEXT_SHADOW_OPACITY,
    };
  }

  return {
    ...getWallTextTypography(content),
    fontSize: getWallTextFontSize(content),
    outlineWidth: getWallTextOutlineWidth(content),
    shadowOpacity: getWallTextShadowOpacity(content),
  };
}
