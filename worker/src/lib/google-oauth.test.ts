import assert from "node:assert/strict";
import test from "node:test";

import {
  GoogleOAuthError,
  refreshGoogleAccessToken,
} from "./google-oauth.js";

test("refreshes a Google access token without exposing worker credentials", async () => {
  await withGoogleEnvironment(async () => {
    await withMockFetch(async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));

      assert.equal(body.get("client_id"), "google-client-id");
      assert.equal(body.get("client_secret"), "google-client-secret");
      assert.equal(body.get("refresh_token"), "refresh-token");

      return Response.json({
        access_token: "refreshed-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }, async () => {
      const result = await refreshGoogleAccessToken("refresh-token");

      assert.equal(result.accessToken, "refreshed-access-token");
      assert.equal(result.tokenType, "Bearer");
      assert.ok(result.expiresAt);
    });
  });
});

test("requires YouTube reconnection when Google rejects the refresh grant", async () => {
  await withGoogleEnvironment(async () => {
    await withMockFetch(async () =>
      Response.json(
        {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        },
        { status: 400 },
      ), async () => {
      await assert.rejects(
        refreshGoogleAccessToken("revoked-refresh-token"),
        (error) =>
          error instanceof GoogleOAuthError &&
          error.code === "invalid_grant" &&
          error.actionRequired &&
          !error.retryable &&
          error.userMessage === "Reconnect YouTube to continue publishing.",
      );
    });
  });
});

test("retries temporary Google token endpoint failures", async () => {
  await withGoogleEnvironment(async () => {
    await withMockFetch(async () =>
      Response.json(
        {
          error: "temporarily_unavailable",
          error_description: "The authorization server is overloaded.",
        },
        { status: 503 },
      ), async () => {
      await assert.rejects(
        refreshGoogleAccessToken("refresh-token"),
        (error) =>
          error instanceof GoogleOAuthError &&
          error.code === "temporarily_unavailable" &&
          !error.actionRequired &&
          error.retryable &&
          !error.userMessage.includes("overloaded"),
      );
    });
  });
});

async function withGoogleEnvironment(run: () => Promise<void>) {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

  try {
    await run();
  } finally {
    restoreEnvironment("GOOGLE_CLIENT_ID", originalClientId);
    restoreEnvironment("GOOGLE_CLIENT_SECRET", originalClientSecret);
  }
}

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

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
