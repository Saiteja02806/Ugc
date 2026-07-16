import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTikTokOAuthAuthorizationUrl,
  hasTikTokPublishScope,
  requiredTikTokOAuthScopes,
} from "./tiktok-oauth-config.ts";

test("builds a least-privilege TikTok reconnect URL", () => {
  const url = buildTikTokOAuthAuthorizationUrl({
    clientKey: "client-key",
    forceConsent: true,
    redirectUri: "https://getugcpilot.com/api/social/tiktok/callback",
    state: "state-value",
  });

  assert.equal(url.origin, "https://www.tiktok.com");
  assert.equal(url.pathname, "/v2/auth/authorize/");
  assert.equal(url.searchParams.get("client_key"), "client-key");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(
    url.searchParams.get("scope"),
    requiredTikTokOAuthScopes.join(","),
  );
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://getugcpilot.com/api/social/tiktok/callback",
  );
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("disable_auto_auth"), "1");
});

test("does not force TikTok consent for a first connection", () => {
  const url = buildTikTokOAuthAuthorizationUrl({
    clientKey: "client-key",
    forceConsent: false,
    redirectUri: "https://getugcpilot.com/api/social/tiktok/callback",
    state: "state-value",
  });

  assert.equal(url.searchParams.has("disable_auto_auth"), false);
});

test("requires the exact TikTok Direct Post scope", () => {
  assert.equal(hasTikTokPublishScope(["video.upload"]), false);
  assert.equal(
    hasTikTokPublishScope(["user.info.basic", "video.publish"]),
    true,
  );
});
