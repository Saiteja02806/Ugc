import assert from "node:assert/strict";
import test from "node:test";

import {
  isTikTokReconnectErrorCode,
  refreshTikTokAccessToken,
  TikTokOAuthError,
} from "./tiktok-oauth.js";

test("refreshes and rotates TikTok tokens with exact returned scopes", async () => {
  await withTikTokEnvironment(async () => {
    await withMockFetch(async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));

      assert.equal(body.get("client_key"), "client-key");
      assert.equal(body.get("client_secret"), "client-secret");
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("refresh_token"), "refresh-old");

      return Response.json({
        access_token: "access-new",
        expires_in: 86_400,
        open_id: "open-id",
        refresh_expires_in: 31_536_000,
        refresh_token: "refresh-new",
        scope: "user.info.basic,video.publish",
        token_type: "Bearer",
      });
    }, async () => {
      const result = await refreshTikTokAccessToken("refresh-old");

      assert.equal(result.accessToken, "access-new");
      assert.equal(result.refreshToken, "refresh-new");
      assert.deepEqual(result.scopes, ["user.info.basic", "video.publish"]);
    });
  });
});

test("fails closed when TikTok omits returned scopes", async () => {
  await withTikTokEnvironment(async () => {
    await assert.rejects(
      withMockFetch(async () => {
        return Response.json({
          access_token: "access-new",
          expires_in: 86_400,
          refresh_expires_in: 31_536_000,
          refresh_token: "refresh-new",
        });
      }, async () => refreshTikTokAccessToken("refresh-old")),
      (error) =>
        error instanceof TikTokOAuthError &&
        error.code === "incomplete_token_response",
    );
  });
});

test("classifies TikTok reconnect errors", () => {
  assert.equal(isTikTokReconnectErrorCode("invalid_grant"), true);
  assert.equal(isTikTokReconnectErrorCode("scope_not_authorized"), true);
  assert.equal(isTikTokReconnectErrorCode("rate_limit_exceeded"), false);
});

async function withTikTokEnvironment<T>(run: () => Promise<T>) {
  const previousKey = process.env.TIKTOK_CLIENT_KEY;
  const previousSecret = process.env.TIKTOK_CLIENT_SECRET;
  process.env.TIKTOK_CLIENT_KEY = "client-key";
  process.env.TIKTOK_CLIENT_SECRET = "client-secret";

  try {
    return await run();
  } finally {
    restoreEnv("TIKTOK_CLIENT_KEY", previousKey);
    restoreEnv("TIKTOK_CLIENT_SECRET", previousSecret);
  }
}

async function withMockFetch<T>(
  mockFetch: typeof fetch,
  run: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
