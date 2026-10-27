import assert from "node:assert/strict";
import test from "node:test";
import { deviceUses12HourTime, displayScheduleTime, pickerHour, canonicalPickerHour } from "./time-display.ts";

test("browser locale controls presentation without timezone conversion", () => {
  assert.equal(deviceUses12HourTime("en-US"),true);
  assert.equal(deviceUses12HourTime("en-GB"),false);
  for (const value of ["00:00","09:30","12:00","21:30","23:59"]) {
    const hour=value.slice(0,2),period=Number(hour)>=12?"PM":"AM";
    assert.equal(canonicalPickerHour(pickerHour(hour,true),period,true),hour);
    assert.equal(displayScheduleTime(value,false,"en-US"),value);
  }
  assert.equal(displayScheduleTime("00:00",true,"en-US"),"12:00 AM");
  assert.equal(displayScheduleTime("12:00",true,"en-US"),"12:00 PM");
  assert.equal(displayScheduleTime("21:30",true,"en-US"),"9:30 PM");
  assert.equal(displayScheduleTime("25:00",true,"en-US"),"Choose time");
});
