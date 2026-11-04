import viewsRegistry from "./slideshow-reference-views.json" with { type: "json" };

export type SlideshowReferenceViewEntry = {
  viewCount: number;
  formattedViews: string;
  verifiedLive?: boolean;
  sourceUrl?: string;
};

export type SlideshowReferenceFullEntry = {
  id: string;
  title: string;
  category?: string;
  slidesCount?: number;
  sourceUrl: string | null;
  viewCount: number;
  formattedViews: string;
  status: string;
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
