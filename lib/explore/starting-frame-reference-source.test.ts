import assert from "node:assert/strict";
import test from "node:test";
import { getAdditionalStartingFrameSources } from "./starting-frame-reference-source.ts";
import { getTalkingHeadReferences } from "./talking-head-reference-catalog.ts";
import { createHookSourceFrameService, resolveStartingFrameSource } from "./hook-source-frame.ts";
import { getRecreateReferences } from "./recreate-catalog.ts";
import importedCatalog from "./imported-catalog.json" with { type: "json" };

test("every selectable Wall reference resolves to its immutable source, including all published imports", async t => {
  const previousBucket = process.env.GCP_STORAGE_BUCKET;
  const previousBase = process.env.GCP_STORAGE_PUBLIC_BASE_URL;
  process.env.GCP_STORAGE_BUCKET ??= "source-registry-test";
  process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= "https://storage.example.test/source-registry-test";
  t.after(() => {
    if (previousBucket === undefined) delete process.env.GCP_STORAGE_BUCKET; else process.env.GCP_STORAGE_BUCKET = previousBucket;
    if (previousBase === undefined) delete process.env.GCP_STORAGE_PUBLIC_BASE_URL; else process.env.GCP_STORAGE_PUBLIC_BASE_URL = previousBase;
  });
  const references = getRecreateReferences().filter(item => item.format === "wall_text");
  const imports = importedCatalog.items.filter(item => item.format === "wall_text" && "videoFile" in item);
  assert.equal(imports.length, 28);
  for (const reference of references) {
    const source = await resolveStartingFrameSource(reference.id);
    assert.equal(source.workflow, "wall_text", reference.id);
    assert.match(source.videoSha256, /^[a-f0-9]{64}$/);
    const imported = imports.find(item => item.id === reference.id);
    if (imported && "videoFile" in imported && typeof imported.videoFile === "string") {
      assert.equal(source.videoSha256, imported.videoFile.slice(0, -4));
      assert.equal(source.videoStorageKey, `explore/recreate/v1/${imported.videoFile}`);
    }
  }
  for (const imported of imports) assert.ok(references.some(item => item.id === imported.id));
  const sources = getAdditionalStartingFrameSources();
  assert.equal(new Set(sources.map(source => source.id)).size, sources.length);
});

test("the source registry covers packaged Talking Head references and keeps retired Wall IDs unavailable", async () => {
  const sources = getAdditionalStartingFrameSources();
  assert.equal(new Set(sources.map(source => source.id)).size, sources.length);
  const talking = getTalkingHeadReferences();
  assert.equal(talking.length, 23);
  assert.equal(talking.find(item => item.id === "talking-websites-explainer")?.sourcePlatform, "instagram");
  assert.equal(talking.find(item => item.id === "talking-sophia-designsthings")?.sourcePlatform, "tiktok");
  for (const reference of talking) {
    const source = await resolveStartingFrameSource(reference.id);
    assert.equal(source.workflow, "talking_head");
    assert.equal(source.localFile, reference.videoUrl);
    assert.equal(source.videoSha256, reference.sourceSha256);
    assert.match(source.videoSha256, /^[a-f0-9]{64}$/);
  }
  for (const id of ["explore-wall-text-01", "explore-wall-text-08", "explore-wall-text-09"]) {
    await assert.rejects(resolveStartingFrameSource(id), { status: 404 });
  }
  const wall = await resolveStartingFrameSource("explore-wall-text-02");
  assert.equal(wall.workflow, "wall_text");
  assert.ok(sources.some(source => source.workflow === "wall_text" && source.id.startsWith("explore-paired-")));
});

test("every packaged Talking Head video yields its real hash-verified first frame at full resolution", async () => {
  const getFrame = createHookSourceFrameService();
  for (const reference of getTalkingHeadReferences()) {
    const source = await resolveStartingFrameSource(reference.id);
    const frame = await getFrame(reference.id);
    assert.equal(frame.workflow, "talking_head");
    assert.equal(frame.sourceSha256, reference.sourceSha256);
    assert.equal(frame.frameIndex, 0);
    assert.equal(frame.width, source.width); assert.equal(frame.height, source.height);
    assert.equal(frame.png.readUInt32BE(16), source.width); assert.equal(frame.png.readUInt32BE(20), source.height);
  }
});


test("Talking Head request preparation reads verified PNGs and never downloads or decodes MP4", async () => {
  let decodes = 0, downloads = 0;
  const read = createHookSourceFrameService({ decode: async () => { decodes++; throw Error("Unexpected decode"); }, download: async () => { downloads++; throw Error("Unexpected download"); }, maxCacheEntries: 0 });
  for (const reference of getTalkingHeadReferences()) {
    const frame = await read(reference.id);
    assert.equal(frame.workflow, "talking_head");
    assert.equal(frame.sourceSha256, reference.sourceSha256);
    assert.equal(frame.frameTimeSeconds, 0);
    assert.equal(frame.frameIndex, 0);
  }
  assert.equal(decodes, 0); assert.equal(downloads, 0);
});
