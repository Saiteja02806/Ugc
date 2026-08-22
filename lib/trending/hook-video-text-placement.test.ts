import assert from "node:assert/strict";
import test from "node:test";

import {
  getHookVideoTextPosition,
  parseHookVideoTextPlacement,
} from "./hook-video-text-placement.ts";

test("accepts a reviewed normalized Hook text anchor", () => {
  const placement = parseHookVideoTextPlacement({
    preset: "above_head",
    reviewVersion: "hook-first-frame-placement-v1",
    reviewedAt: "2026-08-19",
    x: 0.5,
    y: 0.15,
  });

  assert.deepEqual(placement, {
    preset: "above_head",
    reviewVersion: "hook-first-frame-placement-v1",
    reviewedAt: "2026-08-19",
    x: 0.5,
    y: 0.15,
  });
  assert.deepEqual(getHookVideoTextPosition(placement), {
    x: 0.5,
    y: 0.15,
  });
});

test("rejects unknown presets and unsafe coordinates", () => {
  assert.equal(
    parseHookVideoTextPlacement({
      preset: "center_face",
      reviewVersion: "v1",
      reviewedAt: "2026-08-19",
      x: 0.5,
      y: 0.5,
    }),
    null,
  );
  assert.equal(
    parseHookVideoTextPlacement({
      preset: "below_face",
      reviewVersion: "v1",
      reviewedAt: "2026-08-19",
      x: 0.5,
      y: 1.1,
    }),
    null,
  );
});
