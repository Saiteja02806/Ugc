import type {
  ScheduledPostStatus,
  ScheduledPostTargetStatus,
} from "@/lib/scheduling/types";

type SchedulePublishOutcome = {
  status: ScheduledPostStatus;
  targets: Array<{
    socialConnectionId: string;
    status: ScheduledPostTargetStatus;
  }>;
};

const failedPostStatuses = new Set<ScheduledPostStatus>([
  "failed",
  "partially_failed",
]);
const failedTargetStatuses = new Set<ScheduledPostTargetStatus>([
  "action_required",
  "cancelled",
  "failed",
  "skipped",
]);

export function getSchedulePublishFailureMessage(
  schedule: SchedulePublishOutcome,
  requestedConnectionIds: string[],
) {
  const requestedIds = [...new Set(requestedConnectionIds.filter(Boolean))];
  const returnedConnectionIds = new Set(
    schedule.targets.map((target) => target.socialConnectionId),
  );
  const missingConnectionIds = requestedIds.filter(
    (connectionId) => !returnedConnectionIds.has(connectionId),
  );
  const failedConnectionIds = schedule.targets
    .filter((target) => failedTargetStatuses.has(target.status))
    .map((target) => target.socialConnectionId);

  if (
    !failedPostStatuses.has(schedule.status) &&
    failedConnectionIds.length === 0 &&
    missingConnectionIds.length === 0
  ) {
    return null;
  }

  const affectedCount = new Set([
    ...failedConnectionIds,
    ...missingConnectionIds,
  ]).size;

  if (schedule.status === "partially_failed") {
    return affectedCount > 0
      ? `${affectedCount} selected ${affectedCount === 1 ? "account" : "accounts"} could not be scheduled.`
      : "Some selected accounts could not be scheduled.";
  }

  const failedAccountCount = affectedCount || Math.max(1, requestedIds.length);

  return failedAccountCount > 1
    ? `${failedAccountCount} selected accounts could not be scheduled.`
    : "The selected account could not be scheduled.";
}
