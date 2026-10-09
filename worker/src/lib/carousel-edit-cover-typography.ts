import { CAROUSEL_HOOK_FONT_SIZE } from "./carousel-text-presentation.ts";

type CarouselEditHookSource = {
  headline: string;
  subtext: string;
  originalHeadline?: string;
  originalSubtext?: string;
  sourceRendererVersion?: string | null;
  slideNumber: number;
};

export function getCarouselEditHookFontSize(slide: CarouselEditHookSource): 72 | 84 {
  const retainsOriginalCopy = slide.originalHeadline !== undefined &&
    slide.originalSubtext !== undefined &&
    slide.headline.trim() === slide.originalHeadline.trim() &&
    slide.subtext.trim() === slide.originalSubtext.trim();
  const hasLegacy72pxCover = slide.sourceRendererVersion ===
    "story-native-tiktok-text-blocks-inter-tight-v11" ||
    slide.sourceRendererVersion === "social-tiktok-text-blocks-inter-tight-v25";

  return slide.slideNumber === 1 && retainsOriginalCopy && hasLegacy72pxCover
    ? 72 : CAROUSEL_HOOK_FONT_SIZE;
}
