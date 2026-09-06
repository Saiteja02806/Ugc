import assert from "node:assert/strict";
import test from "node:test";

import { validateTrendingContentMix } from "./content-mix.ts";
import { rebalanceTrendingContentMix } from "./content-mix-editor.ts";

test("adjusting a format proportionally redistributes the other three formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 },
    "hook_video",
    40,
  );

  assert.deepEqual(next, {
    carousel: 17,
    hook_video: 40,
    reaction: 17,
    wall_text: 26,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Slideshow proportionally redistributes the other formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 },
    "carousel",
    50,
  );

  assert.deepEqual(next, {
    carousel: 50,
    hook_video: 19,
    reaction: 12,
    wall_text: 19,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Wall-of-Text to 100% clears the other formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 },
    "wall_text",
    100,
  );

  assert.deepEqual(next, {
    carousel: 0,
    hook_video: 0,
    reaction: 0,
    wall_text: 100,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Hooks to 100% clears the other formats", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 },
    "hook_video",
    100,
  );

  assert.deepEqual(next, {
    carousel: 0,
    hook_video: 100,
    reaction: 0,
    wall_text: 0,
  });
  assert.equal(validateTrendingContentMix(next), true);
});

test("adjusting Reaction Reels is a first-class content-mix change", () => {
  const next = rebalanceTrendingContentMix(
    { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 },
    "reaction",
    40,
  );

  assert.deepEqual(next, {
    carousel: 15,
    hook_video: 22,
    reaction: 40,
    wall_text: 23,
  });
  assert.equal(validateTrendingContentMix(next), true);
});
