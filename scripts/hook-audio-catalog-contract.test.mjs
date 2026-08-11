import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(
  readFileSync(
    new URL("./data/hook-audio-catalog-v1.json", import.meta.url),
    "utf8",
  ),
);
const additionalTags = JSON.parse(
  readFileSync(
    new URL("./data/hook-audio-additional-tags-v1.json", import.meta.url),
    "utf8",
  ),
);

const MOODS = new Set([
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
]);
const HOOK_TYPES = new Set([
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
]);

test("combines all three source packages into one deduplicated catalog", () => {
  assert.equal(catalog.schemaVersion, "hook-audio-library-v1");
  assert.deepEqual(catalog.summary, {
    duplicatesExcluded: 1,
    physicalAudioFiles: 53,
    taggedAssets: 52,
    untaggedAssets: 0,
    uniqueAssets: 52,
  });
  assert.deepEqual(
    catalog.sourcePackages.map((sourcePackage) => sourcePackage.id).sort(),
    [
      "hook_audio_tagged_batch_21_28_v1",
      "hook_audio_tagged_batch_v1",
      "hook_audio_tagging_package_v1",
    ],
  );
  assert.equal(new Set(catalog.assets.map((asset) => asset.id)).size, 52);
  assert.equal(new Set(catalog.assets.map((asset) => asset.sha256)).size, 52);
  assert.deepEqual(
    catalog.assets.map((asset) => asset.id),
    Array.from(
      { length: 52 },
      (_, index) => `hook_audio_${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("keeps every unique clip pending, inactive, and non-looping", () => {
  for (const asset of catalog.assets) {
    assert.equal(asset.reviewStatus, "pending", asset.id);
    assert.equal(asset.reviewedAt, null, asset.id);
    assert.equal(asset.status, "inactive", asset.id);
    assert.equal(asset.loopable, false, asset.id);
    assert.equal(asset.codec, "mp3", asset.id);
    assert.ok(asset.audioUrl === undefined, asset.id);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u, asset.id);
    assert.ok(asset.fileSizeBytes > 0, asset.id);
  }
});

test("provides structurally valid pending tags for all 52 unique assets", () => {
  const tagged = catalog.assets.filter((asset) => asset.tagsComplete);
  const untagged = catalog.assets.filter((asset) => !asset.tagsComplete);
  assert.equal(tagged.length, 52);
  assert.equal(untagged.length, 0);

  for (const asset of tagged) {
    assert.ok(asset.moods.length >= 1 && asset.moods.length <= 2, asset.id);
    assert.ok(asset.moods.every((value) => MOODS.has(value)), asset.id);
    assert.ok(
      asset.hookTypes.length >= 2 && asset.hookTypes.length <= 4,
      asset.id,
    );
    assert.ok(
      asset.hookTypes.every((value) => HOOK_TYPES.has(value)),
      asset.id,
    );
    assert.ok(["low", "medium", "high"].includes(asset.energy), asset.id);
  }

});

test("locks the 24 supplemental tag assignments to IDs, filenames, and hashes", () => {
  assert.equal(additionalTags.schemaVersion, "hook-audio-additional-tags-v1");
  assert.equal(additionalTags.policy.reviewStatus, "pending");
  assert.equal(
    additionalTags.policy.approvalRequirement,
    "listening-review-required",
  );
  assert.equal(additionalTags.assets.length, 24);

  const supplementalAssets = catalog.assets.filter(
    (asset) => asset.sourcePackage === "hook_audio_tagging_package_v1",
  );
  assert.equal(supplementalAssets.length, 24);
  for (const expected of additionalTags.assets) {
    const actual = supplementalAssets.find((asset) => asset.id === expected.id);
    assert.ok(actual, expected.id);
    assert.equal(actual.sourceFileName, expected.sourceFileName, expected.id);
    assert.equal(actual.sha256, expected.sha256, expected.id);
    assert.deepEqual(actual.moods, expected.moods, expected.id);
    assert.deepEqual(actual.hookTypes, expected.hookTypes, expected.id);
    assert.equal(actual.energy, expected.energy, expected.id);
    assert.equal(actual.impactAtSeconds, expected.impactAtSeconds, expected.id);
    assert.equal(
      actual.taggingVersion,
      "hook-audio-additional-tags-v1",
      expected.id,
    );
  }
});

test("records the known duplicate without creating a second backend asset", () => {
  assert.equal(catalog.duplicates.length, 1);
  assert.deepEqual(catalog.duplicates[0], {
    canonicalAssetId: "hook_audio_031",
    reason:
      "Exact duplicate of ReelAudio-17100.mp3; reject duplicate row but keep original file unchanged in package.",
    reviewStatus: "rejected",
    sha256:
      "67f2e61a6f30ceec9daa064b3dffde13fed7fd0b5c6796b30273cd48d4879f1f",
    sourceFileName: "ReelAudio-79023.mp3",
    sourcePackage: "hook_audio_tagging_package_v1",
  });
  assert.equal(
    catalog.assets.filter(
      (asset) => asset.sha256 === catalog.duplicates[0].sha256,
    ).length,
    1,
  );
});

test("excludes Preferred and per-video override configuration", () => {
  const serialized = JSON.stringify(catalog).toLowerCase();
  assert.doesNotMatch(serialized, /preferred/u);
  assert.doesNotMatch(serialized, /override/u);
  assert.deepEqual(catalog.policy.supportedAudioModes, ["dynamic", "locked"]);
});
