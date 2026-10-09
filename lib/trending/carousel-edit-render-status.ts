import type { TrendingCreativeEditRecord } from "./creative-edit-contract";

export function getCarouselEditRenderStatus(
  edit: Pick<TrendingCreativeEditRecord, "renderState" | "renderError" | "refreshError"> | null,
) {
  if (!edit) return null;
  if (edit.renderState === "ready") {
    return { label: "Edited", tone: "ready" as const, message: null };
  }
  if (edit.renderState === "queued" || edit.renderState === "rendering") {
    return { label: edit.refreshError ? "Checking update" : "Updating", tone: "pending" as const,
      message: edit.refreshError ? "Could not check this update. Retrying automatically." : null };
  }
  const textDoesNotFit = /text.*(?:could not fit|does not fit)|text groups do not fit/i.test(edit.renderError ?? "");
  return {
    label: edit.renderState === "draft" ? "Not rendered" : "Update failed",
    tone: "failed" as const,
    message: textDoesNotFit
      ? "The text does not fit. Open Edit, shorten it, and save again."
      : "Could not update this slideshow. Open Edit and save again.",
  };
}

export function getLatestTrendingEdit(
  live: TrendingCreativeEditRecord | undefined,
  reviewed: TrendingCreativeEditRecord | null | undefined,
): TrendingCreativeEditRecord | null {
  if (!live) return reviewed ?? null;
  return !reviewed || shouldApplyCarouselEditRefresh(reviewed, live) ? live : reviewed;
}

export function shouldApplyCarouselEditRefresh(
  previous: Pick<TrendingCreativeEditRecord, "revision" | "updatedAt"> | undefined,
  refreshed: Pick<TrendingCreativeEditRecord, "revision" | "updatedAt">,
) {
  if (!previous) return true;
  if (refreshed.revision !== previous.revision) return refreshed.revision > previous.revision;
  return !previous.updatedAt || !refreshed.updatedAt ||
    Date.parse(refreshed.updatedAt) >= Date.parse(previous.updatedAt);
}
