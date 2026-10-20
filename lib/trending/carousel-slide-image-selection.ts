import type { MediaAsset } from "../media/types.ts";
import type { TrendingCarouselEditSlide, TrendingCreativeEditContent } from "./creative-edit-contract.ts";

export const CAROUSEL_SLIDE_IMAGE_PROJECT = "trending-carousel-slide";
export const CAROUSEL_SLIDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CAROUSEL_SLIDE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

export function validateCarouselSlideImage(file: { type: string; size: number }) {
  if (!CAROUSEL_SLIDE_IMAGE_TYPES.includes(file.type) || file.size <= 0) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > CAROUSEL_SLIDE_IMAGE_MAX_BYTES) {
    throw new Error("Choose an image up to 25 MB.");
  }
}

// Match the captured slide, rather than whichever slide is selected when an
// asynchronous upload finishes. Functional state updates preserve newer text.
export function applyCarouselSlideImage(
  content: TrendingCreativeEditContent | null,
  slideId: string,
  asset: Pick<MediaAsset, "id" | "url">,
): TrendingCreativeEditContent | null {
  if (content?.format !== "carousel" || !content.slides.some(slide => slide.slideId === slideId)) return content;
  return {
    ...content,
    slides: content.slides.map(slide => slide.slideId === slideId ? {
      ...slide, backgroundAssetId: asset.id, backgroundUrl: asset.url,
      backgroundCrop: "centre", visualRole: slide.originalVisualRole,
    } : slide),
  };
}

export function restoreOriginalCarouselBackground(slide: TrendingCarouselEditSlide): TrendingCarouselEditSlide {
  return {
    ...slide,
    backgroundAssetId: slide.originalBackgroundAssetId,
    backgroundUrl: slide.originalBackgroundUrl,
    backgroundCrop: undefined,
    visualRole: slide.originalVisualRole,
  };
}
