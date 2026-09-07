import assert from "node:assert/strict";
import test from "node:test";
import { isMediaAssetVisibleInCreativeLibrary, isMediaAssetVisibleInMediaList } from "./media-library-visibility.ts";
import { mediaSourceTypes } from "./types.ts";

test("scheduling can resolve ready reaction renders that are hidden from Creative Assets", () => {
  const asset = { sourceType: "reaction_render" as const, status: "ready", metadata: {} };
  assert.equal(isMediaAssetVisibleInMediaList(asset, "scheduling"), true);
  assert.equal(isMediaAssetVisibleInMediaList(asset, null), false);
  for (const status of ["uploading", "processing", "failed"]) {
    assert.equal(isMediaAssetVisibleInMediaList({ ...asset, status }, "scheduling"), false);
  }
});

test("every other format keeps its existing visibility rules", () => {
  for (const sourceType of mediaSourceTypes.filter((type) => type !== "reaction_render")) {
    for (const metadata of [{}, { libraryVisibility: "hook_videos_only" }]) {
      const asset = { sourceType, status: "ready", metadata };
      assert.equal(isMediaAssetVisibleInMediaList(asset, "scheduling"), isMediaAssetVisibleInCreativeLibrary(asset));
    }
  }
});
