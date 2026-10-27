import assert from "node:assert/strict";
import test from "node:test";
import { quickScheduleTime, quickSchedulePreset } from "./quick-time.ts";
import { resolveZonedDateTime } from "./schedule-time.ts";

test("quick times resolve from click instant across midnight in the selected timezone", () => {
  const now=Date.parse("2026-10-26T17:55:20Z");
  assert.deepEqual(quickScheduleTime(1,"Asia/Calcutta",now),{date:"2026-10-27",time:"00:26"});
  assert.deepEqual(quickScheduleTime(3,"Asia/Calcutta",now),{date:"2026-10-27",time:"02:26"});
  assert.deepEqual(quickScheduleTime(1,"UTC",now),{date:"2026-10-26",time:"18:56"});
  const dst=quickScheduleTime(3,"America/New_York",Date.parse("2026-03-08T06:00:00Z"));
  assert.equal(resolveZonedDateTime({...dst,timeZone:"America/New_York"}),"2026-03-08T09:00:00.000Z");
  assert.throws(()=>quickScheduleTime(1,"Unknown/Zone",now));
});


test("four presets include5minutes and tomorrow9am in the selected local calendar", () => {
  const now=Date.parse("2026-10-26T20:00:20Z");
  assert.deepEqual(quickSchedulePreset(5,"Asia/Calcutta",now),{date:"2026-10-27",time:"01:36"});
  assert.deepEqual(quickSchedulePreset(60,"UTC",now),quickScheduleTime(1,"UTC",now));
  assert.deepEqual(quickSchedulePreset(180,"UTC",now),quickScheduleTime(3,"UTC",now));
  assert.deepEqual(quickSchedulePreset("tomorrow","Asia/Calcutta",now),{date:"2026-10-28",time:"09:00"});
  assert.deepEqual(quickSchedulePreset("tomorrow","America/Los_Angeles",now),{date:"2026-10-27",time:"09:00"});
  assert.deepEqual(quickSchedulePreset("tomorrow","UTC",Date.parse("2026-12-31T23:00Z")),{date:"2027-01-01",time:"09:00"});
});
