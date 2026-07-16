import assert from "node:assert/strict";
import test from "node:test";

import { getConnectionPublishingBlockMessage } from "./social-connection-policy.ts";

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
