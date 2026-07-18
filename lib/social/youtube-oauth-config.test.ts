import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSafeYouTubeOAuthDiagnostic,
  buildYouTubeOAuthAuthorizationUrl,
  hasYouTubeAnalyticsScope,
  hasYouTubeUploadScope,
  YOUTUBE_ANALYTICS_READONLY_SCOPE,
  YOUTUBE_OAUTH_SCOPES,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_UPLOAD_SCOPE,
  youtubeAuthorizationEndpoint,
} from "./youtube-oauth-config.ts";

test("uses least-privilege YouTube OAuth scopes for implemented features", () => {
  assert.deepEqual(YOUTUBE_OAUTH_SCOPES, [
    YOUTUBE_READONLY_SCOPE,
    YOUTUBE_UPLOAD_SCOPE,
  ]);
  assert.equal(YOUTUBE_OAUTH_SCOPES.includes(YOUTUBE_ANALYTICS_READONLY_SCOPE), false);
  assert.equal(new Set(YOUTUBE_OAUTH_SCOPES).size, YOUTUBE_OAUTH_SCOPES.length);
});

test("builds the YouTube authorization URL with every product scope", () => {
  const url = buildYouTubeOAuthAuthorizationUrl({
    clientId: "google-client-id.apps.googleusercontent.com",
    codeVerifierChallenge: "code-challenge",
    forceConsent: false,
    redirectUri: "https://getugcpilot.com/api/social/youtube/callback",
    state: "state-value",
  });

  assert.equal(url.toString().startsWith(youtubeAuthorizationEndpoint), true);
  assert.equal(
    url.searchParams.get("client_id"),
    "google-client-id.apps.googleusercontent.com",
  );
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://getugcpilot.com/api/social/youtube/callback",
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), YOUTUBE_OAUTH_SCOPES.join(" "));
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(url.searchParams.get("code_challenge"), "code-challenge");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.has("prompt"), false);
});

test("forces YouTube consent only for an intentional reconnect", () => {
  const url = buildYouTubeOAuthAuthorizationUrl({
    clientId: "google-client-id.apps.googleusercontent.com",
    codeVerifierChallenge: "code-challenge",
    forceConsent: true,
    redirectUri: "https://getugcpilot.com/api/social/youtube/callback",
    state: "state-value",
  });

  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("checks YouTube upload and analytics scopes separately", () => {
  assert.equal(hasYouTubeUploadScope([YOUTUBE_READONLY_SCOPE]), false);
  assert.equal(
    hasYouTubeUploadScope([YOUTUBE_READONLY_SCOPE, YOUTUBE_UPLOAD_SCOPE]),
    true,
  );
  assert.equal(hasYouTubeAnalyticsScope(YOUTUBE_OAUTH_SCOPES), false);
  assert.equal(
    hasYouTubeAnalyticsScope([
      ...YOUTUBE_OAUTH_SCOPES,
      YOUTUBE_ANALYTICS_READONLY_SCOPE,
    ]),
    true,
  );
});

test("builds a safe YouTube OAuth diagnostic without secrets", () => {
  const diagnostic = buildSafeYouTubeOAuthDiagnostic({
    clientId: "123456789012-abcdef.apps.googleusercontent.com",
    grantedScopes: [YOUTUBE_READONLY_SCOPE],
    redirectUri: "https://getugcpilot.com/api/social/youtube/callback",
    refreshTokenExists: true,
  });

  assert.equal(diagnostic.clientId.startsWith("***"), true);
  assert.equal(
    diagnostic.clientId.includes("123456789012-abcdef.apps.googleusercontent.com"),
    false,
  );
  assert.deepEqual(diagnostic.requestedScopes, [...YOUTUBE_OAUTH_SCOPES]);
  assert.deepEqual(diagnostic.grantedScopes, [YOUTUBE_READONLY_SCOPE]);
  assert.equal(diagnostic.refreshTokenExists, true);
});
