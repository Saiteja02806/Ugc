import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { prepareSlideshowReferenceUpdate } from "./prepare-slideshow-reference-update.mjs";
import { canonicalSlideshowSource } from "../lib/explore/reference-source-link.ts";

const read = name => JSON.parse(readFileSync(new URL(`../lib/explore/${name}.json`, import.meta.url), "utf8"));
const catalog = read("imported-catalog"), additions = read("slideshow-reference-additions"), sources = read("slideshow-reference-sources");

test("the approved release preserves all historical items and stages 13 complete ordered additions", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(catalog.items)).digest("hex").slice(0, 20), "ec1d17715e95dba5519a");
  assert.equal(additions.mediaStatus, "staged");
  assert.equal(additions.items.length, 13);
  assert.equal(additions.items.reduce((n, item) => n + item.slides.length, 0), 60);
  assert.deepEqual(additions.items.reduce((counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }), {}), { "calory-tracking": 4, fitness: 8, skincare: 1 });
  const all = [...catalog.items, ...additions.items];
  assert.equal(new Set(all.map(item => item.id)).size, all.length);
  for (const item of additions.items) {
    assert.equal(item.posterFile, item.slides[0].file);
    item.slides.forEach((slide, i) => { assert.equal(slide.id, `slide-${i + 1}-${slide.file.slice(0, 12)}`); assert.ok(slide.width > 0 && slide.height > 0); });
  }
});

test("all 38 approved mappings resolve, including repeated sources and the Marketing parent-file mapping", () => {
  const all = [...catalog.items, ...additions.items], ids = new Set(all.filter(item => item.format === "slideshow").map(item => item.id));
  assert.equal(sources.items.length, 38);
  assert.equal(new Set(sources.items.map(item => item.referenceId)).size, 38);
  assert.equal(sources.items.filter(item => item.sourceKind === "profile").length, 10);
  assert.equal(sources.items.filter(item => item.sourceKind === "post").length, 28);
  for (const source of sources.items) {
    assert.ok(ids.has(source.referenceId));
    assert.deepEqual(canonicalSlideshowSource(source.sourceUrl), { url: source.sourceUrl, platform: source.sourcePlatform, kind: source.sourceKind });
  }
  assert.equal(sources.items.find(item => item.referenceId === "explore-slideshow-marketing-4a4af0499a0ab6eb").sourceUrl, "https://www.tiktok.com/@clothingbrandz.2");
  assert.equal(sources.items.filter(item => item.sourceUrl === "https://www.tiktok.com/@maddieellisfitnes/photo/7617820692473531670").length, 2);
});

test("staged media stays out of authenticated references while local previews retain source links", async () => {
  process.env.GCP_STORAGE_BUCKET = "slideshow-fixture"; process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://media.fixture.test";
  const { getRecreateReferences, getRecreateReference, getLocalRecreateReferences } = await import("../lib/explore/recreate-catalog.ts");
  const live = getRecreateReferences().filter(item => item.format === "slideshow");
  assert.equal(live.length, 59); assert.equal(live.filter(item => item.sourceUrl).length, 25);
  for (const item of additions.items) assert.equal(getRecreateReference(item.id), undefined);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    const local = getLocalRecreateReferences().filter(item => item.format === "slideshow");
    assert.equal(local.length, 72); assert.equal(local.filter(item => item.sourceUrl).length, 38);
    for (const item of additions.items) assert.match(local.find(ref => ref.id === item.id).posterUrl, /^\/api\/explore\/local-media\//);
    process.env.NODE_ENV = "production"; assert.deepEqual(getLocalRecreateReferences(), []);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("additive preparation preserves an existing renamed reference and reads its parent source without altering images", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ugc-slideshow-sources-"));
  try {
    const sourceRoot = path.join(directory, "source"), set = path.join(sourceRoot, "focus", "one"), stageDirectory = path.join(directory, "stage");
    mkdirSync(set, { recursive: true });
    const slides = [];
    for (const [index, color] of ["red", "blue"].entries()) {
      const bytes = await sharp({ create: { width: 4, height: 5, channels: 3, background: color } }).png().toBuffer();
      const digest = createHash("sha256").update(bytes).digest("hex"); writeFileSync(path.join(set, `${index + 1}.png`), bytes);
      slides.push({ id: `slide-${index + 1}-${digest.slice(0, 12)}`, file: `${digest}.png`, width: 4, height: 5 });
    }
    const original = { id: "stable-old-id", format: "slideshow", title: "Focus 01", category: "focus", categoryLabel: "Focus", posterFile: slides[0].file, slides };
    const baseline = { version: 1, mediaStatus: "published", items: [original, { ...original, id: "missing-but-preserved", slides: [{ ...slides[0], file: `${"a".repeat(64)}.png` }, slides[1]] }] };
    writeFileSync(path.join(sourceRoot, "focus", "New Text Document.txt"), "https://www.tiktok.com/@creator?");
    const result = await prepareSlideshowReferenceUpdate({ sourceRoot, catalog: baseline, stageDirectory });
    assert.deepEqual(result.manifest.items, baseline.items); assert.equal(result.additions.length, 0);
    assert.equal(result.sources.items[0].referenceId, original.id);
    assert.equal(result.sources.items[0].sourceKind, "profile");
    const again = await prepareSlideshowReferenceUpdate({ sourceRoot, catalog: result.manifest, stageDirectory });
    assert.deepEqual(again.manifest, result.manifest); assert.deepEqual(again.sources, result.sources);
    const fresh = await prepareSlideshowReferenceUpdate({ sourceRoot, catalog: { ...baseline, items: [] }, stageDirectory });
    assert.equal(fresh.additions.length, 1); assert.equal(fresh.manifest.mediaStatus, "staged");
    assert.equal(JSON.parse(readFileSync(path.join(stageDirectory, "upload-manifest.json"), "utf8")).mediaStatus, "staged");
  } finally { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); assert.match(path.basename(directory), /^ugc-slideshow-sources-/); rmSync(directory, { recursive: true, force: true }); }
});
