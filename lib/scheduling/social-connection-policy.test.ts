import assert from "node:assert/strict";
import test from "node:test";

import {
  getConnectionPublishingBlock,
  getConnectionPublishingBlockMessage,
  getInstagramSchedulingAccessState,
} from "./social-connection-policy.ts";

test("requires a ready Instagram connection before opening scheduling", () => {
  assert.equal(getInstagramSchedulingAccessState([]), "connect");
  assert.equal(
    getInstagramSchedulingAccessState([
      {
        platform: "tiktok",
        scopes: ["video.publish"],
        status: "connected",
      },
    ]),
    "connect",
  );
  assert.equal(
    getInstagramSchedulingAccessState([
      {
        platform: "instagram",
        scopes: ["instagram_content_publish"],
        status: "expired",
      },
    ]),
    "reconnect",
  );
  assert.equal(
    getInstagramSchedulingAccessState([
      {
        platform: "instagram",
        scopes: ["instagram_content_publish"],
        status: "connected",
      },
    ]),
    "ready",
  );
});

test("explains expired TikTok access without exposing OAuth scope names", () => {
  const message = getConnectionPublishingBlockMessage({
    platform: "tiktok",
    scopes: ["video.upload"],
    status: "expired",
  });

  assert.equal(message, "TikTok access expired. Reconnect to schedule posts.");
  assert.doesNotMatch(message ?? "", /video\.publish/);
});

test("blocks TikTok when direct publishing access is missing", () => {
  assert.equal(
    getConnectionPublishingBlockMessage({
      platform: "tiktok",
      scopes: ["video.upload"],
      status: "connected",
    }),
    "Reconnect TikTok to grant publishing permission.",
  );
});

test("accepts publishing-capable accounts", () => {
  assert.equal(
    getConnectionPublishingBlockMessage({
      platform: "instagram",
      scopes: ["instagram_content_publish"],
      status: "connected",
    }),
    null,
  );
  assert.equal(
    getConnectionPublishingBlockMessage({
      platform: "youtube",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      status: "connected",
    }),
    null,
  );
});

test("requires a YouTube refresh token for unattended publishing", () => {
  assert.deepEqual(
    getConnectionPublishingBlock({
      platform: "youtube",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      status: "connected",
      supportsBackgroundRefresh: false,
    }),
    {
      code: "youtube_refresh_token_missing",
      message:
        "Reconnect YouTube so scheduled posts can publish after you leave.",
    },
  );

  assert.equal(
    getConnectionPublishingBlockMessage({
      platform: "youtube",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      status: "connected",
      supportsBackgroundRefresh: true,
    }),
    null,
  );
});
