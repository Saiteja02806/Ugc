export function parseTrendingHookVideosEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

const PRODUCTION_HOSTNAMES = new Set([
  "getugcpilot.com",
  "www.getugcpilot.com",
]);

type TrendingHookVideoFeatureInput = {
  deploymentEnvironment?: string;
  featureFlag?: string;
  requestUrl?: string;
};

function isProductionRequestUrl(requestUrl: string | undefined) {
  if (!requestUrl) {
    return false;
  }

  try {
    return PRODUCTION_HOSTNAMES.has(new URL(requestUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function resolveTrendingHookVideosEnabled({
  deploymentEnvironment,
  featureFlag,
  requestUrl,
}: TrendingHookVideoFeatureInput) {
  if (deploymentEnvironment?.trim().toLowerCase() === "production") {
    return false;
  }

  if (isProductionRequestUrl(requestUrl)) {
    return false;
  }

  return parseTrendingHookVideosEnabled(featureFlag);
}

export function areTrendingHookVideosEnabled(request?: Request) {
  return resolveTrendingHookVideosEnabled({
    deploymentEnvironment: process.env.VERCEL_ENV,
    featureFlag: process.env.TRENDING_HOOK_VIDEOS_ENABLED,
    requestUrl: request?.url,
  });
}
