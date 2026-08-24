import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";

export function getPersistedCarouselSlideCopy(slide: PlannedCarouselSlide) {
  const headline =
    slide.headline ??
    slide.body ??
    slide.listItems[0] ??
    slide.ctaText;

  if (!headline) {
    throw new Error(
      `Carousel slide ${slide.slideNumber} has no AI-authored visible copy to persist.`,
    );
  }

  const subtext =
    normalizeVisibleCopy(headline) === normalizeVisibleCopy(slide.subtext)
      ? null
      : slide.subtext;

  return { headline, subtext };
}

function normalizeVisibleCopy(value: string | null) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
