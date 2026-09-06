import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateTrendingContent,
  allocateUnboundTrendingSlots,
  buildTrendingDailyFormatPlan,
  DEFAULT_TRENDING_CONTENT_MIX,
  FREE_TRENDING_CONTENT_MIX,
  resolveTrendingContentMixPreference,
  validateTrendingContentMix,
} from "./content-mix.ts";

test("Free receives exactly 2 Slideshows, 3 Wall posts, 2 Reaction Reels, and 3 Hooks", () => {
  assert.deepEqual(
    allocateTrendingContent({
      dailyLimit: 10,
      localDate: "2026-08-23",
      mix: FREE_TRENDING_CONTENT_MIX,
    }),
    { carousel: 2, hook_video: 3, reaction: 2, wall_text: 3 },
  );
});

test("Free keeps its 2/3/2/3 default until the user saves a custom mix", () => {
  const unsaved = resolveTrendingContentMixPreference({
    planKey: "free",
    preference: {
      mix: DEFAULT_TRENDING_CONTENT_MIX,
      preferenceVersion: 1,
      updatedAt: null,
    },
  });
  const saved = resolveTrendingContentMixPreference({
    planKey: "free",
    preference: {
      mix: { carousel: 50, hook_video: 0, wall_text: 50 },
      preferenceVersion: 2,
      updatedAt: "2026-08-24T12:00:00.000Z",
    },
  });

  assert.deepEqual(unsaved.mix, FREE_TRENDING_CONTENT_MIX);
  assert.deepEqual(saved.mix, {
    carousel: 50,
    hook_video: 0,
    wall_text: 50,
  });
});

test("Starter default mix creates exactly 4 Slideshows, 6 Walls, 4 Reactions, and 6 Hooks", () => {
  assert.deepEqual(
    allocateTrendingContent({
      dailyLimit: 20,
      localDate: "2026-08-20",
      mix: DEFAULT_TRENDING_CONTENT_MIX,
    }),
    { carousel: 4, hook_video: 6, reaction: 4, wall_text: 6 },
  );
});

test("a changed mix replans only unbound positions", () => {
  const formats = allocateUnboundTrendingSlots({
    currentCounts: { carousel: 2, hook_video: 1, reaction: 0, wall_text: 1 },
    dailyLimit: 20,
    localDate: "2026-08-20",
    mix: { carousel: 50, hook_video: 0, wall_text: 50 },
    unboundCount: 16,
  });

  assert.equal(formats.length, 16);
  assert.equal(formats.filter((format) => format === "hook_video").length, 0);
  assert.equal(formats.filter((format) => format === "carousel").length, 8);
  assert.equal(formats.filter((format) => format === "wall_text").length, 8);
});

test("Growth receives exactly 10 Slideshows, 15 Walls, 10 Reactions, and 15 Hooks", () => {
  const first = allocateTrendingContent({
    dailyLimit: 50,
    localDate: "2026-08-20",
    mix: DEFAULT_TRENDING_CONTENT_MIX,
  });
  const second = allocateTrendingContent({
    dailyLimit: 50,
    localDate: "2026-08-21",
    mix: DEFAULT_TRENDING_CONTENT_MIX,
  });

  assert.deepEqual(first, { carousel: 10, hook_video: 15, reaction: 10, wall_text: 15 });
  assert.deepEqual(second, first);
  assert.equal(first.carousel + first.wall_text + first.hook_video + first.reaction, 50);
});

test("the planned feed is interleaved and preserves exact totals", () => {
  const plan = buildTrendingDailyFormatPlan({
    dailyLimit: 20,
    localDate: "2026-08-20",
    mix: DEFAULT_TRENDING_CONTENT_MIX,
  });

  assert.equal(plan.formats.length, 20);
  assert.equal(plan.formats.filter((format) => format === "carousel").length, 4);
  assert.equal(plan.formats.filter((format) => format === "wall_text").length, 6);
  assert.equal(plan.formats.filter((format) => format === "reaction").length, 4);
  assert.equal(plan.formats.filter((format) => format === "hook_video").length, 6);
  assert.ok(
    plan.formats.every(
      (format, index) => index === 0 || format !== plan.formats[index - 1],
    ),
  );
});

test("mix validation accepts a full daily pack of any format", () => {
  assert.equal(validateTrendingContentMix(DEFAULT_TRENDING_CONTENT_MIX), true);
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 50, wall_text: 50 }),
    true,
  );
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 100, wall_text: 0 }),
    true,
  );
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 0, wall_text: 100 }),
    true,
  );
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 101, wall_text: -1 }),
    false,
  );
});

test("allocates the complete daily allowance to a selected format", () => {
  for (const mix of [
    { carousel: 100, hook_video: 0, wall_text: 0 },
    { carousel: 0, hook_video: 100, wall_text: 0 },
    { carousel: 0, hook_video: 0, wall_text: 100 },
    { carousel: 0, hook_video: 0, reaction: 100, wall_text: 0 },
  ]) {
    assert.deepEqual(
      allocateTrendingContent({
        dailyLimit: 50,
        localDate: "2026-08-27",
        mix,
      }),
      {
        carousel: mix.carousel === 100 ? 50 : 0,
        hook_video: mix.hook_video === 100 ? 50 : 0,
        reaction: mix.reaction === 100 ? 50 : 0,
        wall_text: mix.wall_text === 100 ? 50 : 0,
      },
    );
  }
});
