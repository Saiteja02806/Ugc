export const tiktokAuthorizationEndpoint =
  "https://www.tiktok.com/v2/auth/authorize/";

export const requiredTikTokOAuthScopes = [
  "user.info.basic",
  "video.publish",
  "video.list",
] as const;

export function buildTikTokOAuthAuthorizationUrl(params: {
  clientKey: string;
  forceConsent: boolean;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(tiktokAuthorizationEndpoint);

  url.searchParams.set("client_key", params.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", requiredTikTokOAuthScopes.join(","));
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);

  if (params.forceConsent) {
    url.searchParams.set("disable_auto_auth", "1");
  }

  return url;
}

export function hasTikTokPublishScope(scopes: readonly string[]) {
  return scopes.includes("video.publish");
}

export function hasTikTokAnalyticsScope(scopes: readonly string[]) {
  return scopes.includes("video.list");
}
