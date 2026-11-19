import { filterReferences, orderReferenceGallery, type RecreateReference } from "./recreate-types.ts";
import { sortReferenceViews } from "./video-reference-feed.ts";

export const PUBLIC_REFERENCE_LIMIT = 12;
/** Guests browse only a small taste; signed-in free accounts see the full catalog behind their upgrade gate. */
export const PUBLIC_GUEST_REFERENCE_LIMIT = 4;
export const PUBLIC_REFERENCE_WORKFLOWS = ["hook", "talking_head", "wall_text", "slideshow"] as const;
export type PublicReferenceWorkflow = typeof PUBLIC_REFERENCE_WORKFLOWS[number];

/** Exact discovery routes only; editors, saved work and nested routes stay private. */
export function publicReferenceWorkflow(pathname: string): PublicReferenceWorkflow | null {
  switch (pathname.replace(/\/$/, "")) {
    case "/explore/hook-video": return "hook";
    case "/explore/create-hook": return "talking_head";
    case "/explore/wall-of-text": return "wall_text";
    case "/explore/slideshows": return "slideshow";
    default: return null;
  }
}

/** Fixed server-selected preview: no pagination/filter inputs can rotate its membership. */
export function publicReferencePreview(items: readonly RecreateReference[], workflow: PublicReferenceWorkflow): RecreateReference[] {
  const format = workflow === "talking_head" ? "hook" : workflow;
  const active = filterReferences(items, format, []).filter(item => !item.creatorAccountId);
  const ordered = format === "hook" ? sortReferenceViews(active) : orderReferenceGallery(active, format);
  return ordered.slice(0, PUBLIC_REFERENCE_LIMIT).map(item => ({
    id: item.id, title: item.title, format: item.format, category: item.category, categoryLabel: item.categoryLabel,
    posterUrl: item.posterUrl, videoUrl: item.videoUrl, previewVideoUrl: item.previewVideoUrl,
    ...(item.hookPreviewVideoUrl ? { hookPreviewVideoUrl: item.hookPreviewVideoUrl } : {}),
    durationSeconds: item.durationSeconds, isNew: item.isNew,
    sourceUrl: item.sourceUrl, instagramUrl: item.instagramUrl, sourcePlatform: item.sourcePlatform, sourceKind: item.sourceKind,
    viewCount: item.viewCount, formattedViews: item.formattedViews, viewsRetrievedAt: item.viewsRetrievedAt,
    viewsSource: item.viewsSource, viewsApproximate: item.viewsApproximate,
    slides: item.slides.map(slide => ({ id: slide.id, url: slide.url, width: slide.width, height: slide.height })),
  }));
}
