export const instagramAuthorizationEndpoint =
  "https://www.instagram.com/oauth/authorize";

export const INSTAGRAM_BUSINESS_BASIC_SCOPE = "instagram_business_basic";
export const INSTAGRAM_BUSINESS_CONTENT_PUBLISH_SCOPE =
  "instagram_business_content_publish";

export const INSTAGRAM_OAUTH_SCOPES = [
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_BUSINESS_CONTENT_PUBLISH_SCOPE,
] as const;

export function buildInstagramOAuthAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(instagramAuthorizationEndpoint);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", params.state);
  return url;
}
