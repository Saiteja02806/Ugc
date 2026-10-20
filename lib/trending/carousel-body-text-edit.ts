import { createCarouselManualLayout, resolveCarouselManualTextStyle, type CarouselManualTextStyle } from "@/lib/carousel/manual-text";
import type { TrendingCarouselEditContent, TrendingCarouselEditSlide } from "./creative-edit-contract";

export type CarouselTextEditScope = "body" | "slide";

/** Copy only changed styling fields. Copy and media always belong to one slide;
 * the cover is never part of a body-style update. */
export function applyCarouselBodyTextEdit(content: TrendingCarouselEditContent, next: TrendingCarouselEditSlide, scope: CarouselTextEditScope, copyWholeStyle = false): TrendingCarouselEditContent {
  const previous = content.slides.find(slide => slide.slideId === next.slideId);
  if (!previous) return content;
  const before = resolveCarouselManualTextStyle(previous);
  const after = resolveCarouselManualTextStyle(next);
  const individual = before.bodyStyleMode === "individual" || scope === "slide";
  const shared = scope === "body" && previous.slideNumber !== 1 && (copyWholeStyle || !individual);
  const stylePatch = Object.fromEntries((Object.keys(after) as (keyof CarouselManualTextStyle)[])
    .filter(key => key !== "bodyStyleMode" && (copyWholeStyle || before[key] !== after[key])).map(key => [key, after[key]]));
  const moved = copyWholeStyle || previous.textPosition.x !== next.textPosition.x || previous.textPosition.y !== next.textPosition.y;
  const reset = previous.textStyle != null && next.textStyle === null;
  return { ...content, slides: content.slides.map(slide => {
    if (slide.slideId === next.slideId) return next.slideNumber !== 1 && next.textStyle && (moved || copyWholeStyle || Object.keys(stylePatch).length)
      ? { ...next, textStyle: { ...next.textStyle, bodyStyleMode: individual ? "individual" : "shared" } } : next;
    if (!shared || slide.slideNumber === 1 || slide.textStyle && resolveCarouselManualTextStyle(slide).bodyStyleMode === "individual" || !moved && !reset && !Object.keys(stylePatch).length) return slide;
    return { ...slide,
      textStyle: reset ? null : { ...resolveCarouselManualTextStyle(slide), ...stylePatch, bodyStyleMode: "shared" },
      textPosition: moved ? { ...next.textPosition } : slide.textPosition,
    };
  }) };
}

export function getCarouselTextOverflowSlides(content: TrendingCarouselEditContent) {
  return content.slides.filter(slide => slide.textStyle && !createCarouselManualLayout(slide).fits);
}
