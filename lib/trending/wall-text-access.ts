import type { TrendingFeedProviderResult } from "./feed-items.ts";

export function isWallTextLocalDevelopmentEnabled(
  nodeEnvironment = process.env.NODE_ENV,
) {
  return nodeEnvironment === "development";
}

export function filterWallTextProvidersForRuntime(
  providers: readonly TrendingFeedProviderResult[],
  nodeEnvironment = process.env.NODE_ENV,
): TrendingFeedProviderResult[] {
  if (isWallTextLocalDevelopmentEnabled(nodeEnvironment)) {
    return [...providers];
  }

  return providers.filter((provider) => provider.format !== "wall_text");
}
