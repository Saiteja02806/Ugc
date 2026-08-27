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

test("adjusting Slideshow proportionally redistributes the other formats", () => {
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

test("adjusting Wall-of-Text to 100% clears the other formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 25, hook_video: 25, wall_text: 50 },
    "wall_text",
    100,
  );

  assert.deepEqual(next, {
    carousel: 0,
    hook_video: 0,
    wall_text: 100,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Hooks to 100% clears the other formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 25, hook_video: 25, wall_text: 50 },
    "hook_video",
    100,
  );

  assert.deepEqual(next, {
    carousel: 0,
    hook_video: 100,
    wall_text: 0,
  });
  assert.equal(validateTrendingContentMix(next), true);
});
