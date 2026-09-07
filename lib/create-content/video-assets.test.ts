import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreateContentVideos,
  isCreateContentVideo,
} from "./video-assets.ts";
import type { MediaAsset } from "@/lib/media/types";

test("Create Content accepts only ready 9:16 video assets", () => {
  const eligible = createAsset();

  assert.equal(isCreateContentVideo(eligible), true);
  assert.deepEqual(
    getCreateContentVideos([
      eligible,
      createAsset({ ratio: "1:1" }),
      createAsset({ status: "processing" }),
      createAsset({ mimeType: "image/png" }),
    ]),
    [eligible],
  );
});

function createAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    collection: "video",
    createdAt: "2026-09-07T00:00:00.000Z",
    durationSeconds: 12,
    fileName: "source.mp4",
    fileSizeBytes: 1024,
    height: 1920,
    id: "asset-1",
    metadata: {},
    mimeType: "video/mp4",
    parentAssetId: null,
    projectId: null,
    ratio: "9:16",
    sourceRecordId: null,
    sourceType: "upload",
    status: "ready",
    thumbnailUrl: "https://media.example/thumbnail.jpg",
    title: "Source video",
    updatedAt: "2026-09-07T00:00:00.000Z",
    url: "https://media.example/source.mp4",
    width: 1080,
    ...overrides,
  };
}
