import assert from "node:assert/strict";
import test from "node:test";

import {
  getTikTokChunkPlan,
  publishTikTokPhotoCarousel,
  publishTikTokVideo,
  TikTokPublishError,
} from "./tiktok-publisher.js";

test("initializes a TikTok photo carousel with ordered pull URLs", async () => {
  const initBodies: Array<Record<string, unknown>> = [];
  const initialized: string[] = [];

  await withTikTokEnv(
    { mode: "PULL_FROM_URL", verifiedHosts: "cdn.example.com" },
    async () => {
      await withMockFetch(async (input, init) => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/creator_info/query/")) {
          return tiktokResponse({
            comment_disabled: false,
            privacy_level_options: ["SELF_ONLY"],
          });
        }

        if (url.pathname.endsWith("/content/init/")) {
          initBodies.push(JSON.parse(String(init?.body)));
          return tiktokResponse({ publish_id: "photo-publish-1" });
        }

        assert.equal(url.pathname.endsWith("/status/fetch/"), true);
        return tiktokResponse({
          publicaly_available_post_id: ["photo-post-1"],
          status: "PUBLISH_COMPLETE",
        });
      }, async () => {
        const result = await publishTikTokPhotoCarousel({
          accessToken: "access-token",
          caption: "Photo caption",
          imageUrls: [
            "https://cdn.example.com/slide-1.webp",
            "https://cdn.example.com/slide-2.webp",
          ],
          onPublishInitialized: async (initialization) => {
            initialized.push(initialization.publishId);
          },
          settings: {
            allowComment: true,
            brandOrganic: true,
            brandedContent: false,
            privacyLevel: "SELF_ONLY",
          },
        });

        assert.equal(result.platformPostId, "photo-post-1");
      });
    },
  );

  assert.deepEqual(initBodies[0]?.source_info, {
    photo_cover_index: 0,
    photo_images: [
      "https://cdn.example.com/slide-1.webp",
      "https://cdn.example.com/slide-2.webp",
    ],
    source: "PULL_FROM_URL",
  });
  assert.equal(initBodies[0]?.media_type, "PHOTO");
  assert.equal(initBodies[0]?.post_mode, "DIRECT_POST");
  assert.deepEqual(initBodies[0]?.post_info, {
    auto_add_music: true,
    brand_content_toggle: false,
    brand_organic_toggle: true,
    description: "Photo caption",
    disable_comment: false,
    privacy_level: "SELF_ONLY",
    title: "Photo caption",
  });
  assert.deepEqual(initialized, ["photo-publish-1"]);
});

test("sends the selected TikTok privacy, interaction, and disclosure settings", async () => {
  const initBodies: Array<Record<string, unknown>> = [];

  await withTikTokEnv(
    { mode: "PULL_FROM_URL", verifiedHosts: "cdn.example.com" },
    async () => {
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
    },
  );

  assert.deepEqual(initBodies[0]?.post_info, {
    brand_content_toggle: true,
    brand_organic_toggle: true,
    disable_comment: false,
    disable_duet: true,
    disable_stitch: true,
    is_aigc: true,
    privacy_level: "PUBLIC_TO_EVERYONE",
    title: "Caption",
  });
  assert.deepEqual(initBodies[0]?.source_info, {
    source: "PULL_FROM_URL",
    video_url: "https://cdn.example.com/video.mp4",
  });
});

