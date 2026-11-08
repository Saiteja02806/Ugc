import assert from "node:assert/strict";
import test from "node:test";
import { buildExploreCompositionFilter } from "./explore-video-composition.ts";

const videos = [
  { width: 1080, height: 1920, durationMs: 4000, videoIndex: 0, audioIndex: null },
  { width: 1080, height: 1920, durationMs: 6000, videoIndex: 1, audioIndex: null },
];

test("whole-video background music keeps the existing zero-offset mix", () => {
  const filter = buildExploreCompositionFilter(videos, undefined, {
    backgroundMusic: { inputIndex: 2, audioIndex: 0, durationMs: 10000, playback: "once", volume: .2 },
  });
  assert.match(filter, /volume=0\.2/);
  assert.doesNotMatch(filter, /adelay/);
  assert.match(filter, /atrim=duration=10/);
});

test("demo-only background music starts at the demo and uses the selected volume", () => {
  const filter = buildExploreCompositionFilter(videos, undefined, {
    backgroundMusic: { inputIndex: 2, audioIndex: 0, durationMs: 10000, playback: "once", volume: .35, startMs: 4000, targetDurationMs: 6000 },
  });
  assert.match(filter, /volume=0\.35/);
  assert.match(filter, /adelay=delays=192000S:all=1/);
  assert.match(filter, /atrim=duration=10/);
});
