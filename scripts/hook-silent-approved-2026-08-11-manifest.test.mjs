import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync(
    new URL("./data/hook-silent-approved-2026-08-11.json", import.meta.url),
    "utf8",
  ),
);

test("approved August Hook batch contains exactly 28 silent videos", () => {
  assert.equal(manifest.sourceBatch, "hook-silent-2026-08-11-approved-28");
  assert.equal(manifest.summary.approvedCount, 28);
  assert.equal(manifest.summary.rejectedCount, 0);
  assert.equal(manifest.summary.silentCount, 28);
  assert.equal(manifest.assets.length, 28);
  assert.ok(manifest.assets.every((asset) => asset.hasAudio === false));
});

test("approved August Hook batch uses existing formats and unique catalog identities", () => {
  const allowedFormats = new Set([
    "bedroom_reaction",
    "cafe_reaction",
    "desk_laptop_reaction",
    "headphones_reaction",
    "indoor_selfie_closeup",
    "indoor_selfie_medium",
  ]);
  assert.ok(
    manifest.assets.every((asset) => allowedFormats.has(asset.visualGroup)),
  );
  assert.equal(new Set(manifest.assets.map((asset) => asset.sha256)).size, 28);
  assert.equal(
    new Set(manifest.assets.map((asset) => asset.catalogName)).size,
    28,
  );
  assert.deepEqual(
    manifest.assets.map((asset) => asset.sortOrder),
    Array.from({ length: 28 }, (_, index) => 79 + index),
  );
});

test("all three EWW videos are identifiable for per-video Locked audio", () => {
  const ewwAssets = manifest.assets.filter(
    (asset) =>
      asset.originalFileName === "eww.mp4" ||
      asset.originalFileName === "eww1.mp4" ||
      asset.originalFileName === "eww2-silent.mp4",
  );
  assert.equal(ewwAssets.length, 3);
  assert.ok(
    ewwAssets.every(
      (asset) =>
        asset.visualGroup === "desk_laptop_reaction" &&
        asset.reactionType === "confusion_skepticism" &&
        asset.reviewReason.includes("EWW.mp3"),
    ),
  );
});
