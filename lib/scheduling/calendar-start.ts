import type { ScheduleDraft } from "./types";

// This is a fixed rollout boundary, not a moving "today" value. Posts created
// before it and cancelled posts remain available in history views but never
// enter Calendar/Day view.
export const DEFAULT_SOCIAL_SCHEDULING_CALENDAR_START_AT =
  "2026-08-08T19:11:15.366Z";

export function getSocialSchedulingCalendarStartAt(value?: string | null) {
  const timestamp = value?.trim();

  if (!timestamp) {
    return DEFAULT_SOCIAL_SCHEDULING_CALENDAR_START_AT;
  }

  const parsed = Date.parse(timestamp);

  return Number.isNaN(parsed)
    ? DEFAULT_SOCIAL_SCHEDULING_CALENDAR_START_AT
    : new Date(parsed).toISOString();
}

export function isScheduleDraftVisibleInCalendar(
  draft: Pick<ScheduleDraft, "createdAt" | "scheduledDate" | "status">,
  calendarStartAt: string,
) {
  if (!draft.scheduledDate || draft.status === "cancelled") {
    return false;
  }

  const createdAt = Date.parse(draft.createdAt);
  const startAt = Date.parse(
    getSocialSchedulingCalendarStartAt(calendarStartAt),
  );

  return !Number.isNaN(createdAt) && createdAt >= startAt;
}
