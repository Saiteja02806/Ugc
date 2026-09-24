import assert from "node:assert/strict";
import test from "node:test";

import {
  isContentSecondaryClipMediaAsset,
  isScheduledVideoMediaAsset,
} from "./secondary-clip-media.ts";
import type { MediaAsset, MediaSourceType } from "../media/types.ts";

function videoAsset(sourceType: MediaSourceType): MediaAsset {
  return {
    collection: "video",
    createdAt: "2026-09-24T00:00:00.000Z",
    durationSeconds: 8,
    fileName: "video.mp4",
    fileSizeBytes: 1,
    height: 1920,
    id: `${sourceType}-asset`,
    metadata: {},
    mimeType: "video/mp4",
    parentAssetId: null,
    projectId: null,
    ratio: "9:16",
    sourceRecordId: null,
    sourceType,
    status: "ready",
    thumbnailUrl: null,
    title: "Test video",
    updatedAt: "2026-09-24T00:00:00.000Z",
    url: "https://example.com/video.mp4",
    width: 1080,
  };
}

test("keeps Reaction Reels out of the Content-only Secondary clip picker", () => {
  const reaction = videoAsset("reaction_render");

  assert.equal(isContentSecondaryClipMediaAsset(reaction), false);
  assert.equal(isScheduledVideoMediaAsset(reaction), true);
});

test("keeps Content videos selectable as Secondary clips", () => {
  const contentVideo = videoAsset("demo_upload");

  assert.equal(isContentSecondaryClipMediaAsset(contentVideo), true);
  assert.equal(isScheduledVideoMediaAsset(contentVideo), true);
});

test("does not expose other non-Content final renders as Secondary clips", () => {
  const wallTextRender = videoAsset("wall_text_render");

  assert.equal(isContentSecondaryClipMediaAsset(wallTextRender), false);
  assert.equal(isScheduledVideoMediaAsset(wallTextRender), true);
});
