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
    placementAnalysis: {
      contrastScore: 0.7,
      faceBoxes: [],
      faceOverlap: 0,
      importantRegions: [],
      selectedZone: "upper-middle",
      version: "wall-text-placement-v2",
    },
    previewUrl: "https://media.example.com/wall.mp4",
    sourceBatch: "wall-text-real-2026-07-28",
    sourceFileSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    status: "active",
    thumbnailUrl: null,
    usageCount: 0,
    visualGroup: "indoor_closeup",
    ...overrides,
  };
}

test("accepts only reviewed vertical Wall-of-text videos from six to sixty seconds", () => {
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
    isEligibleWallTextVideo(asset({ durationSeconds: 5.999 })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ durationSeconds: 6 })),
    true,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ durationSeconds: 60 })),
    true,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ durationSeconds: 60.001 })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ sourceFileSha256: null })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ visualGroup: null })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(asset({ placementAnalysis: null })),
    false,
  );
  assert.equal(
    isEligibleWallTextVideo(
      asset({
        placementAnalysis: {
          ...asset().placementAnalysis!,
          faceOverlap: 0.35,
        },
      }),
    ),
    true,
  );
});

test("preserves native durations and diversifies visual groups before reuse", () => {
  const selected = selectTrendingWallTextCandidates([
    asset({ id: "car-2", usageCount: 1, visualGroup: "car_selfie" }),
    asset({
      durationSeconds: 6.056,
      id: "car-1",
      usageCount: 0,
      visualGroup: "car_selfie",
    }),
    asset({ id: "indoor-1", usageCount: 2, visualGroup: "indoor_closeup" }),
    asset({ id: "outdoor-1", usageCount: 3, visualGroup: "outdoor_static" }),
  ]);

  assert.deepEqual(
    selected.map((candidate) => ({
      durationSeconds: candidate.durationSeconds,
      id: candidate.entry.id,
    })),
    [
      { durationSeconds: 6.056, id: "car-1" },
      { durationSeconds: 12, id: "indoor-1" },
      { durationSeconds: 12, id: "outdoor-1" },
      { durationSeconds: 12, id: "car-2" },
    ],
  );
});

test("uses face-aware zones and a visual-group fallback", () => {
  const analyzed = createWallTextLayout(
    asset({
      placementAnalysis: {
        contrastScore: 0.82,
        faceBoxes: [{ height: 0.2, width: 0.2, x: 0.4, y: 0.2 }],
        faceOverlap: 0.02,
        importantRegions: [],
        selectedZone: "upper-middle",
        version: "wall-text-placement-v2",
      },
    }),
  );
  const fallback = createWallTextLayout(
    asset({ placementAnalysis: null, visualGroup: "indoor_closeup" }),
  );

  assert.equal(analyzed.alignment, "center");
  assert.equal(analyzed.placement, "upper-middle");
  assert.equal(analyzed.placementSource, "face-analysis");
  assert.equal(fallback.placement, "lower-middle");
  assert.equal(fallback.placementSource, "visual-group-fallback");
  assert.equal(analyzed.version, "wall-text-layout-v4");
  assert.deepEqual(analyzed.safeArea, {
    bottom: 460 / 1920,
    left: 120 / 1080,
    right: 200 / 1080,
    top: 280 / 1920,
  });
  assert.deepEqual(analyzed.textBox, {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 560 / 1920,
  });
});
