import viewsRegistry from "./slideshow-reference-views.json" with { type: "json" };

export type SlideshowReferenceViewEntry = {
  viewCount: number;
  formattedViews: string;
};

export type SlideshowReferenceFullEntry = {
  galleryIndex: number;
  id: string;
  title: string;
  category: string;
  slidesCount: number;
  platform: "tiktok" | "internal";
  sourceUrl: string | null;
  sourceKind: string | null;
  coverText: string;
  viewCount: number;
  formattedViews: string;
};

const viewsByReferenceId = viewsRegistry.viewsByReferenceId as Record<string, SlideshowReferenceViewEntry>;

/**
 * Returns the view count entry for a given Slideshow reference ID.
 */
export function getSlideshowReferenceViews(referenceId: string): SlideshowReferenceViewEntry | undefined {
  return viewsByReferenceId[referenceId];
}

/**
 * Returns all view records for Slideshow references.
 */
export function getAllSlideshowReferenceViews(): SlideshowReferenceFullEntry[] {
  return viewsRegistry.items as SlideshowReferenceFullEntry[];
}
