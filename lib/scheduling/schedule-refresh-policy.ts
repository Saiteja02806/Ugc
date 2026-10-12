import type { ScheduledPost } from "./types.ts";

export const ACTIVE_SCHEDULE_POLL_INTERVAL_MS = 5_000;
const ACTIVE_SCHEDULE_LOOKAHEAD_MS = 60_000;
const ACTIVE_SCHEDULE_LOOKBEHIND_MS = 120_000;
const ACTIVE_JOB_TIMEOUT_MS = 5 * 60 * 1_000;
const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1_000;

/** Wake at the next publish window without polling throughout a long wait. */
export function getScheduleRefreshDelay(
  schedules: ScheduledPost[],
  now = Date.now(),
): number | null {
  let nextDelay: number | null = null;

  for (const schedule of schedules) {
    if (schedule.status === "cancelled" || schedule.status === "published") {
      continue;
    }

    if (hasActiveSchedulingWork(schedule, now)) {
      return ACTIVE_SCHEDULE_POLL_INTERVAL_MS;
    }

    for (const target of schedule.targets) {
      const scheduledTime = Date.parse(target.scheduledFor);
      if (target.status !== "scheduled" || !Number.isFinite(scheduledTime)) {
        continue;
      }

      const delay = scheduledTime - ACTIVE_SCHEDULE_LOOKAHEAD_MS - now;
      if (delay > 0) {
        nextDelay = Math.min(nextDelay ?? MAX_REFRESH_DELAY_MS, delay);
      }
    }
  }

  return nextDelay;
}

function hasActiveSchedulingWork(schedule: ScheduledPost, now: number) {
  const isWallText = Boolean(getString(schedule.metadata.wallTextAssignmentId));
  const renderStatus = getString(
    isWallText
      ? schedule.metadata.wallTextRenderStatus
      : schedule.metadata.combinedRenderStatus,
  );
  const renderQueuedAt = Date.parse(
    getString(
      isWallText
        ? schedule.metadata.wallTextRenderQueuedAt
        : schedule.metadata.combinedRenderQueuedAt,
    ) ?? schedule.updatedAt,
  );
  const isRecentRender =
    (renderStatus === "queued" ||
      renderStatus === "rendering" ||
      (isWallText && renderStatus === "not_requested")) &&
    Number.isFinite(renderQueuedAt) &&
    now - renderQueuedAt < ACTIVE_JOB_TIMEOUT_MS;

  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);
  const finalScheduleStartedAt = Date.parse(
    getString(schedule.metadata.finalScheduleQueuedAt) ?? schedule.updatedAt,
  );
  const isRecentFinalize =
    ["draft", "scheduling"].includes(schedule.status) &&
    ["finalizing", "scheduling"].includes(finalScheduleStatus ?? "") &&
    Number.isFinite(finalScheduleStartedAt) &&
    now - finalScheduleStartedAt < ACTIVE_JOB_TIMEOUT_MS;

  const hasDuePublishingTarget = schedule.targets.some((target) => {
    if (target.status === "publishing" || target.status === "scheduling") {
      const targetUpdatedAt = Date.parse(target.updatedAt);
      return (
        Number.isFinite(targetUpdatedAt) &&
        now - targetUpdatedAt < ACTIVE_JOB_TIMEOUT_MS
      );
    }

    const scheduledTime = Date.parse(target.scheduledFor);
    return (
      target.status === "scheduled" &&
      Number.isFinite(scheduledTime) &&
      scheduledTime >= now - ACTIVE_SCHEDULE_LOOKBEHIND_MS &&
      scheduledTime <= now + ACTIVE_SCHEDULE_LOOKAHEAD_MS
    );
  });

  return isRecentRender || isRecentFinalize || hasDuePublishingTarget;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
