import type { TrendingFeedProviderResult } from "./feed-items.ts";
import { filterTrendingItemsForRuntime, isTrendingFormatEnabled } from "./format-policy.ts";

export function isWallTextEnabled() {
  return isTrendingFormatEnabled("wall_text");
}

export function filterWallTextProvidersForRuntime(
  providers: readonly TrendingFeedProviderResult[],
): TrendingFeedProviderResult[] {
  return filterTrendingItemsForRuntime(providers);
}
