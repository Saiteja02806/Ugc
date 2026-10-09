import assert from "node:assert/strict";
import test from "node:test";
import { getBrowserTimeZone, getSchedulingTimeZoneOptions } from "./account-timezone.ts";
import { getZonedDateTimeParts, resolveZonedDateTime } from "./schedule-time.ts";

test("detects each browser region without a shared India default", () => {
  for (const zone of ["America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Sydney"]) {
    assert.equal(getBrowserTimeZone(() => zone), zone);
    assert.ok(getSchedulingTimeZoneOptions(zone).includes(zone));
  }
  assert.equal(getBrowserTimeZone(() => { throw new Error("unavailable"); }), "UTC");
  assert.equal(getBrowserTimeZone(() => "not-a-zone"), "UTC");
});

test("six pm stays six pm in each selected region, including fractional offsets", () => {
  for (const [zone, expected] of [
    ["Asia/Kolkata", "2026-10-03T12:30:00.000Z"],
    ["Asia/Calcutta", "2026-10-03T12:30:00.000Z"],
    ["Asia/Kathmandu", "2026-10-03T12:15:00.000Z"],
    ["America/New_York", "2026-10-03T22:00:00.000Z"],
    ["Europe/London", "2026-10-03T17:00:00.000Z"],
    ["Asia/Tokyo", "2026-10-03T09:00:00.000Z"],
    ["Australia/Sydney", "2026-10-03T08:00:00.000Z"],
    ["Pacific/Chatham", "2026-10-03T04:15:00.000Z"],
  ]) {
    const instant = resolveZonedDateTime({ date: "2026-10-03", time: "18:00", timeZone: zone });
    assert.equal(instant, expected, zone);
    assert.deepEqual(getZonedDateTimeParts(instant, zone), { date: "2026-10-03", time: "18:00" });
  }
});

test("offers regions outside the previous small selector list", () => {
  const options = getSchedulingTimeZoneOptions("Asia/Calcutta");
  assert.ok(options.includes("Asia/Calcutta"));
  assert.ok(options.includes("Asia/Tokyo"));
  assert.equal(new Set(options).size, options.length);
});
