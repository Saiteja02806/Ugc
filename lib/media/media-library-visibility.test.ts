import assert from "node:assert/strict";
import test from "node:test";
import { isMediaAssetVisibleInCreativeLibrary, isMediaAssetVisibleInMediaList } from "./media-library-visibility.ts";
import { mediaSourceTypes } from "./types.ts";

test("dedicated demos stay out of Creative Assets and generic pickers while raw hooks remain available", () => {
  for (const metadata of [{}, { demoId: "saved-demo" }, { mcpUpload: true, mcpDemo: true }]) {
    const demo = { sourceType: "demo_upload" as const, status: "ready", metadata };
    assert.equal(isMediaAssetVisibleInCreativeLibrary(demo), false);
    assert.equal(isMediaAssetVisibleInMediaList(demo, null), false);
    assert.equal(isMediaAssetVisibleInMediaList(demo, "scheduling"), true);
    assert.equal(isMediaAssetVisibleInMediaList({ ...demo, status: "uploading" }, "scheduling"), false);
  }
  for (const sourceType of ["upload", "generated_video", "influencer_upload"] as const) {
    assert.equal(isMediaAssetVisibleInCreativeLibrary({ sourceType, metadata: {} }), true);
  }
});

test("scheduling can resolve ready reaction renders that are hidden from Creative Assets", () => {
  const asset = { sourceType: "reaction_render" as const, status: "ready", metadata: {} };
  assert.equal(isMediaAssetVisibleInMediaList(asset, "scheduling"), true);
  assert.equal(isMediaAssetVisibleInMediaList(asset, null), false);
  for (const status of ["uploading", "processing", "failed"]) {
    assert.equal(isMediaAssetVisibleInMediaList({ ...asset, status }, "scheduling"), false);
  }
});

test("every other format keeps its existing visibility rules", () => {
  for (const sourceType of mediaSourceTypes.filter((type) => type !== "reaction_render" && type !== "demo_upload")) {
    for (const metadata of [{}, { libraryVisibility: "hook_videos_only" }]) {
      const asset = { sourceType, status: "ready", metadata };
      assert.equal(isMediaAssetVisibleInMediaList(asset, "scheduling"), isMediaAssetVisibleInCreativeLibrary(asset));
    }
  }
});
