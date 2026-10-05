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

test("image results retain the complete submitted prompt from saved metadata", () => {
  const prompt = "Create a portrait.\nPreserve the supplied face and natural light.";
  const [result] = getAIStudioImageResults([{ ...baseAsset, metadata: { prompt } }]);
  assert.equal(result?.prompt, prompt);
  assert.equal(result?.title, "Generated image");
  assert.equal(getAIStudioImageResults([baseAsset])[0]?.prompt, undefined);
});

test("maps backend video metadata and media asset identity", () => {
  const videoAsset: MediaAsset = {
    ...baseAsset,
    collection: "video",
    durationSeconds: 4,
    id: "video-1",
    metadata: {
      model: "seedance_2_5",
      prompt: "A cinematic product launch at sunset",
      resolution: "720p",
    },
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
  assert.equal(result?.prompt, "A cinematic product launch at sunset");
  assert.equal(result?.modelLabel, "Seedance 2.5");
  assert.equal(result?.resolution, "720p");
  assert.equal(result?.thumbnailUrl, null);
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

test("Kling videos retain their model label alongside earlier Seedance history", () => {
  const videos = getAIStudioVideoResults([
    { ...baseAsset, collection: "video", sourceType: "generated_video", id: "kling-video", metadata: { model: "kling_3_0" } },
    { ...baseAsset, collection: "video", sourceType: "generated_video", id: "seedance-video", metadata: { model: "seedance_2_5" } },
  ]);
  assert.equal(videos.find((video) => video.id === "kling-video")?.modelLabel, "Kling 3.0");
  assert.equal(videos.find((video) => video.id === "seedance-video")?.modelLabel, "Seedance 2.5");
});

test("image history keeps more than 24 returned assets when a new generation completes", () => {
  const assets = Array.from({ length: 30 }, (_, index) => ({
    ...baseAsset,
    id: `asset-${index}`,
  }));
  const results = getAIStudioImageResults(assets, assets.length);
  assert.equal(results.length, 30);
  const newResult = { ...results[0]!, id: "new-generation" };
  const updated = upsertAIStudioResult(results, newResult, results.length + 1);
  assert.equal(updated.length, 31);
  assert.equal(updated.at(-1)?.id, "asset-29");
  assert.equal(upsertAIStudioResult(updated, newResult, updated.length + 1).length, 31);
});
