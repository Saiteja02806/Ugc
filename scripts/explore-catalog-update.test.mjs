import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import ts from "typescript";
import { mergeCatalogItems, orderedSlideFiles, prepareCatalog } from "./prepare-explore-catalog.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const old = { id: "old", format: "slideshow", title: "Fitness 01", category: "fitness", categoryLabel: "Fitness", posterFile: "first.png", slides: [{ id: "first", file: "first.png", width: 1080, height: 1350 }] };

test("additive rescans retain missing items, saved titles, IDs, and original order", () => {
  const original = structuredClone(old);
  const added = { ...old, id: "new", title: "Fitness 01" };
  const merged = mergeCatalogItems([old], [{ ...old, title: "Fitness 02" }, added]);
  assert.deepEqual(old, original);
  assert.deepEqual(merged[0], original);
  assert.equal(merged[1].title, "Fitness 02");
  assert.deepEqual(mergeCatalogItems(merged, []), merged);
  assert.deepEqual(mergeCatalogItems(merged, [{ ...old, title: "Fitness 30" }, added]), merged);
});

test("an existing ID cannot silently replace content or category", () => {
  assert.throws(() => mergeCatalogItems([old], [{ ...old, category: "study" }]), /Refusing to replace/);
  assert.throws(() => mergeCatalogItems([old, old], []), /duplicate IDs/);
});

async function withSources(run) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ugc-explore-catalog-test-"));
  const slidesRoot = path.join(directory, "slides");
  const wallRoot = path.join(directory, "wall");
  const hooksRoot = path.join(directory, "hooks");
  const setRoot = path.join(slidesRoot, "new category", "one complete slideshow");
  for (const folder of [setRoot, wallRoot, hooksRoot]) mkdirSync(folder, { recursive: true });
  try {
    for (const [name, color] of [["slide 1.png", "red"], ["slide 2.png", "green"], ["slide 10.png", "blue"]]) {
      await sharp({ create: { width: 4, height: 5, channels: 3, background: color } }).png().toFile(path.join(setRoot, name));
    }
    await run({ directory, slidesRoot, wallRoot, hooksRoot, setRoot });
  } finally {
    // Delete only the exact, uniquely created fixture directory within the OS temp root.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.match(path.basename(directory), /^ugc-explore-catalog-test-/);
    rmSync(directory, { recursive: true, force: true });
  }
}

test("dry run discovers categories and numeric slide order without writing or modifying source", async () => {
  await withSources(async ({ directory, slidesRoot, wallRoot, setRoot }) => {
    const manifestPath = path.join(directory, "catalog.json");
    const mediaRoot = path.join(directory, "media");
    const files = orderedSlideFiles(setRoot);
    assert.deepEqual(files, ["slide 1.png", "slide 2.png", "slide 10.png"]);
    const before = files.map((file) => hash(readFileSync(path.join(setRoot, file))));
    const { manifest, addedItems } = await prepareCatalog({ slidesRoot, wallRoot, manifestPath, mediaRoot });
    assert.equal(manifest.items.length, 1);
    assert.equal(addedItems.length, 1);
    assert.equal(manifest.items[0].category, "new-category");
    assert.equal(manifest.items[0].categoryLabel, "New Category");
    assert.deepEqual(manifest.items[0].slides.map((slide) => slide.file.slice(0, 64)), before);
    assert.equal(existsSync(manifestPath), false);
    assert.equal(existsSync(mediaRoot), false);
    assert.deepEqual(files.map((file) => hash(readFileSync(path.join(setRoot, file)))), before);
  });
});

test("local Hook staging preserves source audio and bytes, excludes duplicates, and is repeatable", async () => {
  await withSources(async ({ directory, slidesRoot, wallRoot, hooksRoot }) => {
    const input = path.join(hooksRoot, "hook.mp4");
    execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=90x160:r=2", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", input], { windowsHide: true });
    const sourceHash = hash(readFileSync(input));
    const options = { slidesRoot, wallRoot, hooksRoot, stage: true, manifestPath: path.join(directory, "catalog.json"), mediaRoot: path.join(directory, "media") };
    const first = await prepareCatalog(options);
    const hook = first.manifest.items.find((item) => item.format === "hook");
    assert.equal(hook.category, null);
    assert.equal(hash(readFileSync(path.join(options.mediaRoot, hook.videoFile))), sourceHash);
    assert.equal(hash(readFileSync(input)), sourceHash);
    const metadata = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", path.join(options.mediaRoot, hook.videoFile)], { encoding: "utf8", windowsHide: true }));
    assert.equal(metadata.streams.filter((stream) => stream.codec_type === "audio").length, 1);
    assert.equal(existsSync(path.join(options.mediaRoot, hook.posterFile)), true);
    const second = await prepareCatalog(options);
    assert.deepEqual(second.manifest, first.manifest);
    assert.equal(second.addedItems.length, 0);
    const omittedHookInput = await prepareCatalog({ ...options, hooksRoot: undefined });
    assert.deepEqual(omittedHookInput.manifest, first.manifest);
    const duplicate = await prepareCatalog({ ...options, stage: false, previousCatalog: null, knownHookHashes: [sourceHash] });
    assert.equal(duplicate.manifest.items.some((item) => item.format === "hook"), false);
    assert.deepEqual(duplicate.skippedHooks, ["hook.mp4"]);
  });
});

