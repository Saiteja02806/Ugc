import assert from "node:assert/strict";
import test from "node:test";
import { assertExploreSubtitleScope, EXPLORE_SUBTITLE_MAX_DURATION_MS, EXPLORE_SUBTITLE_SCOPE_LABEL } from "./explore-policy.js";

test("the approved scope is English and 60 seconds, not the former 30-second pilot", () => {
  assert.equal(EXPLORE_SUBTITLE_MAX_DURATION_MS, 60_000);
  assert.equal(EXPLORE_SUBTITLE_SCOPE_LABEL, "English · up to 60 seconds total");
  for (const ms of [1, 30_001, 59_999, 60_000]) assert.doesNotThrow(() => assertExploreSubtitleScope("en", ms));
});

test("other languages and unknown or overlong durations fail closed without coercion", () => {
  for (const language of ["hi", "fr", "English", "EN", null, undefined]) {
    assert.throws(() => assertExploreSubtitleScope(language, 60_000), { code: "SUBTITLE_LANGUAGE_UNSUPPORTED" });
  }
  for (const ms of [null, undefined, "60000", 0, -1, NaN, Infinity, 60_001, 120_000]) {
    assert.throws(() => assertExploreSubtitleScope("en", ms), { code: "SUBTITLE_DURATION_UNSUPPORTED" });
  }
});

test("the limit applies to the complete sequence and never reduces its duration", () => {
  const parts = Object.freeze([15_000, 45_000]);
  assert.doesNotThrow(() => assertExploreSubtitleScope("en", parts.reduce((a, b) => a + b)));
  const overlong = Object.freeze([15_000, 45_001]);
  assert.throws(() => assertExploreSubtitleScope("en", overlong.reduce((a, b) => a + b)), /nothing is trimmed automatically/);
  assert.deepEqual(overlong, [15_000, 45_001]);
});
