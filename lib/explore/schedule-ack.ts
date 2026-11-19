import type { ScheduleCreateInput, ScheduledPost } from "../scheduling/types";

/**
 * Detailed, honest feedback for a schedule row whose stored details differ from
 * the local request record (the UGC-SCH-20261110-SCHEDULE-VERIFY-MISMATCH
 * family). Verification still refuses to bind or archive such a row; the error
 * only explains WHICH details differ, so "Try again" is no longer a hard loop.
 * Rows already scheduled, publishing, or published are additionally flagged so
 * the panels can treat them as a success context and release the composer for
 * the next post instead of dead-ending.
 */
export const ALREADY_SCHEDULED_ACK_STATUSES: readonly ScheduledPost["status"][] = [
  "scheduled", "publishing", "published",
];

export function joinScheduleAckMismatch(mismatches: readonly string[]): string {
  if (mismatches.length === 0) return "its saved details";
  if (mismatches.length === 1) return mismatches[0]!;
  return `${mismatches.slice(0, -1).join(", ")} and ${mismatches[mismatches.length - 1]}`;
}

export class ScheduleAckMismatchError extends Error {
  readonly mismatches: readonly string[];
  readonly alreadyScheduled: boolean;

  constructor(mismatches: readonly string[], alreadyScheduled: boolean) {
    const labels = joinScheduleAckMismatch(mismatches);
    super(alreadyScheduled
      ? `Your post was already scheduled. Saved details differ from this request (changed: ${labels}). You can schedule your current choices as another post, and review the earlier one in Scheduling.`
      : `The saved schedule details do not match your confirmation (changed: ${labels}). Your request is kept; Try again checks the same post.`);
    this.name = "ScheduleAckMismatchError";
    this.mismatches = mismatches;
    this.alreadyScheduled = alreadyScheduled;
  }
}

export function isScheduleAckMismatch(error: unknown): error is ScheduleAckMismatchError {
  return error instanceof ScheduleAckMismatchError;
}

/**
 * Compare only fields the server row actually carries; schedule list rows in
 * tests and older reconcile endpoints may omit caption/title/time fields, and
 * an absent field must not be reported as "changed".
 */
export function describeScheduleAckMismatch(
  requested: ScheduleCreateInput,
  schedule: Pick<ScheduledPost, "targets"> & Partial<Pick<ScheduledPost, "caption" | "title" | "timezone" | "scheduledFor">>,
): string[] {
  const mismatches: string[] = [];
  if (schedule.caption !== undefined && schedule.caption !== requested.caption?.trim()) mismatches.push("caption");
  if (schedule.title !== undefined && requested.title?.trim() && schedule.title !== requested.title.trim()) mismatches.push("title");
  if (schedule.timezone !== undefined && schedule.timezone !== requested.timezone?.trim()) mismatches.push("time zone");
  const requestedTime = requested.scheduledFor ? Date.parse(requested.scheduledFor) : null;
  const scheduledFor = schedule.scheduledFor === undefined ? null : schedule.scheduledFor;
  const scheduledTime = scheduledFor ? Date.parse(scheduledFor) : null;
  if (requestedTime !== null && Number.isFinite(requestedTime) &&
      (scheduledTime === null || !Number.isFinite(scheduledTime) || scheduledTime !== requestedTime))
    mismatches.push("posting time");
  const requestedTargets = requested.targets ?? [];
  const serverTargets = Array.isArray(schedule.targets) ? schedule.targets : [];
  if (serverTargets.length !== requestedTargets.length ||
      requestedTargets.some(requestedTarget => !serverTargets.some(serverTarget =>
        serverTarget.socialConnectionId === requestedTarget.connectionId && serverTarget.platform === requestedTarget.platform)))
    mismatches.push("posting accounts");
  return mismatches;
}