test("persists a FILE_UPLOAD session before sending video bytes", async () => {
  const events: string[] = [];
  const initBodies: Array<Record<string, unknown>> = [];
  const uploadBodies: Uint8Array[] = [];

  await withTikTokEnv({ mode: "FILE_UPLOAD" }, async () => {
    await withMockFetch(async (input, init) => {
      const url = new URL(String(input));

      if (url.hostname === "cdn.example.com") {
        return new Response(Uint8Array.from([1, 2, 3, 4]), {
          headers: {
            "Content-Length": "4",
            "Content-Type": "video/mp4",
          },
        });
      }

      if (url.pathname.endsWith("/creator_info/query/")) {
        return tiktokResponse({
          creator_nickname: "Test Creator",
          creator_username: "test_creator",
          privacy_level_options: ["SELF_ONLY"],
        });
      }

      if (url.pathname.endsWith("/video/init/")) {
        initBodies.push(JSON.parse(String(init?.body)));
        return tiktokResponse({
          publish_id: "publish-file-1",
          upload_url: "https://upload.example.com/session",
        });
      }

      if (url.hostname === "upload.example.com") {
        events.push("upload");
        uploadBodies.push(
          new Uint8Array(await new Response(init?.body).arrayBuffer()),
        );
        assert.equal(init?.headers && getHeader(init.headers, "Content-Range"), "bytes 0-3/4");
        return new Response(null, { status: 201 });
      }

      return tiktokResponse({ status: "PUBLISH_COMPLETE" });
    }, async () => {
      const result = await publishTikTokVideo({
        accessToken: "access-token",
        caption: "Caption",
        onPublishInitialized: async (initialization) => {
          events.push("persist");
          assert.deepEqual(initialization, {
            creatorNickname: "Test Creator",
            creatorUsername: "test_creator",
            logId: null,
            mediaTransferMode: "FILE_UPLOAD",
            publishId: "publish-file-1",
            uploadUrl: "https://upload.example.com/session",
          });
        },
        settings: { privacyLevel: "SELF_ONLY" },
        videoMimeType: "video/mp4",
        videoUrl: "https://cdn.example.com/video.mp4",
      });

      assert.equal(result.platformPostId, "publish-file-1");
    });
  });

  assert.deepEqual(events, ["persist", "upload"]);
  assert.deepEqual(uploadBodies[0], Uint8Array.from([1, 2, 3, 4]));
  assert.deepEqual(initBodies[0]?.source_info, {
    chunk_size: 4,
    source: "FILE_UPLOAD",
    total_chunk_count: 1,
    video_size: 4,
  });
});

test("resumes an existing TikTok upload without initializing another post", async () => {
  let initCalls = 0;
  let statusCalls = 0;
  let uploadCalls = 0;

  await withTikTokEnv({ mode: "FILE_UPLOAD" }, async () => {
    await withMockFetch(async (input) => {
      const url = new URL(String(input));

      if (url.hostname === "cdn.example.com") {
        return new Response(Uint8Array.from([1, 2, 3, 4]), {
          headers: { "Content-Type": "video/mp4" },
        });
      }

      if (url.pathname.endsWith("/creator_info/query/")) {
        return tiktokResponse({ privacy_level_options: ["SELF_ONLY"] });
      }

      if (url.pathname.endsWith("/video/init/")) {
        initCalls += 1;
      }

      if (url.hostname === "upload.example.com") {
        uploadCalls += 1;
        return new Response(null, { status: 201 });
      }

      if (url.pathname.endsWith("/status/fetch/")) {
        statusCalls += 1;
        return tiktokResponse(
          statusCalls === 1
            ? { status: "PROCESSING_UPLOAD", uploaded_bytes: 0 }
            : { status: "PUBLISH_COMPLETE" },
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    }, async () => {
      await publishTikTokVideo({
        accessToken: "access-token",
        caption: "Caption",
        publishId: "publish-existing",
        settings: { privacyLevel: "SELF_ONLY" },
        uploadUrl: "https://upload.example.com/session",
        videoUrl: "https://cdn.example.com/video.mp4",
      });
    });
  });

  assert.equal(initCalls, 0);
  assert.equal(uploadCalls, 1);
  assert.equal(statusCalls, 2);
});

test("fails instead of changing a TikTok visibility that is no longer available", async () => {
  let initCalls = 0;

  await withTikTokEnv({ mode: "FILE_UPLOAD" }, async () => {
    await assert.rejects(
      withMockFetch(async (input) => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/creator_info/query/")) {
          return tiktokResponse({ privacy_level_options: ["SELF_ONLY"] });
        }

        initCalls += 1;
        return tiktokResponse({ publish_id: "unexpected" });
      }, async () => {
        await publishTikTokVideo({
          accessToken: "access-token",
          caption: "Caption",
          settings: { privacyLevel: "PUBLIC_TO_EVERYONE" },
          videoUrl: "https://cdn.example.com/video.mp4",
        });
      }),
      (error) =>
        error instanceof TikTokPublishError &&
        error.code === "privacy_level_option_mismatch" &&
        error.actionRequired,
    );
  });

  assert.equal(initCalls, 0);
});

