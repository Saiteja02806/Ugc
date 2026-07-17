import { createHash } from "node:crypto";

export const VISIBLE_CAROUSEL_FINGERPRINT_PREFIX = "visible-copy-v1:";

export type VisibleCarouselSlideCopy = {
  ctaText: string | null;
  headline: string;
  slideNumber: number;
  subtext: string | null;
};

export function createVisibleCarouselConceptFingerprint(
  slides: readonly VisibleCarouselSlideCopy[],
) {
  const visibleCopy = [...slides]
    .sort((first, second) => first.slideNumber - second.slideNumber)
    .map((slide) => ({
      ctaText: normalizeVisibleText(slide.ctaText),
      headline: normalizeVisibleText(slide.headline),
      slideNumber: slide.slideNumber,
      subtext: normalizeVisibleText(slide.subtext),
    }));

  const digest = createHash("sha256")
    .update(JSON.stringify(visibleCopy))
    .digest("hex");

  return `${VISIBLE_CAROUSEL_FINGERPRINT_PREFIX}${digest}`;
}

export function isVisibleCarouselConceptFingerprint(value: string | null) {
  return value?.startsWith(VISIBLE_CAROUSEL_FINGERPRINT_PREFIX) ?? false;
}

function normalizeVisibleText(value: string | null) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
