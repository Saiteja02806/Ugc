import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateTrendingContent,
  allocateUnboundTrendingSlots,
  buildTrendingDailyFormatPlan,
  DEFAULT_TRENDING_CONTENT_MIX,
  validateTrendingContentMix,
} from "./content-mix.ts";

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

test("Growth alternates the half-post remainder between Carousel and Hook", () => {
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

  assert.deepEqual(
    [first.carousel + second.carousel, first.wall_text + second.wall_text, first.hook_video + second.hook_video],
    [25, 50, 25],
  );
  assert.deepEqual(
    [first.carousel, first.wall_text, first.hook_video].sort((a, b) => a - b),
    [12, 13, 25],
  );
  assert.deepEqual(
    [second.carousel, second.wall_text, second.hook_video].sort((a, b) => a - b),
    [12, 13, 25],
  );
  assert.notEqual(first.carousel, second.carousel);
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
