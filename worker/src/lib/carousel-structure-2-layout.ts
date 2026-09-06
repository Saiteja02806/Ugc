import { CAROUSEL_FIXED_FONT_SIZE } from "./carousel-slide-plan.js";

export const CAROUSEL_STRUCTURE_2_STORY_MAX_LINES = 12;
export const CAROUSEL_STRUCTURE_2_COVER_MAX_LINES = 3;
export const CAROUSEL_STRUCTURE_2_CTA_MAX_LINES = 6;
export const CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE = 60;
export const CAROUSEL_STRUCTURE_2_SAFE_X = 72;
export const CAROUSEL_STRUCTURE_2_SAFE_TOP = 84;
export const CAROUSEL_STRUCTURE_2_SAFE_BOTTOM = 92;
export const CAROUSEL_STRUCTURE_2_TEXT_LINE_HEIGHT = Math.round(
  CAROUSEL_FIXED_FONT_SIZE * 1.16,
);
export const CAROUSEL_STRUCTURE_2_TEXT_GROUP_GAP = 46;

export function getCarouselStructure2StoryFontSize(slideNumber: number) {
  return slideNumber === 1
    ? CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE
    : CAROUSEL_FIXED_FONT_SIZE;
}

export function getCarouselStructure2StoryMaxLines(slideNumber: number) {
  return slideNumber === 1
    ? CAROUSEL_STRUCTURE_2_COVER_MAX_LINES
    : CAROUSEL_STRUCTURE_2_STORY_MAX_LINES;
}

export function getCarouselStructure2TextLineHeight(fontSize: number) {
  return Math.round(fontSize * 1.16);
}

export function getCarouselStructure2TextBlockHeight(
  lineCount: number,
  fontSize = CAROUSEL_FIXED_FONT_SIZE,
) {
  if (lineCount <= 0) return 0;

  return lineCount * getCarouselStructure2TextLineHeight(fontSize);
}

export function doesCarouselStructure2TextFitSafeArea(params: {
  ctaLineCount: number;
  ctaFontSize?: number;
  height: number;
  storyLineCount: number;
  storyFontSize?: number;
}) {
  const storyHeight = getCarouselStructure2TextBlockHeight(
    params.storyLineCount,
    params.storyFontSize,
  );
  const ctaHeight = getCarouselStructure2TextBlockHeight(
    params.ctaLineCount,
    params.ctaFontSize,
  );
  const requiredHeight =
    storyHeight +
    (ctaHeight > 0 ? CAROUSEL_STRUCTURE_2_TEXT_GROUP_GAP + ctaHeight : 0);
  const availableHeight =
    params.height - CAROUSEL_STRUCTURE_2_SAFE_TOP - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM;

  return requiredHeight <= availableHeight;
}
