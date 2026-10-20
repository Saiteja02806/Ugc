import { usesRemovedCarouselImage } from "./removed-carousel-images.ts";
import type { TrendingCreativeEditRecord } from "./creative-edit-contract";
import type { TrendingCarouselCreative, TrendingCarouselFeedItem, TrendingCarouselSlide, TrendingHookVideoFeedItem, TrendingWallTextFeedItem, TrendingReactionFeedItem } from "./feed-items";

export type ReviewedTrendingCandidate = (
  | { format: "carousel"; item: TrendingCarouselFeedItem; carousel: TrendingCarouselCreative; slides: (TrendingCarouselSlide & { renderedUrl: string })[] }
  | { format: "hook_video"; item: TrendingHookVideoFeedItem }
  | { format: "wall_text"; item: TrendingWallTextFeedItem }
  | { format: "reaction"; item: TrendingReactionFeedItem }
) & { reviewedEdit?: TrendingCreativeEditRecord | null };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string");
}
function slides(value: unknown): value is (TrendingCarouselSlide & { renderedUrl: string })[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 10 && value.every(slide => record(slide) &&
    typeof slide.headline === "string" && typeof slide.renderedUrl === "string" &&
    Number.isInteger(slide.slideNumber) && slide.status === "ready");
}

/** Cached previews are untrusted input, never authorization for an edit or decision. */
export function isRecoverableTrendingReview(value: unknown): value is ReviewedTrendingCandidate {
  if (!record(value) || !record(value.item)) return false;
  const item = value.item;
  if (value.format !== item.format || ![item.id, item.assignmentId, item.creativeId, item.feedItemId].every(id => typeof id === "string" && id.length > 0) ||
    item.readiness !== "preview_ready" || !record(item.creative)) return false;
  const creative = item.creative;
  if (item.format === "carousel" && usesRemovedCarouselImage(value)) return false;
  if (value.reviewedEdit != null) {
    const edit = value.reviewedEdit;
    if (!record(edit) || edit.assignmentId !== item.assignmentId || edit.creativeId !== item.creativeId || edit.format !== item.format ||
      !record(edit.content) || edit.content.format !== item.format || edit.content.version !== "trending-creative-edit-v1") return false;
    if (edit.format === "carousel" && !Array.isArray(edit.content.slides)) return false;
    if (edit.format === "hook_video" && (!strings(edit.content.lines) || typeof edit.content.hookText !== "string")) return false;
    if (edit.format === "wall_text" && (!record(edit.content.content) || !record(edit.content.layout))) return false;
    if (edit.source != null && (!record(edit.source) || typeof edit.source.resolvedAssetUrl !== "string")) return false;
    if (edit.renderOutput != null && (!record(edit.renderOutput) || (edit.format === "carousel" && !Array.isArray(edit.renderOutput.slides)))) return false;
  }
  if (item.format === "carousel") return record(value.carousel) && typeof value.carousel.carouselId === "string" &&
    value.carousel.status === "completed" && slides(value.slides) && slides(value.carousel.slides) &&
    creative.carouselId === value.carousel.carouselId && value.slides.length === value.carousel.slideCount;
  if (item.format === "reaction") return typeof creative.previewUrl === "string" && typeof creative.caption === "string" && typeof creative.title === "string";
  if (item.format === "hook_video") return record(creative.text) && strings(creative.text.lines) && typeof creative.text.value === "string" &&
    typeof creative.previewSessionEndpoint === "string" && creative.previewSessionEndpoint.startsWith("/api/") &&
    typeof creative.videoId === "string" && typeof creative.title === "string";
  if (item.format === "wall_text") return typeof creative.previewUrl === "string" && typeof creative.title === "string" &&
    record(creative.text) && typeof creative.text.fullText === "string" && Array.isArray(creative.text.segments) &&
    creative.text.segments.every(segment => record(segment) && strings(segment.lines)) &&
    record(creative.layout) && record(creative.layout.textBox) && record(creative.layout.safeArea) && record(creative.audio);
  return false;
}
