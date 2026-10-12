import type { TrendingCarouselEditStatus, TrendingCreativeEditRecord } from "./creative-edit-contract";
import { shouldApplyCarouselEditRefresh } from "./carousel-edit-render-status.ts";

function sameScope(previous: TrendingCreativeEditRecord, next: TrendingCarouselEditStatus | TrendingCreativeEditRecord) {
  return next.format === "carousel" && next.assignmentId === previous.assignmentId &&
    next.creativeId === previous.creativeId;
}

/** Keep the last preview while pending. Only a full, current record can make
 * an edit ready for display/scheduling; a status response alone cannot. */
export async function refreshTrendingCarouselEdit(
  previous: TrendingCreativeEditRecord,
  loadStatus: () => Promise<TrendingCarouselEditStatus>,
  loadFinished: () => Promise<TrendingCreativeEditRecord>,
): Promise<TrendingCreativeEditRecord> {
  if (previous.format !== "carousel" || !["queued", "rendering"].includes(previous.renderState)) return previous;
  try {
    const status = await loadStatus();
    if (!sameScope(previous, status)) throw new Error("Update scope changed.");
    if (!shouldApplyCarouselEditRefresh(previous, status)) return previous;
    // Save writes draft before attaching its render job. Keep retrying through
    // that interval instead of adopting a state that would stop pending polls.
    if (status.renderState === "draft") throw new Error("The update is still being queued.");
    if (status.renderState === "ready" || status.revision > previous.revision) {
      const finished = await loadFinished();
      if (!sameScope(previous, finished) || !shouldApplyCarouselEditRefresh(status, finished)) {
        throw new Error("The finished update is not available yet.");
      }
      if (finished.renderState === "draft") throw new Error("The update is still being queued.");
      if (status.renderState === "ready" && finished.revision === status.revision && finished.renderState !== "ready") {
        throw new Error("The finished update is not available yet.");
      }
      if (finished.renderState === "ready" && (finished.content.format !== "carousel" ||
          !finished.content.slides.length || finished.content.slides.some(slide =>
            !finished.renderOutput?.slides.some(output => output.slideNumber === slide.slideNumber && output.renderedUrl)))) {
        throw new Error("The finished slides are not available yet.");
      }
      return { ...finished, refreshError: null };
    }
    return { ...previous, ...status, refreshError: null };
  } catch {
    return { ...previous, refreshError: "Refresh unavailable" };
  }
}
