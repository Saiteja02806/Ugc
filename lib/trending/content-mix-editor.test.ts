import assert from "node:assert/strict";
import test from "node:test";

import { validateTrendingContentMix } from "./content-mix.ts";
import { rebalanceTrendingContentMix } from "./content-mix-editor.ts";

test("adjusting a video format trades against Slideshow and preserves 100%", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 25, hook_video: 25, wall_text: 50 },
    "hook_video",
    40,
  );

  assert.deepEqual(next, {
    carousel: 10,
    hook_video: 40,
    wall_text: 50,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Slideshow proportionally redistributes the two capped formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 25, hook_video: 25, wall_text: 50 },
    "carousel",
    50,
  );

  assert.deepEqual(next, {
    carousel: 50,
    hook_video: 17,
    wall_text: 33,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjustments clamp to backend limits without creating an invalid mix", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 25, hook_video: 25, wall_text: 50 },
    "wall_text",
    90,
  );

  assert.deepEqual(next, {
    carousel: 25,
    hook_video: 25,
    wall_text: 50,
  });
  assert.equal(validateTrendingContentMix(next), true);
});
