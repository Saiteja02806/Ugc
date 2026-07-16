import assert from "node:assert/strict";
import test from "node:test";

import {
  InstagramPublishError,
  publishInstagramReel,
} from "./instagram-publisher.js";

test("sends the selected Instagram feed placement", async () => {
  const createBodies: URLSearchParams[] = [];

  await withMockFetch(async (input, init) => {
    const url = new URL(String(input));

    if (url.pathname === "/account-1/media") {
      assert.equal(init?.method, "POST");
      createBodies.push(new URLSearchParams(String(init?.body)));
      return Response.json({ id: "container-1" });
    }

    if (url.pathname === "/container-1") {
      return Response.json({ status_code: "FINISHED" });
    }

    if (url.pathname === "/account-1/media_publish") {
      return Response.json({ id: "media-1" });
    }

    assert.equal(url.pathname, "/media-1");
    return Response.json({
      permalink: "https://www.instagram.com/reel/media-1",
    });
  }, async () => {
    const result = await publishInstagramReel({
      accessToken: "access-token",
      caption: "Caption",
      instagramAccountId: "account-1",
      shareToFeed: false,
      videoUrl: "https://cdn.example.com/video.mp4",
    });

    assert.equal(result.mediaId, "media-1");
  });

  assert.equal(createBodies[0]?.get("media_type"), "REELS");
  assert.equal(createBodies[0]?.get("share_to_feed"), "false");
});

test("classifies an expired Instagram token as a reconnect requirement", async () => {
  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 190,
          error_subcode: 463,
          fbtrace_id: "trace-expired-1",
          message: "The access token has expired.",
          type: "OAuthException",
        },
      },
      { status: 400 },
    ), async () => {
    await assert.rejects(
      publishInstagramReel(createPublishParams()),
      (error) =>
        error instanceof InstagramPublishError &&
        error.code === "access_token_invalid" &&
        error.actionRequired &&
        !error.retryable &&
        error.providerCode === 190 &&
        error.providerSubcode === 463 &&
        error.traceId === "trace-expired-1" &&
        error.userMessage === "Reconnect Instagram to continue publishing.",
    );
  });
});

test("classifies missing Instagram publishing permission as reconnectable", async () => {
  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 10,
          message: "Application does not have permission for this action.",
          type: "OAuthException",
        },
      },
      { status: 403 },
    ), async () => {
    await assert.rejects(
      publishInstagramReel(createPublishParams()),
      (error) =>
        error instanceof InstagramPublishError &&
        error.code === "permission_missing" &&
        error.actionRequired &&
        error.userMessage ===
          "Reconnect Instagram to allow video publishing.",
    );
  });
});

test("classifies Instagram rate limits as retryable and honors Retry-After", async () => {
  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 4,
          is_transient: true,
          message: "Application request limit reached.",
        },
      },
      {
        headers: { "Retry-After": "120" },
        status: 429,
      },
    ), async () => {
    await assert.rejects(
      publishInstagramReel(createPublishParams()),
      (error) =>
        error instanceof InstagramPublishError &&
        error.code === "rate_limited" &&
        !error.actionRequired &&
        error.retryable &&
        error.retryAfterSeconds === 120,
    );
  });
});

test("uses a safe message for a permanent Instagram media rejection", async () => {
  const technicalMessage =
    "Invalid parameter: video_url codec profile is not supported.";

  await withMockFetch(async () =>
    Response.json(
      {
        error: {
          code: 100,
          message: technicalMessage,
        },
      },
      { status: 400 },
    ), async () => {
    await assert.rejects(
      publishInstagramReel(createPublishParams()),
      (error) => {
        assert.ok(error instanceof InstagramPublishError);
        assert.equal(error.code, "invalid_media");
        assert.equal(error.retryable, false);
        assert.doesNotMatch(error.userMessage, /codec profile/i);
        assert.match(error.message, /codec profile/i);
        return true;
      },
    );
  });
});

function createPublishParams() {
  return {
    accessToken: "access-token",
    caption: "Caption",
    instagramAccountId: "account-1",
    videoUrl: "https://cdn.example.com/video.mp4",
  };
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
