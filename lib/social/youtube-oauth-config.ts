export const youtubeAuthorizationEndpoint =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";
export const YOUTUBE_UPLOAD_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";
export const YOUTUBE_ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/yt-analytics.readonly";

export const YOUTUBE_OAUTH_SCOPES = [
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_UPLOAD_SCOPE,
] as const;

export type YouTubeOAuthDiagnostic = {
  clientId: string;
  grantedScopes: string[];
  redirectUri: string;
  refreshTokenExists: boolean;
  requestedScopes: string[];
};

export function buildYouTubeOAuthAuthorizationUrl(params: {
  clientId: string;
  codeVerifierChallenge: string;
  forceConsent: boolean;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(youtubeAuthorizationEndpoint);

  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("code_challenge", params.codeVerifierChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (params.forceConsent) {
    url.searchParams.set("prompt", "consent");
  }

  return url;
}

export function hasYouTubeUploadScope(scopes: readonly string[]) {
  return scopes.includes(YOUTUBE_UPLOAD_SCOPE);
}

export function hasYouTubeAnalyticsScope(scopes: readonly string[]) {
  return scopes.includes(YOUTUBE_ANALYTICS_READONLY_SCOPE);
}

export function buildSafeYouTubeOAuthDiagnostic(params: {
  clientId: string;
  grantedScopes?: readonly string[] | null;
  redirectUri: string;
  refreshTokenExists: boolean;
}): YouTubeOAuthDiagnostic {
  return {
    clientId: maskGoogleClientId(params.clientId),
    grantedScopes: [...(params.grantedScopes ?? [])],
    redirectUri: params.redirectUri,
    refreshTokenExists: params.refreshTokenExists,
    requestedScopes: [...YOUTUBE_OAUTH_SCOPES],
  };
}

function maskGoogleClientId(clientId: string) {
  const normalized = clientId.trim();

  if (!normalized) {
    return "missing";
  }

  const suffix = normalized.slice(-12);

  return `***${suffix}`;
}
