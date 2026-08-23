export function parseTrendingHookVideosEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() !== "false";
}

type TrendingHookVideoFeatureInput = {
  deploymentEnvironment?: string;
  featureFlag?: string;
  requestUrl?: string;
};

export function resolveTrendingHookVideosEnabled({
  featureFlag,
}: TrendingHookVideoFeatureInput) {
  // Hook ideas are part of every daily bundle. Keep an explicit false value as
  // an emergency kill switch without making a missing flag silently strand
  // reserved Hook positions forever.
  return parseTrendingHookVideosEnabled(featureFlag);
}

export function areTrendingHookVideosEnabled(request?: Request) {
  return resolveTrendingHookVideosEnabled({
    deploymentEnvironment: process.env.VERCEL_ENV,
    featureFlag: process.env.TRENDING_HOOK_VIDEOS_ENABLED,
    requestUrl: request?.url,
  });
}
