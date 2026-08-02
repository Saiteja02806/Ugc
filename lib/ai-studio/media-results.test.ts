import assert from "node:assert/strict";
import test from "node:test";

import type { MediaAsset } from "../media/types.ts";
import {
  getAIStudioImageResults,
  getAIStudioVideoResults,
  upsertAIStudioResult,
} from "./media-results.ts";

const baseAsset: MediaAsset = {
  collection: "image",
  createdAt: "2026-08-02T10:00:00.000Z",
  durationSeconds: null,
  fileName: null,
  fileSizeBytes: null,
  height: 1500,
  id: "asset-1",
  metadata: {},
  mimeType: "image/png",
  parentAssetId: null,
  projectId: "ai-studio",
  ratio: "4:5",
  sourceRecordId: "job-1",
  sourceType: "generated_image",
  status: "ready",
  thumbnailUrl: null,
  title: "Generated image",
  updatedAt: "2026-08-02T10:00:00.000Z",
  url: "https://cdn.example.com/image.png",
  width: 1200,
};

test("maps only ready generated image assets", () => {
  const ignored = { ...baseAsset, id: "upload-1", sourceType: "upload" as const };
  const results = getAIStudioImageResults([baseAsset, ignored]);

  assert.deepEqual(results.map((result) => result.id), ["asset-1"]);
  assert.equal(results[0]?.aspectRatio, "4:5");
});

test("maps backend video metadata and media asset identity", () => {
  const videoAsset: MediaAsset = {
    ...baseAsset,
    collection: "video",
    durationSeconds: 4,
    id: "video-1",
    mimeType: "video/mp4",
    ratio: "9:16",
    sourceType: "generated_video",
    title: "Generated influencer video",
    url: "https://cdn.example.com/video.mp4",
  };
  const [result] = getAIStudioVideoResults([videoAsset]);

  assert.equal(result?.mediaAssetId, "video-1");
  assert.equal(result?.durationSeconds, 4);
  assert.equal(result?.createdAt, videoAsset.createdAt);
});

test("upserts a reconciled result without duplicates", () => {
  assert.deepEqual(
    upsertAIStudioResult(
      [
        { id: "one", title: "old" },
        { id: "two", title: "second" },
      ],
      { id: "one", title: "new" },
    ),
    [
      { id: "one", title: "new" },
      { id: "two", title: "second" },
    ],
  );
});
