import assert from "node:assert/strict";
import { test } from "node:test";
import staged from "./explore-hook-wall-reclassification-release.json" with { type: "json" };
import { getHookReferenceGalleryItems, getHookReferenceReleaseItems } from "./explore-hook-reference-release.ts";

test("published Wall-to-Hook assets are available to Recreate only after activation", () => {
  assert.equal(staged.mediaStatus, "published");
  assert.equal(staged.activation, "active");
  assert.equal(staged.items.length, 3);
  for (const item of staged.items) {
    assert.equal(getHookReferenceGalleryItems().some(existing => existing.id === item.id), true);
    assert.equal(getHookReferenceReleaseItems().some(existing => existing.id === item.id), true);
    for (const hash of [item.videoSha256, item.audioSha256, item.posterSha256]) assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(item.previewSha256, item.videoSha256);
    assert.ok(item.durationSeconds > 0 && item.durationSeconds < 4);
  }
});
