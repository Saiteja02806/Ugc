import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importerSource = readFileSync(
  new URL("./import-wall-text-video-assets.mjs", import.meta.url),
  "utf8",
);

const manifest = JSON.parse(
  readFileSync(
    new URL("./data/wall-text-videos-real-2026-07-28.json", import.meta.url),
    "utf8",
  ),
);
const augustManifest = JSON.parse(
  readFileSync(
    new URL(
      "./data/wall-text-videos-real-2026-08-11.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const augustPartSevenManifest = JSON.parse(
  readFileSync(
    new URL(
      "./data/wall-text-videos-real-2026-08-20-part-7.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const augustPartEightManifest = JSON.parse(
  readFileSync(
    new URL(
      "./data/wall-text-videos-real-2026-08-20-part-8.json",
      import.meta.url,
    ),
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

test("pins the reviewed 2026-08-11 Wall batch as 64 new silent-ready sources", () => {
  assert.equal(augustManifest.schemaVersion, "wall-text-video-manifest-v1");
  assert.equal(augustManifest.sourceBatch, "wall-text-real-2026-08-11");
  assert.deepEqual(augustManifest.playback, {
    mode: "once",
    textVisibility: "full-duration",
  });
  assert.equal(augustManifest.assets.length, 64);
  assert.equal(augustManifest.rejectedDuplicates.length, 0);
  assert.equal(
    new Set(augustManifest.assets.map((asset) => asset.fileName)).size,
    64,
  );
  assert.equal(
    new Set(augustManifest.assets.map((asset) => asset.catalogName)).size,
    64,
  );
  assert.equal(
    new Set(augustManifest.assets.map((asset) => asset.sha256)).size,
    64,
  );

  const oldHashes = new Set(manifest.assets.map((asset) => asset.sha256));
  assert.equal(
    augustManifest.assets.every(
      (asset) =>
        /^[0-9a-f]{64}$/u.test(asset.sha256) &&
        !oldHashes.has(asset.sha256),
    ),
    true,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(augustManifest.visualGroups).map((group) => [
        group,
        augustManifest.assets.filter((asset) => asset.visualGroup === group)
          .length,
      ]),
    ),
    {
      car_selfie: 12,
      indoor_closeup: 14,
      indoor_medium: 31,
      outdoor_static_selfie: 5,
      outdoor_walking_selfie: 2,
    },
  );
});

test("uses the pinned FFprobe binary for portable media validation", () => {
  assert.match(importerSource, /import ffprobeStatic from "ffprobe-static"/);
  assert.match(importerSource, /execFileSync\([\s\S]+ffprobeStatic\.path/);
});

test("pins the two reviewed 2026-08-20 Wall batches as 29 new sources", () => {
  const newAssets = [
    ...augustPartSevenManifest.assets,
    ...augustPartEightManifest.assets,
  ];
  const previousHashes = new Set([
    ...manifest.assets.map((asset) => asset.sha256),
    ...augustManifest.assets.map((asset) => asset.sha256),
  ]);

  assert.equal(augustPartSevenManifest.assets.length, 14);
  assert.equal(augustPartEightManifest.assets.length, 15);
  assert.equal(newAssets.length, 29);
  assert.equal(new Set(newAssets.map((asset) => asset.fileName)).size, 29);
  assert.equal(new Set(newAssets.map((asset) => asset.catalogName)).size, 29);
  assert.equal(new Set(newAssets.map((asset) => asset.sha256)).size, 29);
  assert.equal(
    newAssets.every(
      (asset) =>
        /^[0-9a-f]{64}$/u.test(asset.sha256) &&
        !previousHashes.has(asset.sha256),
    ),
    true,
  );
});

test("imports shared Wall backgrounds as UGCpilot picker assets", () => {
  assert.match(importerSource, /wall_text_source_kind: "ugcpilot"/);
  assert.match(
    importerSource,
    /row\.wall_text_source_kind !== "ugcpilot"/,
  );
});

test("pins only the nine manually reviewed placement overrides", () => {
  const overrides = [
    ...augustPartSevenManifest.assets,
    ...augustPartEightManifest.assets,
  ].filter((asset) => asset.approvedPlacementZone);

  assert.equal(overrides.length, 9);
  assert.equal(
    overrides.every((asset) =>
      ["upper-middle", "middle", "lower-middle"].includes(
        asset.approvedPlacementZone,
      ),
    ),
    true,
  );
});
