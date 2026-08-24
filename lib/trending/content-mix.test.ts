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

test("Free receives exactly 3 Slideshows, 4 Wall posts, and 3 Hooks", () => {
  assert.deepEqual(
    allocateTrendingContent({
      dailyLimit: 10,
      localDate: "2026-08-23",
      mix: FREE_TRENDING_CONTENT_MIX,
    }),
    { carousel: 3, hook_video: 3, wall_text: 4 },
  );
});

test("Free keeps its 3/4/3 default until the user saves a custom mix", () => {
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

test("Starter default mix creates exactly 5 Carousel, 10 Wall, and 5 Hook posts", () => {
  assert.deepEqual(
    allocateTrendingContent({
      dailyLimit: 20,
      localDate: "2026-08-20",
      mix: DEFAULT_TRENDING_CONTENT_MIX,
    }),
    { carousel: 5, hook_video: 5, wall_text: 10 },
  );
});

test("a changed mix replans only unbound positions", () => {
  const formats = allocateUnboundTrendingSlots({
    currentCounts: { carousel: 2, hook_video: 1, wall_text: 1 },
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

test("Growth keeps all fifty posts in one default preparation wave", () => {
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

  assert.deepEqual(first, { carousel: 13, hook_video: 12, wall_text: 25 });
  assert.deepEqual(second, first);
  assert.equal(first.carousel + first.wall_text + first.hook_video, 50);
});

test("the planned feed is interleaved and preserves exact totals", () => {
  const plan = buildTrendingDailyFormatPlan({
    dailyLimit: 20,
    localDate: "2026-08-20",
    mix: DEFAULT_TRENDING_CONTENT_MIX,
  });

  assert.equal(plan.formats.length, 20);
  assert.equal(plan.formats.filter((format) => format === "carousel").length, 5);
  assert.equal(plan.formats.filter((format) => format === "wall_text").length, 10);
  assert.equal(plan.formats.filter((format) => format === "hook_video").length, 5);
  assert.ok(
    plan.formats.every(
      (format, index) => index === 0 || format !== plan.formats[index - 1],
    ),
  );
});

test("mix validation enforces the 100% total and generated-video caps", () => {
  assert.equal(validateTrendingContentMix(DEFAULT_TRENDING_CONTENT_MIX), true);
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 50, wall_text: 50 }),
    true,
  );
  assert.equal(
    validateTrendingContentMix({ carousel: 0, hook_video: 51, wall_text: 49 }),
    false,
  );
  assert.equal(
    validateTrendingContentMix({ carousel: 20, hook_video: 20, wall_text: 50 }),
    false,
  );
});
