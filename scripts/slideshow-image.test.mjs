import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const load = (path, imports) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert.ok(name in imports); return imports[name]; } });
  return exports;
};
const results = load("../lib/ai-studio/media-results.ts", {});
const asset = { id: "actual-media-id", url: "https://owned.test/image", status: "ready", collection: "image", sourceType: "generated_image", ratio: "4:5", title: "Ready image", createdAt: "2026-10-09", sourceRecordId: "job-id" };
test("transient lookup failure retains the real media ID for a successful owned retry", async () => {
  let failed = true;
  const calls = [];
  const h = load("../lib/explore/slideshow-image.ts", { "../ai-studio/media-results": results, "../ai-studio/media-client": {
    fetchAIStudioMediaAsset: async (id, token) => { calls.push({ id, token }); if (failed) throw new Error("Unavailable"); return asset; },
    fetchAIStudioMediaAssets: () => assert.fail("No list lookup when the media identity is available"),
  } });
  const image = { id: "job-preview", mediaAssetId: asset.id, sourceJobId: "job-id" };
  await assert.rejects(h.resolveSlideshowImage(image, "owner-token"), /Unavailable/);
  failed = false;
  assert.equal((await h.resolveSlideshowImage(image, "owner-token")).id, asset.id);
  assert.deepEqual(calls, [{ id: asset.id, token: "owner-token" }, { id: asset.id, token: "owner-token" }]);
});
test("job-only previews resolve owned source records and never look up a job UUID as a media UUID", async () => {
  let available = false;
  const h = load("../lib/explore/slideshow-image.ts", { "../ai-studio/media-results": results, "../ai-studio/media-client": {
    fetchAIStudioMediaAsset: () => assert.fail("A job identity is not a media identity"),
    fetchAIStudioMediaAssets: async args => { assert.equal(args.token, "owner-token"); return available ? [asset] : [{ ...asset, sourceRecordId: "other-job" }]; },
  } });
  const image = { id: "generation-id", mediaAssetId: null, sourceJobId: "job-id" };
  await assert.rejects(h.resolveSlideshowImage(image, "owner-token"), /still being saved/);
  available = true;
  assert.equal((await h.resolveSlideshowImage(image, "owner-token")).id, asset.id);
});
test("missing, unfinished, wrong-type and non-generated media cannot enter the slideshow", async () => {
  for (const value of [null, { ...asset, status: "uploading" }, { ...asset, collection: "video" }, { ...asset, sourceType: "upload" }]) {
    const h = load("../lib/explore/slideshow-image.ts", { "../ai-studio/media-results": results, "../ai-studio/media-client": { fetchAIStudioMediaAsset: async () => value, fetchAIStudioMediaAssets: () => assert.fail("Unexpected list") } });
    await assert.rejects(h.resolveSlideshowImage({ id: asset.id }, "owner-token"));
  }
});
