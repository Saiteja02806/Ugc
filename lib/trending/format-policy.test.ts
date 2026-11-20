import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildTrendingDailyFormatPlan, resolveTrendingContentMixPreference } from "./content-mix.ts";
import { getTrendingDailyPackReadiness } from "./daily-pack-readiness.ts";
import { getPublicDailyFeedState } from "./daily-feed-status.ts";
import {
  assertTrendingFormatGenerationEnabled,
  filterTrendingItemsForRuntime,
  getTrendingDailyPlanForRuntime,
  isTrendingFormatEnabled,
  SLIDESHOW_ONLY_TRENDING_CONTENT_MIX,
  TRENDING_SLIDESHOW_ONLY_ENABLED,
} from "./format-policy.ts";

test("all Trending formats are enabled and saved multi-format preferences are preserved", () => {
  assert.equal(TRENDING_SLIDESHOW_ONLY_ENABLED, false);
  for (const [planKey, dailyLimit] of [["free", 10], ["pro", 20], ["creator", 50]] as const) {
    for (const format of ["carousel", "hook_video", "wall_text", "reaction"] as const) {
      const preference = { mix: { carousel: 0, hook_video: 0, reaction: 0, wall_text: 0, [format]: 100 }, preferenceVersion: 7, updatedAt: "saved" };
      const original = structuredClone(preference);
      const effective = resolveTrendingContentMixPreference({ planKey, preference });
      const plan = buildTrendingDailyFormatPlan({ dailyLimit, localDate: "2026-10-13", mix: effective.mix });
      assert.deepEqual(plan.formats, Array(dailyLimit).fill(format));
      assert.deepEqual(effective.mix, preference.mix);
      assert.deepEqual(preference, original);
    }
  }
});

test("mixed daily plans retain all four formats without mutating stored slots", () => {
  const stored = {
    feed: { dailyLimit: 5, mix: { carousel: 40, hook_video: 20, reaction: 20, wall_text: 20 } },
    slots: [
      { format: "carousel" as const, state: "ready" as const, assignmentId: "slide", position: 1 },
      { format: "hook_video" as const, state: "failed" as const, assignmentId: null, position: 2 },
      { format: "wall_text" as const, state: "preparing" as const, assignmentId: null, position: 3 },
      { format: "reaction" as const, state: "ready" as const, assignmentId: "reaction", position: 4 },
      { format: "carousel" as const, state: "decided" as const, assignmentId: "old-slide", position: 5 },
    ],
  };
  const original = structuredClone(stored);
  const view = getTrendingDailyPlanForRuntime(stored);
  const readiness = getTrendingDailyPackReadiness({ dailyLimit: view.feed.dailyLimit, slots: view.slots, resolvedAssignmentIds: new Set(["slide", "reaction"]) });
  assert.deepEqual(view.slots.map(slot => slot.position), [1, 2, 3, 4, 5]);
  assert.equal(readiness.pendingSlotCount, 1);
  assert.equal(readiness.failedSlotCount, 1);
  assert.equal(readiness.remainingCount, 4);
  assert.equal(getPublicDailyFeedState({ items: ["slide", "reaction"], readiness }), "failed");
  assert.deepEqual(stored, original);
});

test("an all-video pack with pending slots stays preparing rather than caught up", () => {
  const view = getTrendingDailyPlanForRuntime({ feed: { dailyLimit: 1, mix: { carousel: 0, hook_video: 100, wall_text: 0 } }, slots: [{ format: "hook_video" as const, state: "planned" as const, assignmentId: null }] });
  const readiness = getTrendingDailyPackReadiness({ dailyLimit: view.feed.dailyLimit, slots: view.slots, resolvedAssignmentIds: new Set() });
  assert.equal(getPublicDailyFeedState({ items: [], readiness }), "preparing");
});

test("missing slideshow reservations remain pending", () => {
  const view = getTrendingDailyPlanForRuntime({ feed: { dailyLimit: 2, mix: SLIDESHOW_ONLY_TRENDING_CONTENT_MIX }, slots: [{ format: "carousel" as const, state: "planned" as const, assignmentId: null }] });
  const readiness = getTrendingDailyPackReadiness({ dailyLimit: view.feed.dailyLimit, slots: view.slots, resolvedAssignmentIds: new Set() });
  assert.equal(readiness.pendingSlotCount, 2);
});

test("cached items and generation gates keep all four Trending formats enabled", () => {
  const formats = ["carousel", "hook_video", "wall_text", "reaction"] as const;
  const items = formats.map(format => ({ format }));
  assert.deepEqual(filterTrendingItemsForRuntime(items), items);
  assert.equal(items.length, 4);
  for (const format of formats) {
    assert.equal(isTrendingFormatEnabled(format), true);
    assert.doesNotThrow(() => assertTrendingFormatGenerationEnabled(format));
  }
});

test("Adjust keeps four-format sliders alongside slideshow style controls and multi-format walkthrough", () => {
  const dialog = readFileSync(new URL("../../components/trending/trending-content-mix-dialog.tsx", import.meta.url), "utf8");
  assert.match(dialog, /const AVAILABLE_MIX_ROWS = MIX_ROWS\.filter/);
  assert.doesNotMatch(dialog, /\{MIX_ROWS\.map/);
  assert.match(dialog, /setMix\(resolveTrendingContentMixForRuntime\(data\.preference\.mix\)\)/);
  assert.match(dialog, /setSavedMix\(resolveTrendingContentMixForRuntime\(data\.preference\.mix\)\)/);
  assert.match(dialog, /carouselCount < 1/);
  assert.match(dialog, /\(allocation\?\.carousel \?\? 0\) > 0/);
  const guide = readFileSync(new URL("../../components/trending/trending-first-visit-walkthrough.tsx", import.meta.url), "utf8");
  assert.match(guide, /ALL_STEPS\.filter/);
  assert.match(guide, /step\.kind\.startsWith\("slideshow_"\)/);
  const workspace = readFileSync(new URL("../../components/trending/trending-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Explore Carousel, Hook, Text on screen, and Reaction Reel content made from your business profile\./);
});
