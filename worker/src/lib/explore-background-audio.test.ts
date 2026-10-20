import assert from "node:assert/strict";
import test from "node:test";
import { planExploreBackgroundAudio } from "./explore-background-audio.js";

test("longer background audio is fitted without changing the requested video duration", () => {
  const timing = planExploreBackgroundAudio(180_000, 20_000);
  assert.equal(timing.fit, "trim");
  assert.equal(timing.repeat, false);
  assert.equal(timing.audibleDurationMs, 20_000);
  assert.equal(timing.sourceDurationMs, 180_000);
  assert.equal(timing.targetDurationMs, 20_000);
  assert.equal(timing.fadeDurationMs, 200);
});

test("short uploaded recordings play once by default; repetition requires an explicit choice", () => {
  const once = planExploreBackgroundAudio(10_000, 20_000);
  assert.equal(once.fit, "pad");
  assert.equal(once.repeat, false);
  assert.equal(once.audibleDurationMs, 10_000);
  const repeat = planExploreBackgroundAudio(10_000, 20_000, "repeat");
  assert.equal(repeat.fit, "loop");
  assert.equal(repeat.repeat, true);
  assert.equal(repeat.audibleDurationMs, 20_000);
});

test("exact and longer music do not need repetition even when repeat is chosen", () => {
  assert.equal(planExploreBackgroundAudio(20_000, 20_000, "repeat").fit, "exact");
  assert.equal(planExploreBackgroundAudio(30_000, 20_000, "repeat").fit, "trim");
  assert.equal(planExploreBackgroundAudio(30_000, 20_000, "repeat").repeat, false);
});

test("very short added audio receives bounded non-overlapping endpoint fades", () => {
  const timing = planExploreBackgroundAudio(100, 1000);
  assert.equal(timing.fadeDurationMs, 50);
  assert.equal(timing.audibleDurationMs, 100);
});

test("invalid duration and playback choices fail closed", () => {
  for (const invalid of [0, -1, NaN, Infinity, 600_000.001]) assert.throws(() => planExploreBackgroundAudio(invalid, 1000), { code: "COMPOSITION_AUDIO_INVALID" });
  for (const invalid of [0, -1, NaN, Infinity, 240_000.001]) assert.throws(() => planExploreBackgroundAudio(1000, invalid), { code: "COMPOSITION_AUDIO_INVALID" });
  assert.throws(() => planExploreBackgroundAudio(1000, 2000, "auto" as "once"), { code: "COMPOSITION_AUDIO_INVALID" });
  assert.equal(planExploreBackgroundAudio(600_000, 240_000).fit, "trim");
});
