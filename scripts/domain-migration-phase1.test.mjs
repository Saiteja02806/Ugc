import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "mock-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "mock-project.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "mock-project";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "mock-project.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456789";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456789:web:abcdef";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/server" ? "next/server.js" : specifier,
      context,
    );
  },
});

const { NextRequest } = await import("next/server");
const { resolvePrimaryAppOrigin } = await import("../lib/marketing/public-origin.ts");
const { proxy } = await import("../proxy.ts");
const { getAllowedTargetOrigins, getSocialOAuthReturnUrl } = await import("../lib/social/oauth-callback.ts");
const { isAllowedOAuthMessageOrigin } = await import("../components/social/use-social-oauth-popup.ts");
const {
  getPlatformRedirectUri,
  getSocialOAuthBaseUrl,
} = await import("../lib/social/oauth.ts");

test("proxy redirects legacy public routes to vidmake.io with 307 and preserves query params", () => {
  const cases = [
    { from: "https://getugcpilot.com/", expected: "https://vidmake.io/" },
    { from: "https://www.getugcpilot.com/", expected: "https://vidmake.io/" },
    { from: "https://getugcpilot.com/pricing", expected: "https://vidmake.io/pricing" },
    {
      from: "https://getugcpilot.com/pricing?plan=growth&billing=yearly",
      expected: "https://vidmake.io/pricing?plan=growth&billing=yearly",
    },
    { from: "https://getugcpilot.com/dashboard", expected: "https://vidmake.io/dashboard" },
    { from: "https://getugcpilot.com/sign-in", expected: "https://vidmake.io/sign-in" },
    { from: "https://getugcpilot.com/explore/hook-video", expected: "https://vidmake.io/explore/hook-video" },
    { from: "https://getugcpilot.com/blog/ugc-hooks", expected: "https://vidmake.io/blog/ugc-hooks" },
  ];

  for (const { from, expected } of cases) {
    const res = proxy(new NextRequest(from));
    assert.equal(res.status, 307, `Expected 307 redirect for ${from}`);
    assert.equal(res.headers.get("location"), expected, `Expected Location ${expected} for ${from}`);
  }
});

test("proxy preserves legacy integration routes on getugcpilot.com without redirect", () => {
  const protectedRoutes = [
    "https://getugcpilot.com/api/social/tiktok/callback?code=test_code&state=test_state",
    "https://getugcpilot.com/api/social/youtube/callback?code=test_code&state=test_state",
    "https://getugcpilot.com/api/social/instagram/callback?code=test_code&state=test_state",
    "https://getugcpilot.com/api/social/meta/callback?code=test_code&state=test_state",
    "https://getugcpilot.com/api/meta/data-deletion",
    "https://getugcpilot.com/api/webhooks/dodo",
    "https://getugcpilot.com/api/internal/jobs/launch-render",
    "https://getugcpilot.com/api/internal/schedules/dispatch",
    "https://getugcpilot.com/_next/static/chunks/main.js",
    "https://getugcpilot.com/brand/ugc-pilot-logo.png",
    "https://getugcpilot.com/favicon.ico",
    "https://getugcpilot.com/robots.txt",
    "https://getugcpilot.com/sitemap.xml",
  ];

  for (const url of protectedRoutes) {
    const res = proxy(new NextRequest(url));
    assert.equal(res.status, 200, `Expected 200 (pass-through) for ${url}`);
    assert.equal(res.headers.get("location"), null, `Expected no location redirect header for ${url}`);
  }
});

test("proxy serves primary domain vidmake.io and local dev directly without redirect", () => {
  for (const url of [
    "https://vidmake.io/",
    "https://vidmake.io/pricing",
    "https://vidmake.io/dashboard",
    "https://www.vidmake.io/dashboard",
    "http://localhost:3000/dashboard",
  ]) {
    const res = proxy(new NextRequest(url));
    assert.equal(res.status, 200, `Expected 200 for ${url}`);
    assert.equal(res.headers.get("location"), null, `Expected no redirect for ${url}`);
  }
});

test("proxy preserves MCP deployment isolation on mcp.getugcpilot.com", () => {
  const mcpHealth = proxy(new NextRequest("https://mcp.getugcpilot.com/mcp/health"));
  assert.equal(mcpHealth.status, 200);

  const mcpBlocked = proxy(new NextRequest("https://mcp.getugcpilot.com/pricing"));
  assert.equal(mcpBlocked.status, 404);
});

test("getAllowedTargetOrigins permits cross-domain postMessage across vidmake.io and getugcpilot.com", () => {
  const origins = getAllowedTargetOrigins("https://vidmake.io");
  assert.ok(origins.includes("https://vidmake.io"));
  assert.ok(origins.includes("https://www.vidmake.io"));
  assert.ok(origins.includes("https://getugcpilot.com"));
  assert.ok(origins.includes("https://www.getugcpilot.com"));

  const localOrigins = getAllowedTargetOrigins("http://localhost:3000");
  assert.ok(localOrigins.includes("http://localhost:3000"));
  assert.ok(localOrigins.includes("https://vidmake.io"));
  assert.ok(localOrigins.includes("https://getugcpilot.com"));
});

