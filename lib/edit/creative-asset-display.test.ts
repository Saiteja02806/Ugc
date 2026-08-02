import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreativeAssetDisplayState,
  hasRenderingEditProjects,
  indexLatestEditProjectsByAssetId,
} from "./creative-asset-display.ts";
import type { EditableVideo } from "./video-library.ts";

test("uses the latest persisted edit output on the original Creative Asset card", () => {
  const state = getCreativeAssetDisplayState(
    "https://media.example/source.mp4",
    createProject({
      renderedVideoUrl: "https://media.example/rendered.mp4",
      status: "draft",
    }),
  );

  assert.equal(state.playbackUrl, "https://media.example/rendered.mp4");
  assert.equal(state.status, "draft");
});

test("falls back to the immutable source when no saved output exists", () => {
  const state = getCreativeAssetDisplayState(
    "https://media.example/source.mp4",
    createProject({ renderedVideoUrl: null, status: "rendering" }),
  );

  assert.equal(state.playbackUrl, "https://media.example/source.mp4");
  assert.equal(state.isRendering, true);
});

test("detects when Creative Assets should poll edit status", () => {
  assert.equal(
    hasRenderingEditProjects([
      createProject({ status: "rendered" }),
      createProject({ status: "rendering" }),
    ]),
    true,
  );
  assert.equal(
    hasRenderingEditProjects([createProject({ status: "draft" })]),
    false,
  );
});

test("keeps the newest edit project when a source has legacy duplicates", () => {
  const newest = createProject({
    projectId: "new-project",
    renderedVideoUrl: "https://media.example/newest.mp4",
  });
  const older = createProject({
    projectId: "old-project",
    renderedVideoUrl: "https://media.example/older.mp4",
  });

  const indexed = indexLatestEditProjectsByAssetId([newest, older]);

  assert.equal(indexed.get("asset-1"), newest);
});

function createProject(
  overrides: Partial<EditableVideo> = {},
): EditableVideo {
  return {
    createdAt: "2026-08-02T00:00:00.000Z",
    draft: null,
    durationSeconds: 4,
    id: "asset-1",
    projectId: "test-project-001",
    ratio: "9:16",
    renderedVideoUrl: null,
    source: "draft",
    status: "ready",
    thumbnailUrl: null,
    title: "Asset",
    videoUrl: "https://media.example/source.mp4",
    ...overrides,
  };
}