test("requires an explicit TikTok visibility", async () => {
  await assert.rejects(
    withMockFetch(async () =>
      tiktokResponse({ privacy_level_options: ["SELF_ONLY"] }),
    async () =>
      publishTikTokVideo({
        accessToken: "access-token",
        caption: "Caption",
        videoUrl: "https://cdn.example.com/video.mp4",
      }),
    ),
    (error) =>
      error instanceof TikTokPublishError &&
      error.code === "privacy_level_option_mismatch" &&
      error.actionRequired,
  );
});

test("preserves TikTok provider error code and log id", async () => {
  await assert.rejects(
    withMockFetch(async () => {
      return Response.json(
        {
          error: {
            code: "scope_not_authorized",
            log_id: "log-123",
            message: "Missing scope",
          },
        },
        { status: 401 },
      );
    }, async () => {
      await publishTikTokVideo({
        accessToken: "access-token",
        caption: "Caption",
        videoUrl: "https://cdn.example.com/video.mp4",
      });
    }),
    (error) =>
      error instanceof TikTokPublishError &&
      error.code === "scope_not_authorized" &&
      error.logId === "log-123" &&
      error.actionRequired,
  );
});

test("preserves the TikTok log id from a failed publish status", async () => {
  await withTikTokEnv(
    { mode: "PULL_FROM_URL", verifiedHosts: "cdn.example.com" },
    async () => {
      await assert.rejects(
        withMockFetch(async (input) => {
          const url = new URL(String(input));

          if (url.pathname.endsWith("/creator_info/query/")) {
            return tiktokResponse({ privacy_level_options: ["SELF_ONLY"] });
          }

          if (url.pathname.endsWith("/video/init/")) {
            return tiktokResponse({ publish_id: "publish-failed" });
          }

          return tiktokResponse(
            {
              fail_reason: "spam_risk_too_many_posts",
              status: "FAILED",
            },
            "log-status-1",
          );
        }, async () =>
          publishTikTokVideo({
            accessToken: "access-token",
            caption: "Caption",
            settings: { privacyLevel: "SELF_ONLY" },
            videoUrl: "https://cdn.example.com/video.mp4",
          }),
        ),
        (error) =>
          error instanceof TikTokPublishError &&
          error.code === "spam_risk_too_many_posts" &&
          error.logId === "log-status-1" &&
          error.actionRequired,
      );
    },
  );
});

test("creates TikTok chunk plans with a bounded final chunk", () => {
  const totalBytes = 65 * 1024 * 1024;
  const plan = getTikTokChunkPlan(totalBytes);

  assert.equal(plan.chunkSize, 64 * 1024 * 1024);
  assert.deepEqual(plan.ranges, [{ start: 0, end: totalBytes - 1 }]);
});

function tiktokResponse(data: Record<string, unknown>, logId?: string) {
  return Response.json({
    data,
    error: { code: "ok", ...(logId ? { log_id: logId } : {}) },
  });
}

async function withTikTokEnv(
  values: { mode: "FILE_UPLOAD" | "PULL_FROM_URL"; verifiedHosts?: string },
  run: () => Promise<void>,
) {
  const previousMode = process.env.TIKTOK_MEDIA_TRANSFER_MODE;
  const previousHosts = process.env.TIKTOK_VERIFIED_MEDIA_HOSTS;
  process.env.TIKTOK_MEDIA_TRANSFER_MODE = values.mode;
  process.env.TIKTOK_VERIFIED_MEDIA_HOSTS = values.verifiedHosts ?? "";

  try {
    await run();
  } finally {
    restoreEnv("TIKTOK_MEDIA_TRANSFER_MODE", previousMode);
    restoreEnv("TIKTOK_VERIFIED_MEDIA_HOSTS", previousHosts);
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

function getHeader(headers: NonNullable<RequestInit["headers"]>, name: string) {
  return new Headers(headers).get(name);
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