test("isAllowedOAuthMessageOrigin validates cross-domain OAuth messages", () => {
  // Mock window.location.origin for testing
  const originalWindow = globalThis.window;

  try {
    // Case 1: App is running on vidmake.io, popup message arrives from getugcpilot.com callback
    globalThis.window = { location: { origin: "https://vidmake.io" } };
    assert.equal(isAllowedOAuthMessageOrigin("https://getugcpilot.com"), true);
    assert.equal(isAllowedOAuthMessageOrigin("https://www.getugcpilot.com"), true);
    assert.equal(isAllowedOAuthMessageOrigin("https://vidmake.io"), true);

    // Case 2: Reject untrusted external origins
    assert.equal(isAllowedOAuthMessageOrigin("https://evil-attacker.com"), false);
    assert.equal(isAllowedOAuthMessageOrigin("http://getugcpilot.com"), false); // HTTP rejected

    // Case 3: App running on localhost during local dev
    globalThis.window = { location: { origin: "http://localhost:3000" } };
    assert.equal(isAllowedOAuthMessageOrigin("http://localhost:3000"), true);
    assert.equal(isAllowedOAuthMessageOrigin("http://localhost:3001"), false);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("getPlatformRedirectUri defaults to legacy getugcpilot.com host even when APP_BASE_URL is vidmake.io", () => {
  const previousAppBaseUrl = process.env.APP_BASE_URL;
  const previousSocialBaseUrl = process.env.SOCIAL_OAUTH_BASE_URL;
  const previousTiktok = process.env.TIKTOK_REDIRECT_URI;

  try {
    process.env.APP_BASE_URL = "https://vidmake.io";
    delete process.env.SOCIAL_OAUTH_BASE_URL;
    delete process.env.TIKTOK_REDIRECT_URI;

    assert.equal(getSocialOAuthBaseUrl(), "https://getugcpilot.com");
    assert.equal(
      getPlatformRedirectUri("tiktok"),
      "https://getugcpilot.com/api/social/tiktok/callback",
    );
    assert.equal(
      getPlatformRedirectUri("youtube"),
      "https://getugcpilot.com/api/social/youtube/callback",
    );
    assert.equal(
      getPlatformRedirectUri("instagram"),
      "https://getugcpilot.com/api/social/instagram/callback",
    );
  } finally {
    if (previousAppBaseUrl !== undefined) process.env.APP_BASE_URL = previousAppBaseUrl;
    else delete process.env.APP_BASE_URL;
    if (previousSocialBaseUrl !== undefined) process.env.SOCIAL_OAUTH_BASE_URL = previousSocialBaseUrl;
    else delete process.env.SOCIAL_OAUTH_BASE_URL;
    if (previousTiktok !== undefined) process.env.TIKTOK_REDIRECT_URI = previousTiktok;
    else delete process.env.TIKTOK_REDIRECT_URI;
  }
});

test("legacy APP_BASE_URL does not keep public pages or OAuth completion on getugcpilot.com", () => {
  const previousAppBaseUrl = process.env.APP_BASE_URL;
  const previousPrimary = process.env.PRIMARY_APP_URL;
  try {
    process.env.APP_BASE_URL = "https://www.getugcpilot.com";
    delete process.env.PRIMARY_APP_URL;
    assert.equal(resolvePrimaryAppOrigin(), "https://vidmake.io");
    const pricing = proxy(new NextRequest("https://getugcpilot.com/pricing?plan=starter"));
    assert.equal(pricing.status, 307);
    assert.equal(pricing.headers.get("location"), "https://vidmake.io/pricing?plan=starter");
    const callback = proxy(new NextRequest("https://getugcpilot.com/api/social/tiktok/callback?code=abc&state=def"));
    assert.equal(callback.status, 200);
    const media = proxy(new NextRequest("https://www.getugcpilot.com/api/media/delivery/11111111-1111-4111-8111-111111111111"));
    assert.equal(media.status, 200);
    const firebase = proxy(new NextRequest("https://getugcpilot.com/__/auth/handler"));
    assert.equal(firebase.status, 200);
    const returnUrl = new URL(getSocialOAuthReturnUrl());
    assert.equal(returnUrl.origin, "https://vidmake.io");
    assert.equal(returnUrl.pathname, "/settings");
    assert.equal(returnUrl.hash, "#instagram-publishing");
    assert.equal(returnUrl.search, "");
  } finally {
    if (previousAppBaseUrl !== undefined) process.env.APP_BASE_URL = previousAppBaseUrl;
    else delete process.env.APP_BASE_URL;
    if (previousPrimary !== undefined) process.env.PRIMARY_APP_URL = previousPrimary;
    else delete process.env.PRIMARY_APP_URL;
  }
});
