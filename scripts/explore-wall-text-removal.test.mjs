import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/explore/wall-text-video-library.ts", import.meta.url), "utf8");
const removed = [
  { id: "explore-wall-text-01", hash: "31d42e78ebbe868ee193ff281243948d610140323a593d03dab3258652921c6a" },
  { id: "explore-wall-text-08", hash: "686eed6e67b73c82c703bf2bab0add794268e2cdab075eedcca58cc2e2474ff2" },
  { id: "explore-wall-text-09", hash: "b6159891652a6f4ea1a3e13d79f5736f24b20de30111c136733e47f22f5e61ab" },
];

function loadLibrary() {
  const loadedModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./paired-reference-library") return { getPairedExploreVideos: () => [] };
    if (specifier === "@/lib/explore/hook-video-types") return { getExploreVideoPosterStorageKey: (key) => key.replace(/\.mp4$/, ".webp") };
    if (specifier === "@/lib/storage/storage") return { buildPublicStorageUrl: (key) => `https://example.test/${key}` };
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require });
  return loadedModule.exports;
}

test("removed clips are absent from lists, previews, imports and valid reference IDs", () => {
  const library = loadLibrary();
  for (const { id, hash } of removed) {
    assert.doesNotMatch(source, new RegExp(hash));
    assert.equal(library.isExploreWallTextVideoId(id), false);
  }
  assert.equal(library.isExploreWallTextVideoId("explore-wall-text-02"), true);
  assert.equal(library.getExploreWallTextPreviewVideo().id, "explore-wall-text-02");
  for (const items of [library.getExploreWallTextVideos(), library.getExploreWallTextVideoAssetsForImport()]) {
    assert.deepEqual(Array.from(items, (item) => item.id), Array.from({ length: 62 }, (_,index) => `explore-wall-text-${String(index + 2).padStart(2, "0")}`).filter(id => !removed.some(item => item.id === id)));
    for (const { id, hash } of removed) {
      assert.equal(items.some((item) => item.id === id), false);
      assert.equal(JSON.stringify(items).includes(hash), false);
    }
  }
});

test("Recreate and the legacy Explore API use the same filtered source library", () => {
  const catalogue = readFileSync(new URL("../lib/explore/recreate-catalog.ts", import.meta.url), "utf8");
  const directRoute = readFileSync(new URL("../app/api/explore/wall-text-videos/route.ts", import.meta.url), "utf8");
  assert.match(catalogue, /const existingWallText = getExploreWallTextVideos\(\)\.map/);
  assert.match(directRoute, /items: getExploreWallTextVideos\(\)/);
  assert.match(directRoute, /preview: getExploreWallTextPreviewVideo\(\)/);
});
