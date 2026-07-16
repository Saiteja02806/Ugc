import type { ScheduledPost } from "./types.ts";

const activeRenderStatuses = new Set(["queued", "rendering"]);
const activeFinalScheduleStatuses = new Set(["finalizing", "scheduling"]);

export function getScheduleEditBlockReason(schedule: ScheduledPost) {
  if (schedule.status !== "draft" || schedule.targets.length > 0) {
    return "Only a draft without platform publishing jobs can be edited.";
  }

  const renderStatus = getMetadataString(
    schedule.metadata.combinedRenderStatus,
  );

  if (renderStatus && activeRenderStatuses.has(renderStatus)) {
    return "Wait for the current video render to finish before editing.";
  }

  const finalScheduleStatus = getMetadataString(
    schedule.metadata.finalScheduleStatus,
  );

  if (
    finalScheduleStatus &&
    activeFinalScheduleStatuses.has(finalScheduleStatus)
  ) {
    return "Wait for platform scheduling to finish before editing.";
  }

  return null;
}

export function canEditSchedule(schedule: ScheduledPost) {
  return getScheduleEditBlockReason(schedule) === null;
}

export function canCancelSchedule(schedule: ScheduledPost) {
  if (
    schedule.status === "cancelled" ||
    schedule.status === "published" ||
    schedule.status === "publishing"
  ) {
    return false;
  }

  return !schedule.targets.some(
    (target) =>
      target.status === "publishing" || target.status === "published",
  );
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
