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

function loadLibrary(activeHooks = []) {
  const loadedModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./paired-reference-library") return { getPairedExploreVideos: () => [] };
    if (specifier === "@/worker/src/lib/explore-hook-reference-release") return { getHookReferenceGalleryItems: () => activeHooks };
    if (specifier === "../../worker/src/lib/explore-hook-wall-reclassification-release.json") return { default: JSON.parse(readFileSync(new URL("../worker/src/lib/explore-hook-wall-reclassification-release.json", import.meta.url), "utf8")) };
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
    const expected = Array.from({ length: 62 }, (_,index) => `explore-wall-text-${String(index + 2).padStart(2, "0")}`).filter(id => !removed.some(item => item.id === id));
    if (items === undefined) throw new Error("Missing Wall reference list");
    const includesRetired = items.some((item) => item.id === "explore-wall-text-21");
    assert.deepEqual(Array.from(items, (item) => item.id), includesRetired ? expected : expected.filter(id => id !== "explore-wall-text-21"));
    for (const { id, hash } of removed) {
      assert.equal(items.some((item) => item.id === id), false);
      assert.equal(JSON.stringify(items).includes(hash), false);
    }
  }
  assert.equal(library.getExploreWallTextVideos().some((item) => item.id === "explore-wall-text-21"), false);
  assert.equal(library.isExploreWallTextVideoId("explore-wall-text-21"), false);
  assert.equal(library.getExploreWallTextVideoAssetsForImport().some((item) => item.id === "explore-wall-text-21"), true);
});

test("Wall entries are retired only when their matching reclassified Hook is active", () => {
  const release = JSON.parse(readFileSync(new URL("../worker/src/lib/explore-hook-wall-reclassification-release.json", import.meta.url), "utf8"));
  const staged = loadLibrary();
  for (const n of ["06", "28", "59"]) assert.equal(staged.isExploreWallTextVideoId(`explore-wall-text-${n}`), true);
  const active = loadLibrary(release.items);
  for (const n of ["06", "28", "59"]) {
    assert.equal(active.isExploreWallTextVideoId(`explore-wall-text-${n}`), false);
    assert.equal(active.getExploreWallTextVideoAssetsForImport().some(item => item.id === `explore-wall-text-${n}`), true);
  }
  const wrongHash = loadLibrary(release.items.map(item => ({ ...item, videoSha256: "f".repeat(64) })));
  assert.equal(wrongHash.isExploreWallTextVideoId("explore-wall-text-06"), true);
});

test("Recreate and the legacy Explore API use the same filtered source library", () => {
  const catalogue = readFileSync(new URL("../lib/explore/recreate-catalog.ts", import.meta.url), "utf8");
  const directRoute = readFileSync(new URL("../app/api/explore/wall-text-videos/route.ts", import.meta.url), "utf8");
  assert.match(catalogue, /const existingWallText = getExploreWallTextVideos\(\)\.map/);
  assert.match(directRoute, /items: getExploreWallTextVideos\(\)/);
  assert.match(directRoute, /preview: getExploreWallTextPreviewVideo\(\)/);
});
