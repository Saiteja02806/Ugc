export function parseTrendingHookVideosEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

type TrendingHookVideoFeatureInput = {
  deploymentEnvironment?: string;
  featureFlag?: string;
  requestUrl?: string;
};

export function resolveTrendingHookVideosEnabled({
  featureFlag,
}: TrendingHookVideoFeatureInput) {
  // Hook videos stay off in every environment unless the server explicitly
  // opts in. Production uses the same reversible flag as previews.
  return parseTrendingHookVideosEnabled(featureFlag);
}

export function areTrendingHookVideosEnabled(request?: Request) {
  return resolveTrendingHookVideosEnabled({
    deploymentEnvironment: process.env.VERCEL_ENV,
    featureFlag: process.env.TRENDING_HOOK_VIDEOS_ENABLED,
    requestUrl: request?.url,
  });
}
