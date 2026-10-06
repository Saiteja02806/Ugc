import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
let row, reads;
const canonical = "https://storage.googleapis.com/private/owned/video.mp4";
mock.module("@/lib/media/media-reference", { namedExports: {
  privateKeyForMediaUrl: value => {
    const prefix = "https://storage.googleapis.com/private/";
    return value.startsWith(prefix) ? value.slice(prefix.length) : null;
  },
} });
mock.module("@/lib/media/media-delivery", { namedExports: {
  isPrivateUserMedia: asset => asset.metadata?.storageLocation === "private_user_media",
} });
mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetForOwner: async params => { reads.push(params); return row; },
  serializeMediaAsset: () => ({ url: "https://app.example.com/fresh-read", thumbnailUrl: "https://app.example.com/fresh-thumbnail" }),
} });
const { withPrivateEditDelivery } = await import("./private-video-delivery.ts");
beforeEach(() => {
  row = { user_id: "owner", status: "ready", deleted_at: null, storage_key: "owned/video.mp4", metadata: { storageLocation: "private_user_media" } };
  reads = [];
});
test("private Edit responses receive fresh owned browser links, never altering canonical stored input", async () => {
  const video = { id: "asset", videoUrl: canonical, thumbnailUrl: canonical + ".thumbnail.webp" };
  const response = await withPrivateEditDelivery(video, "owner");
  assert.equal(response.videoUrl, "https://app.example.com/fresh-read");
  assert.equal(response.thumbnailUrl, "https://app.example.com/fresh-thumbnail");
  assert.equal(video.videoUrl, canonical);
  assert.deepEqual(reads, [{ assetId: "asset", userId: "owner" }]);
});
test("removed, foreign or mismatched private Edit sources return no playback URL", async () => {
  for (const change of [{ user_id: "other" }, { deleted_at: "deleted" }, { status: "uploading" }, { storage_key: "different" }, { metadata: {} }]) {
    const previous = row; row = { ...row, ...change };
    const video = await withPrivateEditDelivery({ id: "asset", videoUrl: canonical, thumbnailUrl: "stale" }, "owner");
    assert.equal(video.videoUrl, null); assert.equal(video.thumbnailUrl, null); row = previous;
  }
});
test("public Edit sources are unchanged without any added database query", async () => {
  const video = { id: "asset", videoUrl: "https://public.example.com/video.mp4" };
  assert.equal(await withPrivateEditDelivery(video, "owner"), video); assert.equal(reads.length, 0);
});
