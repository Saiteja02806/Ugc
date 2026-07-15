import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  getZonedDateTimeParts,
  parseMinimumRenderLeadMinutes,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
} from "./schedule-time.ts";

test("converts an India wall-clock time to UTC", () => {
  assert.equal(
    resolveZonedDateTime({
      date: "2026-07-20",
      time: "09:00",
      timeZone: "Asia/Calcutta",
    }),
    "2026-07-20T03:30:00.000Z",
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

test("accepts the exact minimum render lead boundary", () => {
  const now = Date.UTC(2026, 6, 20, 12, 0, 0);

  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 15,
      now,
      scheduledFor: now + 15 * 60_000,
    }).valid,
    true,
  );
  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 15,
      now,
      scheduledFor: now + 15 * 60_000 - 1,
    }).valid,
    false,
  );
});

test("detects when rendering consumes the remaining lead time", () => {
  const submittedAt = Date.UTC(2026, 6, 20, 12, 0, 0);
  const scheduledFor = submittedAt + 30 * 60_000;

  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 15,
      now: submittedAt,
      scheduledFor,
    }).valid,
    true,
  );
  assert.equal(
    validateScheduleLeadTime({
      minimumLeadMinutes: 15,
      now: submittedAt + 20 * 60_000,
      scheduledFor,
    }).valid,
    false,
  );
});

test("uses a safe configurable render lead", () => {
  assert.equal(parseMinimumRenderLeadMinutes("30"), 30);
  assert.equal(
    parseMinimumRenderLeadMinutes("0"),
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  );
  assert.equal(
    parseMinimumRenderLeadMinutes("not-a-number"),
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  );
});
