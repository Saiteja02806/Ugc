import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync(
    new URL("./data/wall-text-videos-real-2026-07-28.json", import.meta.url),
    "utf8",
  ),
);

test("pins the reviewed Wall-of-text source batch and playback behavior", () => {
  assert.equal(manifest.schemaVersion, "wall-text-video-manifest-v1");
  assert.equal(manifest.sourceBatch, "wall-text-real-2026-07-28");
  assert.deepEqual(manifest.playback, {
    mode: "once",
    textVisibility: "full-duration",
  });
});

test("maps 51 unique approved videos into exactly one visual group each", () => {
  assert.equal(manifest.assets.length, 51);
  assert.equal(
    new Set(manifest.assets.map((asset) => asset.fileName)).size,
    51,
  );
  assert.equal(
    new Set(manifest.assets.map((asset) => asset.catalogName)).size,
    51,
  );
  assert.equal(
    new Set(manifest.assets.map((asset) => asset.sha256)).size,
    51,
  );

  const knownGroups = new Set(Object.keys(manifest.visualGroups));

  assert.deepEqual(
    [...knownGroups].sort(),
    [
      "car_selfie",
      "indoor_closeup",
      "indoor_medium",
      "outdoor_static_selfie",
      "outdoor_walking_selfie",
    ],
  );
  assert.equal(
    manifest.assets.every(
      (asset) =>
        knownGroups.has(asset.visualGroup) &&
        /^[0-9a-f]{64}$/u.test(asset.sha256),
    ),
    true,
  );
});

test("records all 15 exact duplicate filenames as rejected", () => {
  assert.equal(manifest.rejectedDuplicates.length, 15);

  const acceptedNames = new Set(
    manifest.assets.map((asset) => asset.fileName),
  );

  assert.equal(
    manifest.rejectedDuplicates.every(
      (duplicate) =>
        !acceptedNames.has(duplicate.fileName) &&
        acceptedNames.has(duplicate.duplicateOf),
    ),
    true,
  );
});
