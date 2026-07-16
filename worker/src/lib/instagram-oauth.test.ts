import assert from "node:assert/strict";
import test from "node:test";

import {
  InstagramOAuthError,
  refreshInstagramAccessToken,
} from "./instagram-oauth.js";

test("renews a long-lived Instagram access token", async () => {
  await withMockFetch(async (input) => {
    const url = new URL(String(input));

    assert.equal(url.pathname, "/refresh_access_token");
    assert.equal(url.searchParams.get("grant_type"), "ig_refresh_token");
    assert.equal(url.searchParams.get("access_token"), "current-token");

    return Response.json({
      access_token: "renewed-token",
      expires_in: 5_184_000,
      token_type: "bearer",
    });
  }, async () => {
    const result = await refreshInstagramAccessToken("current-token");

    assert.equal(result.accessToken, "renewed-token");
    assert.equal(result.tokenType, "bearer");
    assert.ok(Date.parse(result.expiresAt) > Date.now());
  });
});

test("requires reconnection when the Instagram token can no longer renew", async () => {
  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 190,
          error_subcode: 463,
          fbtrace_id: "trace-refresh-expired",
          message: "The access token has expired.",
          type: "OAuthException",
        },
      },
      { status: 400 },
    ), async () => {
    await assert.rejects(
      refreshInstagramAccessToken("expired-token"),
      (error) =>
        error instanceof InstagramOAuthError &&
        error.code === "access_token_invalid" &&
        error.actionRequired &&
        !error.retryable &&
        error.providerSubcode === 463 &&
        error.traceId === "trace-refresh-expired",
    );
  });
});

test("retries a temporary Instagram token service failure", async () => {
  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 2,
          is_transient: true,
          message: "Service temporarily unavailable.",
        },
      },
      { status: 503 },
    ), async () => {
    await assert.rejects(
      refreshInstagramAccessToken("current-token"),
      (error) =>
        error instanceof InstagramOAuthError &&
        error.code === "provider_unavailable" &&
        !error.actionRequired &&
        error.retryable &&
        !error.userMessage.includes("Service temporarily unavailable"),
    );
  });
});

async function withMockFetch(
  mockFetch: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
