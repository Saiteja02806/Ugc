import type { ScheduledPost, ScheduleMediaIssue } from "./types";

const preparedStatuses = new Set(["queued", "rendering", "ready"]);

export function getScheduleMediaIssue(params: {
  activeDemoIds: ReadonlySet<string>;
  activeOpeningIds: ReadonlySet<string>;
  mediaLoaded: boolean;
  schedule: Pick<
    ScheduledPost,
    "mediaAssetId" | "metadata" | "sourceKind" | "status"
  >;
}): ScheduleMediaIssue | null {
  if (!params.mediaLoaded || params.schedule.status !== "draft") {
    return null;
  }

  const preparationStatus = getString(
    params.schedule.metadata.combinedRenderStatus,
  );

  if (preparationStatus && preparedStatuses.has(preparationStatus)) {
    return null;
  }

  const openingId = getString(params.schedule.metadata.hookMediaId);
  const demoId =
    getString(params.schedule.metadata.scheduledVideoId) ??
    getString(params.schedule.metadata.demoMediaId) ??
    params.schedule.mediaAssetId;
  const mediaMode = getString(params.schedule.metadata.mediaMode);
  const isWallTextSchedule = Boolean(
    getString(params.schedule.metadata.wallTextAssignmentId),
  );

  if (
    isWallTextSchedule ||
    params.schedule.sourceKind === "library_item" ||
    mediaMode === "carousel"
  ) {
    return null;
  }

  const singleVideoMode = mediaMode === "single_video";
  const combinedVideoMode = mediaMode === "combined_video" || Boolean(openingId);
  const openingMissing =
    !openingId || !params.activeOpeningIds.has(openingId);
  const demoMissing = !demoId || !params.activeDemoIds.has(demoId);

  if (singleVideoMode || !combinedVideoMode) {
    return demoMissing ? "demo" : null;
  }

  if (openingMissing && demoMissing) {
    return "both";
  }

  if (openingMissing) {
    return "opening";
  }

  if (demoMissing) {
    return "demo";
  }

  return null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
