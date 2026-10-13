import type { TrendingFeedFormat } from "./feed-items.ts";
import type { TrendingContentMix } from "./content-mix.ts";

// Temporary Trending product policy. Keep format implementations and saved data.
// Keep the worker policy in worker/src/lib/trending-format-policy.ts in sync.
export const TRENDING_SLIDESHOW_ONLY_ENABLED = true;

export const SLIDESHOW_ONLY_TRENDING_CONTENT_MIX = {
  carousel: 100,
  hook_video: 0,
  reaction: 0,
  wall_text: 0,
} as const satisfies TrendingContentMix;

export function isTrendingFormatEnabled(format: TrendingFeedFormat) {
  return !TRENDING_SLIDESHOW_ONLY_ENABLED || format === "carousel";
}

export function resolveTrendingContentMixForRuntime(mix: TrendingContentMix) {
  return TRENDING_SLIDESHOW_ONLY_ENABLED
    ? { ...SLIDESHOW_ONLY_TRENDING_CONTENT_MIX }
    : { ...mix };
}

export function filterTrendingItemsForRuntime<T extends { format: TrendingFeedFormat }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => isTrendingFormatEnabled(item.format));
}

/** A presentation view only: never write it over the saved daily snapshot. */
export function getTrendingDailyPlanForRuntime<
  F extends { dailyLimit: number; mix: TrendingContentMix },
  S extends { format: TrendingFeedFormat },
>(plan: { feed: F; slots: S[] }) {
  const slots = filterTrendingItemsForRuntime(plan.slots);
  return {
    feed: {
      ...plan.feed,
      dailyLimit: Math.max(plan.feed.dailyLimit - (plan.slots.length - slots.length), 0),
      mix: resolveTrendingContentMixForRuntime(plan.feed.mix),
    },
    slots,
  };
}

export function assertTrendingFormatGenerationEnabled(format: TrendingFeedFormat) {
  if (!isTrendingFormatEnabled(format)) {
    throw new Error("Trending currently generates slideshows only.");
  }
}
