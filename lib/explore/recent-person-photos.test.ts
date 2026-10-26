import assert from "node:assert/strict";
import { test } from "node:test";
import { readRecentPersonPhotos, recentPersonPhotosKey, serializeRecentPersonPhotos } from "./recent-person-photos.ts";
const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
test("remembered photos preserve order and explicit clearing without storing URLs", () => {
  assert.deepEqual(readRecentPersonPhotos(serializeRecentPersonPhotos("owner", [second, first]), "owner"), [second, first]);
  assert.deepEqual(readRecentPersonPhotos(serializeRecentPersonPhotos("owner", []), "owner"), []);
  assert.notEqual(recentPersonPhotosKey("owner"), recentPersonPhotosKey("other"));
  assert.deepEqual(readRecentPersonPhotos(serializeRecentPersonPhotos("owner", [first]), "other"), []);
});
test("malformed, duplicated, excessive and foreign remembered selections are not restored", () => {
  for (const raw of [null, "{", "null", "x".repeat(2049), JSON.stringify({ version: 2, ownerId: "owner", assetIds: [first] }),
    JSON.stringify({ version: 1, ownerId: "owner", assetIds: [first, first] }),
    JSON.stringify({ version: 1, ownerId: "owner", assetIds: ["https://foreign.example/photo.png"] }),
    JSON.stringify({ version: 1, ownerId: "owner", assetIds: Array(6).fill(first) })]) {
    assert.deepEqual(readRecentPersonPhotos(raw, "owner"), []);
  }
  assert.throws(() => serializeRecentPersonPhotos("owner", [first, first]));
});
