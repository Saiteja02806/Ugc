import { isTrendingFormatEnabled } from "./format-policy.ts";

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
  return (
    isTrendingFormatEnabled("hook_video") &&
    parseTrendingHookVideosEnabled(featureFlag)
  );
}

export function areTrendingHookVideosEnabled(request?: Request) {
  return resolveTrendingHookVideosEnabled({
    deploymentEnvironment: process.env.VERCEL_ENV,
    featureFlag: process.env.TRENDING_HOOK_VIDEOS_ENABLED,
    requestUrl: request?.url,
  });
}
