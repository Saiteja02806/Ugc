import assert from "node:assert/strict";
import test from "node:test";

import { publishInstagramReel } from "./instagram-publisher.js";

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
