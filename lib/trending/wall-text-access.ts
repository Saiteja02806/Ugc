import type { TrendingFeedProviderResult } from "./feed-items.ts";

export function isWallTextEnabled() {
  return true;
}

export function filterWallTextProvidersForRuntime(
  providers: readonly TrendingFeedProviderResult[],
): TrendingFeedProviderResult[] {
  return [...providers];
}
