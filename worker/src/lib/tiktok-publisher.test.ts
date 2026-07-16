import assert from "node:assert/strict";
import test from "node:test";

import { publishTikTokVideo } from "./tiktok-publisher.js";

test("sends the selected TikTok privacy, interaction, and disclosure settings", async () => {
  const initBodies: Array<Record<string, unknown>> = [];

  await withMockFetch(async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

    if (url.pathname.endsWith("/creator_info/query/")) {
      return tiktokResponse({
        comment_disabled: false,
        duet_disabled: true,
        privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
        stitch_disabled: false,
      });
    }

    if (url.pathname.endsWith("/video/init/")) {
      initBodies.push(body);
      return tiktokResponse({ publish_id: "publish-1" });
    }

    assert.equal(url.pathname.endsWith("/status/fetch/"), true);
    return tiktokResponse({
      publicaly_available_post_id: ["video-1"],
      status: "PUBLISH_COMPLETE",
    });
  }, async () => {
    const result = await publishTikTokVideo({
      accessToken: "access-token",
      caption: "Caption",
      settings: {
        allowComment: true,
        allowDuet: true,
        allowStitch: false,
        brandOrganic: true,
        brandedContent: true,
        privacyLevel: "PUBLIC_TO_EVERYONE",
      },
      videoUrl: "https://cdn.example.com/video.mp4",
    });

    assert.equal(result.platformPostId, "video-1");
  });

  assert.deepEqual(initBodies[0]?.post_info, {
    brand_content_toggle: true,
    brand_organic_toggle: true,
    disable_comment: false,
    disable_duet: true,
    disable_stitch: true,
    privacy_level: "PUBLIC_TO_EVERYONE",
    title: "Caption",
  });
});

test("fails instead of changing a TikTok visibility that is no longer available", async () => {
  let initCalls = 0;

  await assert.rejects(
    withMockFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/creator_info/query/")) {
        return tiktokResponse({
          privacy_level_options: ["SELF_ONLY"],
        });
      }

      initCalls += 1;
      return tiktokResponse({ publish_id: "unexpected" });
    }, async () => {
      await publishTikTokVideo({
        accessToken: "access-token",
        caption: "Caption",
        settings: {
          privacyLevel: "PUBLIC_TO_EVERYONE",
        },
        videoUrl: "https://cdn.example.com/video.mp4",
      });
    }),
    /selected TikTok visibility is no longer available/,
  );

  assert.equal(initCalls, 0);
});

function tiktokResponse(data: Record<string, unknown>) {
  return Response.json({
    data,
    error: { code: "ok" },
  });
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
