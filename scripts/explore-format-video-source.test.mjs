import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const policy = load("lib/explore/workflow-source-video.ts");
const { formatVideoFromAsset } = load("lib/explore/format-video-source.ts", { "./workflow-source-video.ts": policy });
const asset = changes => ({ id: "00000000-0000-4000-8000-000000000001", title: "My original footage", url: "/owned-video.mp4",
  status: "ready", collection: "video", mimeType: "video/mp4", fileSizeBytes: 2000, durationSeconds: 8,
  ratio: "16:9", width: 1280, height: 720, createdAt: "2026-10-08T00:00:00Z", metadata: {}, ...changes });

test("the editor uses the exact owned footage from uploads, generated videos, exports and legacy creator videos", () => {
  for (const sourceType of ["upload", "generated_video", "edit_export", "wall_text_render", "combined_render"]) {
    for (const collection of ["video", "influencer"]) {
      const original = asset({ sourceType, collection });
      const result = formatVideoFromAsset(original);
      assert.equal(result.mediaAssetId, original.id); assert.equal(result.url, original.url);
      assert.equal(result.durationSeconds, 8); assert.equal(result.width, 1280); assert.equal(result.height, 720);
      assert.equal(original.metadata.exploreFormat, undefined);
    }
  }
});
test("custom aspect ratios preserve native dimensions and unknown duration can be read by the player", () => {
  const result = formatVideoFromAsset(asset({ ratio: "other", width: 1440, height: 1080, durationSeconds: null }));
  assert.equal(result.width, 1440); assert.equal(result.height, 1080); assert.equal(result.durationSeconds, null);
});
test("unavailable, non-video, too short, too long and oversized sources cannot reach the format editor", () => {
  for (const change of [{ durationSeconds: .5 }, { durationSeconds: 121 }, { collection: "image" }, { mimeType: "image/png" }, { status: "processing" }, { url: "" }, { fileSizeBytes: 250 * 1024 * 1024 + 1 }]) {
    assert.throws(() => formatVideoFromAsset(asset(change)));
  }
});
