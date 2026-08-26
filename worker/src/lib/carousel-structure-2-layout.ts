import { CAROUSEL_FIXED_FONT_SIZE } from "./carousel-slide-plan.js";

export const CAROUSEL_STRUCTURE_2_STORY_MAX_LINES = 12;
export const CAROUSEL_STRUCTURE_2_CTA_MAX_LINES = 6;
export const CAROUSEL_STRUCTURE_2_SAFE_X = 72;
export const CAROUSEL_STRUCTURE_2_SAFE_TOP = 84;
export const CAROUSEL_STRUCTURE_2_SAFE_BOTTOM = 92;
export const CAROUSEL_STRUCTURE_2_TEXT_LINE_HEIGHT = Math.round(
  CAROUSEL_FIXED_FONT_SIZE * 1.16,
);
export const CAROUSEL_STRUCTURE_2_TEXT_GROUP_GAP = 46;

export function getCarouselStructure2TextBlockHeight(lineCount: number) {
  if (lineCount <= 0) return 0;

  return lineCount * CAROUSEL_STRUCTURE_2_TEXT_LINE_HEIGHT;
}

export function doesCarouselStructure2TextFitSafeArea(params: {
  ctaLineCount: number;
  height: number;
  storyLineCount: number;
}) {
  const storyHeight = getCarouselStructure2TextBlockHeight(params.storyLineCount);
  const ctaHeight = getCarouselStructure2TextBlockHeight(params.ctaLineCount);
  const requiredHeight =
    storyHeight +
    (ctaHeight > 0 ? CAROUSEL_STRUCTURE_2_TEXT_GROUP_GAP + ctaHeight : 0);
  const availableHeight =
    params.height - CAROUSEL_STRUCTURE_2_SAFE_TOP - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM;

  return requiredHeight <= availableHeight;
}
