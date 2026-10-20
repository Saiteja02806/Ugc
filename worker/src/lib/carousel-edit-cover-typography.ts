import { CAROUSEL_HOOK_FONT_SIZE } from "./carousel-text-presentation.ts";

type CarouselEditHookSource = {
  headline: string;
  subtext: string;
  originalHeadline?: string;
  originalSubtext?: string;
  sourceRendererVersion?: string | null;
  slideNumber: number;
};

// Untouched saved slides keep their original bytes. Every intentional cover
// rerender, including an image replacement, adopts the current typography.
export function getCarouselEditHookFontSize(_slide: CarouselEditHookSource): 72 {
  void _slide;
  return CAROUSEL_HOOK_FONT_SIZE;
}
