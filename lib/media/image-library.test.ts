import assert from "node:assert/strict";
import test from "node:test";
import { isAvailableLibraryImage, isLibraryImage, planSlideshowBackgrounds, sameBackgroundTargets } from "./image-library.ts";
import { isMediaAssetVisibleInCreativeLibrary } from "./media-library-visibility.ts";
import type { MediaAsset } from "./types.ts";

const image = { id: "image", collection: "image", status: "ready", sourceType: "upload", projectId: "image-library",
  mimeType: "image/png", width: 1080, height: 1350, url: "https://media.test/image.png", metadata: {} } as MediaAsset;

test("a collection fills the existing sequence in order, repeats when short and truncates unused collection images", () => {
  const ids = ["slide-1", "slide-2", "slide-3", "slide-4", "slide-5"];
  const plan = planSlideshowBackgrounds(ids, ["photo-1", "photo-2"]);
  assert.deepEqual(plan.map(item => item.assetId), ["photo-1", "photo-2", "photo-1", "photo-2", "photo-1"]);
  assert.deepEqual(plan.map(item => item.slideId), ids);
  assert.deepEqual(planSlideshowBackgrounds(["slide-1"], ["photo-1", "photo-2"]), [{ slideId: "slide-1", assetId: "photo-1" }]);
  assert.deepEqual(planSlideshowBackgrounds(ids, ["one-photo"]).map(item => item.assetId), Array(5).fill("one-photo"));
});

test("invalid, empty and ambiguous target lists fail before any draft change", () => {
  for (const [slides, images] of [[[], ["photo"]], [["slide"], []], [["slide", "slide"], ["photo"]], [["slide"], [""]], [Array.from({ length: 11 }, (_, i) => `slide-${i}`), ["photo"]]]) {
    assert.throws(() => planSlideshowBackgrounds(slides, images));
  }
  assert.equal(sameBackgroundTargets(["one", "two"], ["one", "two"]), true);
  assert.equal(sameBackgroundTargets(["two", "one"], ["one", "two"]), false);
  assert.equal(sameBackgroundTargets(["one"], ["one", "two"]), false);
});

test("ready uploads and generated images are reusable, catalogue/internal/invalid media are excluded", () => {
  assert.equal(isAvailableLibraryImage(image), true);
  assert.equal(isAvailableLibraryImage({ ...image, sourceType: "generated_image" }), true);
  for (const patch of [{ collection: "video" }, { status: "uploading" }, { sourceType: "catalog_influencer" },
    { sourceType: "edit_export" }, { projectId: "explore-catalog-reference" }, { mimeType: "image/svg+xml" },
    { width: 0 }, { height: null }, { url: "http://untrusted.test/image" }, { metadata: { libraryVisibility: "hook_videos_only" } }]) {
    assert.equal(isAvailableLibraryImage({ ...image, ...patch } as MediaAsset), false);
  }
});

test("archiving hides future selection and gallery tiles while retaining a valid existing image source", () => {
  const archived = { ...image, metadata: { imageLibraryArchived: true } };
  assert.equal(isAvailableLibraryImage(archived), false);
  assert.equal(isLibraryImage(archived), true);
  assert.equal(isMediaAssetVisibleInCreativeLibrary(archived), false);
  assert.equal(isAvailableLibraryImage({ ...archived, metadata: { imageLibraryArchived: false } }), true);
});
