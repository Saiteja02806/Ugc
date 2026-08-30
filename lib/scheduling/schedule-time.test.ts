import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS,
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  parseSchedulingTaskCreationBufferSeconds,
  parseSocialSchedulingMinimumLeadMinutes,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
  validateSchedulingTaskCreationBuffer,
} from "./schedule-time.ts";

test("converts an India wall-clock time to UTC", () => {
  assert.equal(
    resolveZonedDateTime({
      date: "2026-07-20",
      time: "15:03",
      timeZone: "Asia/Calcutta",
    }),
    "2026-07-20T09:33:00.000Z",
  );
});

test("uses the selected timezone instead of the device timezone", () => {
  assert.equal(
    resolveZonedDateTime({
      date: "2026-07-20",
      time: "09:00",
      timeZone: "America/New_York",
    }),
    "2026-07-20T13:00:00.000Z",
  );
});

test("applies seasonal New York offsets", () => {
  assert.equal(
    resolveZonedDateTime({
      date: "2026-01-20",
      time: "09:00",
      timeZone: "America/New_York",
    }),
    "2026-01-20T14:00:00.000Z",
  );
  assert.equal(
    resolveZonedDateTime({
      date: "2026-07-20",
      time: "09:00",
      timeZone: "America/New_York",
    }),
    "2026-07-20T13:00:00.000Z",
  );
});

test("rejects a local time skipped by spring daylight-saving transition", () => {
  assert.throws(
    () =>
      resolveZonedDateTime({
        date: "2026-03-08",
        time: "02:30",
        timeZone: "America/New_York",
      }),
    (error) =>
      error instanceof ScheduleTimeError &&
      error.code === "nonexistent_local_time",
  );
});

test("rejects a local time repeated by fall daylight-saving transition", () => {
  assert.throws(
    () =>
      resolveZonedDateTime({
        date: "2026-11-01",
        time: "01:30",
        timeZone: "America/New_York",
      }),
    (error) =>
      error instanceof ScheduleTimeError && error.code === "ambiguous_local_time",
  );
});

test("rejects unknown timezones", () => {
  assert.throws(
    () =>
      resolveZonedDateTime({
        date: "2026-07-20",
        time: "09:00",
        timeZone: "Mars/Olympus_Mons",
      }),
    (error) =>
      error instanceof ScheduleTimeError && error.code === "invalid_timezone",
  );
});

test("reconstructs calendar values in the schedule timezone", () => {
  assert.deepEqual(
    getZonedDateTimeParts(
      "2026-07-20T01:00:00.000Z",
      "America/Los_Angeles",
    ),
    {
      date: "2026-07-19",
      time: "18:00",
    },
  );
});

test("uses a full five-minute social scheduling lead on whole-minute slots", () => {
  const now = Date.UTC(2026, 6, 20, 12, 0, 20);

  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 5,
      now,
      scheduledFor: Date.UTC(2026, 6, 20, 12, 4, 0),
    }).valid,
    false,
  );
  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 5,
      now,
      scheduledFor: Date.UTC(2026, 6, 20, 12, 5, 0),
    }).valid,
    false,
  );
  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 5,
      now,
      scheduledFor: Date.UTC(2026, 6, 20, 12, 6, 0),
    }).valid,
    true,
  );
});

test("returns an arbitrary-minute earliest slot without quarter-hour rounding", () => {
  const now = Date.UTC(2026, 6, 20, 12, 2, 41);

  assert.equal(
    getEarliestScheduleTimestamp({ minimumLeadMinutes: 5, now }),
    Date.UTC(2026, 6, 20, 12, 8, 0),
  );
});

test("allows a short exact-task creation buffer after lead validation", () => {
  const now = Date.UTC(2026, 6, 20, 12, 4, 20);

  assert.equal(
    validateSchedulingTaskCreationBuffer({
      minimumBufferSeconds: 30,
      now,
      scheduledFor: Date.UTC(2026, 6, 20, 12, 4, 49),
    }).valid,
    false,
  );
  assert.equal(
    validateSchedulingTaskCreationBuffer({
      minimumBufferSeconds: 30,
      now,
      scheduledFor: Date.UTC(2026, 6, 20, 12, 4, 50),
    }).valid,
    true,
  );
});

test("uses safe configurable scheduling defaults", () => {
  assert.equal(parseSocialSchedulingMinimumLeadMinutes("5"), 5);
  assert.equal(
    parseSocialSchedulingMinimumLeadMinutes("0"),
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  assert.equal(parseSchedulingTaskCreationBufferSeconds("45"), 45);
  assert.equal(
    parseSchedulingTaskCreationBufferSeconds("not-a-number"),
    DEFAULT_SCHEDULING_TASK_CREATION_BUFFER_SECONDS,
  );
});