test("failed scans cannot erase the catalogue and published batches cannot be downgraded", async () => {
  await withSources(async ({ directory, slidesRoot, wallRoot, setRoot }) => {
    const manifestPath = path.join(directory, "catalog.json");
    const previous = JSON.stringify({ version: 1, mediaStatus: "published", release: "approved", items: [] });
    writeFileSync(manifestPath, previous);
    const options = { slidesRoot, wallRoot, stage: true, manifestPath, mediaRoot: path.join(directory, "media") };
    await assert.rejects(prepareCatalog(options), /Refusing to downgrade a published catalogue/);
    assert.equal(readFileSync(manifestPath, "utf8"), previous);
    mkdirSync(path.join(setRoot, "unexpected nesting"));
    await assert.rejects(prepareCatalog(options), /Unexpected nested slideshow/);
    assert.equal(readFileSync(manifestPath, "utf8"), previous);
    assert.equal(readdirSync(directory).includes("catalog.json.part"), false);
  });
});

function loadHookLibrary(status) {
  const source = readFileSync(new URL("../lib/explore/hook-video-library.ts", import.meta.url), "utf8");
  const catalog = JSON.parse(readFileSync(new URL("../lib/explore/imported-catalog.json", import.meta.url), "utf8"));
  catalog.mediaStatus = status;
  const loadedModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./imported-catalog.json") return catalog;
    if (specifier === "@/lib/explore/hook-video-types") return { getExploreVideoPosterStorageKey: (key) => key.replace(/\.mp4$/, ".webp") };
    if (specifier === "@/lib/storage/storage") return { buildPublicStorageUrl: (key) => `https://example.test/${key}` };
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require });
  return { library: loadedModule.exports, catalog };
}

test("staged Hook additions never enter the authenticated library or generation ID boundary", () => {
  const { library, catalog } = loadHookLibrary("staged");
  assert.equal(library.getExploreHookVideos().length, 14);
  for (const hook of catalog.items.filter((item) => item.format === "hook")) assert.equal(library.isExploreHookVideoId(hook.id), false);
  assert.equal(library.isExploreHookVideoId("explore-hook-01"), true);
});

test("a later verified publication recognizes added Hook IDs exactly once", () => {
  const { library, catalog } = loadHookLibrary("published");
  const hooks = library.getExploreHookVideos();
  assert.equal(hooks.length, 21);
  assert.equal(new Set(hooks.map((item) => item.id)).size, 21);
  for (const item of catalog.items.filter((item) => item.format === "hook")) {
    assert.equal(library.isExploreHookVideoId(item.id), true);
    assert.equal(hooks.find((hook) => hook.id === item.id).videoUrl, `https://example.test/explore/recreate/v1/${item.videoFile}`);
  }
});

function loadRecreateCatalog(status, environment = "development") {
  const { library, catalog } = loadHookLibrary(status);
  const source = readFileSync(new URL("../lib/explore/recreate-catalog.ts", import.meta.url), "utf8");
  const loadedModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./imported-catalog.json") return catalog;
    if (specifier === "./hook-video-library") return library;
    if (specifier === "./wall-text-video-library") return { getExploreWallTextVideos: () => [] };
    if (specifier === "@/lib/storage/storage") return { buildPublicStorageUrl: (key) => `https://example.test/${key}` };
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require, process: { env: { NODE_ENV: environment } } });
  return { library: loadedModule.exports, catalog };
}

test("local Recreate includes all staged additions, with unique Hook labels and no production preview", () => {
  const { library, catalog } = loadRecreateCatalog("staged");
  const local = library.getLocalRecreateReferences();
  assert.equal(local.length, 14 + catalog.items.length);
  const hooks = local.filter((item) => item.format === "hook");
  assert.equal(hooks.length, 21);
  assert.equal(new Set(hooks.map((item) => item.title)).size, 21);
  assert.equal(hooks[14].title, "Hook 15");
  assert.equal(hooks[20].title, "Hook 21");
  assert.equal(hooks[20].videoUrl.startsWith("/api/explore/local-media/"), true);
  assert.equal(library.getRecreateReferences().length, 14);
  assert.equal(loadRecreateCatalog("staged", "production").library.getLocalRecreateReferences().length, 0);
});

test("verified publication exposes imported Hooks once and preserves local/live reference order", () => {
  const { library, catalog } = loadRecreateCatalog("published");
  const live = library.getRecreateReferences();
  const local = library.getLocalRecreateReferences();
  assert.equal(live.length, 14 + catalog.items.length);
  assert.equal(new Set(live.map((item) => item.id)).size, live.length);
  assert.equal(live.filter((item) => item.format === "hook").length, 21);
  assert.deepEqual(local.map((item) => item.id), live.map((item) => item.id));
  assert.equal(live.every((item) => !item.posterUrl.startsWith("/api/explore/local-media/")), true);
});
