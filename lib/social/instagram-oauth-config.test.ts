import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstagramOAuthAuthorizationUrl,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_BUSINESS_CONTENT_PUBLISH_SCOPE,
  INSTAGRAM_OAUTH_SCOPES,
} from "./instagram-oauth-config.ts";

test("uses least-privilege Instagram OAuth scopes for implemented features", () => {
  assert.deepEqual(INSTAGRAM_OAUTH_SCOPES, [
    INSTAGRAM_BUSINESS_BASIC_SCOPE,
    INSTAGRAM_BUSINESS_CONTENT_PUBLISH_SCOPE,
  ]);
  assert.equal(new Set(INSTAGRAM_OAUTH_SCOPES).size, INSTAGRAM_OAUTH_SCOPES.length);
  assert.equal(
    INSTAGRAM_OAUTH_SCOPES.includes("instagram_business_manage_insights"),
    false,
  );
});

test("builds the Instagram authorization URL with only product scopes", () => {
  const url = buildInstagramOAuthAuthorizationUrl({
    clientId: "instagram-app-id",
    redirectUri: "https://www.getugcpilot.com/api/social/instagram/callback",
    state: "oauth-state",
  });

  assert.equal(url.origin + url.pathname, "https://www.instagram.com/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "instagram-app-id");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://www.getugcpilot.com/api/social/instagram/callback",
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), INSTAGRAM_OAUTH_SCOPES.join(","));
  assert.equal(url.searchParams.get("state"), "oauth-state");
  assert.equal(
    url.searchParams.get("scope")?.includes("instagram_business_manage_insights"),
    false,
  );
});
