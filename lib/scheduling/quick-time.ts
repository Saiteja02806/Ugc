import { getZonedDateTimeParts } from "./schedule-time.ts";
/** Resolve at the explicit click, rounded up to the minute supported by the form. */
export function quickScheduleTime(hours: 1 | 3, timezone: string, now = Date.now()) {
  return getZonedDateTimeParts(Math.ceil((now + hours * 60 * 60_000) / 60_000) * 60_000, timezone);
}

export type QuickTimePreset = 5 | 60 | 180 | "tomorrow";
export function quickSchedulePreset(preset: QuickTimePreset, timezone: string, now = Date.now()) {
  if (preset !== "tomorrow") return getZonedDateTimeParts(Math.ceil((now + preset * 60_000) / 60_000) * 60_000, timezone);
  const today = getZonedDateTimeParts(now, timezone).date;
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return { date: date.toISOString().slice(0, 10), time: "09:00" };
}
