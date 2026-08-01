import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync(
    new URL(
      "./data/hook-silent-videos-2026-07-29.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("silent Hook manifest has the reviewed batch contract", () => {
  assert.equal(
    manifest.schemaVersion,
    "hook-silent-video-manifest-v1",
  );
  assert.equal(manifest.sourceBatch, "hook-silent-2026-07-29");
  assert.equal(manifest.assets.length, 78);
  assert.equal(manifest.summary.silentCount, 78);
  assert.equal(manifest.summary.approvedCount, 78);
  assert.equal(manifest.summary.rejectedCount, 0);
  assert.deepEqual(manifest.summary.sourceFolderCounts, {
    amara: 6,
    first: 19,
    mira: 14,
    new: 10,
    nine_one: 4,
    real_four: 17,
    talia: 8,
  });
});

test("every silent Hook asset has one complete reviewed mapping", () => {
  const knownFolders = new Set(Object.keys(manifest.sourceFolders));
  const knownInfluencers = new Set(Object.keys(manifest.influencers));
  const knownVisualGroups = new Set(Object.keys(manifest.visualGroups));
  const knownReactionTypes = new Set(
    Object.keys(manifest.reactionTypes),
  );

  for (const asset of manifest.assets) {
    assert.match(asset.assetKey, /^hook-silent:[a-f0-9]{64}$/);
    assert.match(asset.catalogName, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(knownFolders.has(asset.sourceFolderKey));
    assert.ok(knownInfluencers.has(asset.influencerKey));
    assert.ok(knownVisualGroups.has(asset.visualGroup));
    assert.ok(knownReactionTypes.has(asset.reactionType));
    assert.equal(asset.hasAudio, false);
    assert.equal(asset.ratio, "9:16");
    assert.equal(asset.videoCodec, "h264");
    assert.ok(asset.durationSeconds > 0);
    assert.ok(Number.isInteger(asset.width) && asset.width > 0);
    assert.ok(Number.isInteger(asset.height) && asset.height > 0);
    assert.ok(asset.originalFileName.trim());
    assert.equal(asset.reviewStatus, "approved");
    assert.ok(asset.reviewReason.trim());
  }
});

test("silent Hook manifest contains no duplicate file, name, or hash", () => {
  assertUnique(
    manifest.assets.map(
      (asset) =>
        `${asset.sourceFolderKey}/${asset.originalFileName}`,
    ),
    "source file",
  );
  assertUnique(
    manifest.assets.map((asset) => asset.catalogName),
    "catalog name",
  );
  assertUnique(
    manifest.assets.map((asset) => asset.sha256),
    "SHA-256",
  );
});

test("every provisional influencer identity records review confidence", () => {
  for (const [key, influencer] of Object.entries(
    manifest.influencers,
  )) {
    assert.ok(influencer.displayName.trim(), `${key} display name`);
    assert.ok(
      ["high", "medium"].includes(influencer.identityConfidence),
      `${key} identity confidence`,
    );
  }
});

function assertUnique(values, label) {
  assert.equal(
    new Set(values).size,
    values.length,
    `Duplicate ${label} detected`,
  );
}
