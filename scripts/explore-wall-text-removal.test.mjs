import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/explore/wall-text-video-library.ts", import.meta.url), "utf8");
const removedId = "explore-wall-text-01";
const removedHash = "31d42e78ebbe868ee193ff281243948d610140323a593d03dab3258652921c6a";

function loadLibrary() {
  const loadedModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/explore/hook-video-types") return { getExploreVideoPosterStorageKey: (key) => key.replace(/\.mp4$/, ".webp") };
    if (specifier === "@/lib/storage/storage") return { buildPublicStorageUrl: (key) => `https://example.test/${key}` };
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require });
  return loadedModule.exports;
}

test("the removed clip is absent from lists, previews, imports and valid reference IDs", () => {
  const library = loadLibrary();
  assert.doesNotMatch(source, new RegExp(removedHash));
  assert.equal(library.isExploreWallTextVideoId(removedId), false);
  assert.equal(library.isExploreWallTextVideoId("explore-wall-text-02"), true);
  assert.equal(library.getExploreWallTextPreviewVideo().id, "explore-wall-text-02");
  for (const items of [library.getExploreWallTextVideos(), library.getExploreWallTextVideoAssetsForImport()]) {
    assert.equal(items.some((item) => item.id === removedId), false);
    assert.deepEqual(Array.from(items, (item) => item.id), Array.from({ length: 62 }, (_,index) => `explore-wall-text-${String(index + 2).padStart(2, "0")}`));
    assert.equal(JSON.stringify(items).includes(removedHash), false);
  }
});

test("Recreate and the legacy Explore API use the same filtered source library", () => {
  const catalogue = readFileSync(new URL("../lib/explore/recreate-catalog.ts", import.meta.url), "utf8");
  const directRoute = readFileSync(new URL("../app/api/explore/wall-text-videos/route.ts", import.meta.url), "utf8");
  assert.match(catalogue, /const existingWallText = getExploreWallTextVideos\(\)\.map/);
  assert.match(directRoute, /items: getExploreWallTextVideos\(\)/);
  assert.match(directRoute, /preview: getExploreWallTextPreviewVideo\(\)/);
});
