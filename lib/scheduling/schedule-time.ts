const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;
const SECONDS_PER_DAY = MINUTES_PER_DAY * 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const OFFSET_SAMPLE_WINDOW_HOURS = 48;
const OFFSET_SAMPLE_STEP_HOURS = 6;

export const DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES = 5;
export const DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS = 30;
export const SOCIAL_SCHEDULING_TIME_STEP_SECONDS = 60;

export type ScheduleTimeErrorCode =
  | "ambiguous_local_time"
  | "invalid_date"
  | "invalid_instant"
  | "invalid_time"
  | "invalid_timezone"
  | "nonexistent_local_time";

export class ScheduleTimeError extends Error {
  readonly code: ScheduleTimeErrorCode;

  constructor(message: string, code: ScheduleTimeErrorCode) {
    super(message);
    this.code = code;
    this.name = "ScheduleTimeError";
  }
}

export type ZonedDateTimeParts = {
  date: string;
  time: string;
};

export function resolveZonedDateTime(params: {
  date: string;
  time: string;
  timeZone: string;
}) {
  const desired = parseLocalDateTime(params.date, params.time);
  const timeZone = validateTimeZone(params.timeZone);
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  const offsets = collectNearbyOffsets(desiredAsUtc, timeZone);
  const matches = Array.from(offsets)
    .map((offset) => desiredAsUtc - offset)
    .filter((candidate) =>
      localPartsMatch(getZonedParts(candidate, timeZone), desired),
    )
    .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index)
    .sort((first, second) => first - second);

  if (matches.length === 0) {
    throw new ScheduleTimeError(
      `That time does not exist in ${timeZone} because the clocks move forward. Choose another time.`,
      "nonexistent_local_time",
    );
  }

  if (matches.length > 1) {
    throw new ScheduleTimeError(
      `That time happens twice in ${timeZone} because the clocks move back. Choose another time.`,
      "ambiguous_local_time",
    );
  }

  return new Date(matches[0]).toISOString();
}

export function getZonedDateTimeParts(
  instant: string | number | Date,
  timeZone: string,
): ZonedDateTimeParts {
  const timestamp = getTimestamp(instant);
  const normalizedTimeZone = validateTimeZone(timeZone);
  const parts = getZonedParts(timestamp, normalizedTimeZone);

  return {
    date: `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export function validateScheduleLeadTime(params: {
  minimumLeadMinutes: number;
  now?: number;
  scheduledFor: string | number | Date;
}) {
  const scheduledTimestamp = getTimestamp(params.scheduledFor);
  const minimumLeadMinutes = normalizeLeadMinutes(params.minimumLeadMinutes);
  const now = params.now ?? Date.now();
  const currentMinuteTimestamp = getCurrentMinuteTimestamp(now);
  const earliestTimestamp = getEarliestScheduleTimestamp({
    minimumLeadMinutes,
    now,
  });

  return {
    currentMinuteTimestamp,
    earliestTimestamp,
    minimumLeadMinutes,
    remainingMilliseconds: scheduledTimestamp - now,
    valid: scheduledTimestamp >= earliestTimestamp,
  };
}

export function getEarliestScheduleTimestamp(params: {
  minimumLeadMinutes: number;
  now?: number;
}) {
  const minimumLeadMinutes = normalizeLeadMinutes(params.minimumLeadMinutes);
  const now = params.now ?? Date.now();

  // Schedule times are whole minutes, but the promised lead is elapsed time.
  // Round the result up after adding the lead so a request at 12:00:45 with a
  // five-minute lead is never assigned 12:05 (only 4m15s away).
  return Math.ceil(
    (now + minimumLeadMinutes * MILLISECONDS_PER_MINUTE) /
      MILLISECONDS_PER_MINUTE,
  ) * MILLISECONDS_PER_MINUTE;
}

export function validateSchedulingTaskCreationBuffer(params: {
  minimumBufferSeconds: number;
  now?: number;
  scheduledFor: string | number | Date;
}) {
  const scheduledTimestamp = getTimestamp(params.scheduledFor);
  const minimumBufferSeconds = normalizeBufferSeconds(
    params.minimumBufferSeconds,
  );
  const now = params.now ?? Date.now();
  const earliestTimestamp = now + minimumBufferSeconds * 1_000;

  return {
    earliestTimestamp,
    minimumBufferSeconds,
    remainingMilliseconds: scheduledTimestamp - now,
    valid: scheduledTimestamp >= earliestTimestamp,
  };
}

export function parseSocialSchedulingMinimumLeadMinutes(
  value: string | null | undefined,
) {
  if (!value?.trim()) {
    return DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MINUTES_PER_DAY
    ? parsed
    : DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES;
}

export function parseSchedulingTaskCreationBufferSeconds(
  value: string | null | undefined,
) {
  if (!value?.trim()) {
    return DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= SECONDS_PER_DAY
    ? parsed
    : DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS;
}

export function validateTimeZone(value: string) {
  const timeZone = value.trim();

  if (!timeZone || timeZone.length > 100) {
    throw new ScheduleTimeError("Choose a valid timezone.", "invalid_timezone");
  }

  try {
    getFormatter(timeZone).format(0);
  } catch {
    throw new ScheduleTimeError("Choose a valid timezone.", "invalid_timezone");
  }

  return timeZone;
}

function parseLocalDateTime(date: string, time: string) {
  const dateMatch = DATE_PATTERN.exec(date);

  if (!dateMatch) {
    throw new ScheduleTimeError("Choose a valid schedule date.", "invalid_date");
  }

  const timeMatch = TIME_PATTERN.exec(time);

  if (!timeMatch) {
    throw new ScheduleTimeError("Choose a valid schedule time.", "invalid_time");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1970 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    throw new ScheduleTimeError("Choose a valid schedule date.", "invalid_date");
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ScheduleTimeError("Choose a valid schedule time.", "invalid_time");
  }

  return { day, hour, minute, month, year };
}

function collectNearbyOffsets(timestamp: number, timeZone: string) {
  const offsets = new Set<number>();

  for (
    let hourOffset = -OFFSET_SAMPLE_WINDOW_HOURS;
    hourOffset <= OFFSET_SAMPLE_WINDOW_HOURS;
    hourOffset += OFFSET_SAMPLE_STEP_HOURS
  ) {
    const sample = timestamp + hourOffset * 60 * 60 * 1000;
    const parts = getZonedParts(sample, timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const sampleAtMinutePrecision = Math.floor(sample / 60_000) * 60_000;

    offsets.add(localAsUtc - sampleAtMinutePrecision);
  }

  return offsets;
}

function getTimestamp(value: string | number | Date) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new ScheduleTimeError(
      "Choose a valid schedule date and time.",
      "invalid_instant",
    );
  }

  return timestamp;
}

function normalizeLeadMinutes(value: number) {
  return Number.isFinite(value) && value >= 1
    ? Math.ceil(value)
    : DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES;
}

function getCurrentMinuteTimestamp(value: number) {
  return Math.floor(value / MILLISECONDS_PER_MINUTE) *
    MILLISECONDS_PER_MINUTE;
}

function normalizeBufferSeconds(value: number) {
  return Number.isFinite(value) && value >= 1
    ? Math.ceil(value)
    : DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS;
}

type NumericDateTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
};

function getZonedParts(timestamp: number, timeZone: string): NumericDateTimeParts {
  const values = new Map(
    getFormatter(timeZone)
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );

  return {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    year: Number(values.get("year")),
  };
}

function localPartsMatch(
  actual: NumericDateTimeParts,
  expected: NumericDateTimeParts,
) {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute
  );
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const existing = formatterCache.get(timeZone);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}
