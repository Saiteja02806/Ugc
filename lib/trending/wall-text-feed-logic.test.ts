import assert from "node:assert/strict";
import test from "node:test";

import {
  createWallTextLayout,
  isEligibleWallTextVideo,
  selectTrendingWallTextCandidates,
  type WallTextAssetSelectionInput,
} from "./wall-text-feed-logic.ts";

function asset(
  overrides: Partial<WallTextAssetSelectionInput> = {},
): WallTextAssetSelectionInput {
  return {
    analysisStatus: "succeeded",
    aspectRatio: "9:16",
    assetType: "video",
    createdAt: "2026-07-26T00:00:00.000Z",
    durationSeconds: 12,
    formatFamily: "wall_text_overlay",
    id: "asset-1",
    lastUsedAt: null,
    motionLevel: "low",
    previewUrl: "https://media.example.com/wall.mp4",
    readabilityScore: 0.9,
    recommendedPosition: "top-center",
    status: "active",
    textCapacity: "high",
    thumbnailUrl: null,
    usageCount: 0,
    ...overrides,
  };
}

test("accepts only analyzed active vertical Wall-of-text videos", () => {
  assert.equal(isEligibleWallTextVideo(asset()), true);
  assert.equal(
    isEligibleWallTextVideo(asset({ assetType: "image" })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ aspectRatio: "4:5" })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ durationSeconds: 5 })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ motionLevel: "high" })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ textCapacity: "low" })),
    false,
  );
});

test("selects low-usage unique videos and preserves real durations", () => {
  const selected = selectTrendingWallTextCandidates([
    asset({ id: "used", usageCount: 12, durationSeconds: 20 }),
    asset({ id: "fresh", usageCount: 0, durationSeconds: 9.25 }),
    asset({ id: "fresh", usageCount: 0, durationSeconds: 9.25 }),
  ]);

  assert.deepEqual(
    selected.map((candidate) => ({
      durationSeconds: candidate.durationSeconds,
      id: candidate.entry.id,
    })),
    [
      { durationSeconds: 9.25, id: "fresh" },
      { durationSeconds: 20, id: "used" },
    ],
  );
});

test("uses asset placement metadata to build a safe deterministic layout", () => {
  assert.equal(createWallTextLayout("top-left").placement, "top");
  assert.equal(createWallTextLayout("bottom").placement, "bottom");
  assert.equal(createWallTextLayout(null).placement, "center");
  assert.deepEqual(createWallTextLayout(null).safeArea, {
    bottom: 0.2,
    left: 0.08,
    right: 0.08,
    top: 0.18,
  });
});
