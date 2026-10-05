import {
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  validateTimeZone,
} from "./schedule-time";

export function getBrowserTimeZone(
  resolve = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  try {
    return validateTimeZone(resolve());
  } catch {
    return "UTC";
  }
}

export function getSchedulingTimeZoneOptions(current: string) {
  const zones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Los_Angeles", "America/New_York", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Europe/London"];
  return Array.from(new Set([current, "UTC", ...zones])).sort();
}

export function getDefaultAccountScheduleSlot({
  selectedDate,
  minimumLeadMinutes,
  now = Date.now(),
  timezone = getBrowserTimeZone(),
}: {
  selectedDate: string;
  minimumLeadMinutes: number;
  now?: number;
  timezone?: string;
}) {
  const currentDate = getZonedDateTimeParts(now, timezone).date;
  const earliest = getZonedDateTimeParts(
    getEarliestScheduleTimestamp({ minimumLeadMinutes, now }),
    timezone,
  );
  return {
    date: selectedDate === currentDate ? earliest.date : selectedDate,
    time: earliest.time,
  };
}
