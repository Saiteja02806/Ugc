import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";
import { filterReferences, interleaveReferenceCategories, prioritizeRecentReferences } from "../lib/explore/recreate-types.ts";
import { getHookReferenceGalleryItems } from "../worker/src/lib/explore-hook-reference-release.ts";
import { getHookKeyframeMotionReviewDraft } from "../lib/explore/hook-keyframe-motion.ts";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";

const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const slideshows = json("../lib/explore/slideshow-reference-oct23.json");
const hookRelease = json("../worker/src/lib/explore-hook-reference-oct23-release.json");
const hookRefresh = json("../worker/src/lib/explore-hook-reference-oct23-refresh-release.json");
const text = json("../lib/explore/reference-text-catalog.json");
const base = json("../lib/explore/imported-catalog.json");
const hook = hookRelease.items[0];
mock.module("../lib/storage/storage.ts", { namedExports: { buildPublicStorageUrl: key => `https://media.test/${key}` } });
const { getRecreateReferences } = await import("../lib/explore/recreate-catalog.ts");

test("October import keeps four ordered image-only slideshows and all thirteen source-bound text reviews", () => {
  assert.equal(slideshows.mediaStatus, "published");
  assert.deepEqual(slideshows.items.map(item => item.slides.length), [3, 6, 2, 2]);
  for (const item of slideshows.items) {
    assert.equal(item.format, "slideshow");
    assert.equal(item.category, null);
    assert.equal(item.categoryLabel, null);
    assert.equal(item.posterFile, item.slides[0].file);
    assert.equal(item.videoFile, undefined);
    for (const [index, slide] of item.slides.entries()) {
      assert.match(slide.id, new RegExp(`^slide-${index + 1}-`));
      assert.match(slide.file, /^[a-f0-9]{64}\.(png|jpg)$/);
      assert.ok(slide.width > 0 && slide.height > 0);
      const matches = text.items.filter(record => record.referenceId === item.id && record.slideId === slide.id);
      assert.equal(matches.length, 1);
      const record = ReferenceTextSchema.parse(matches[0]);
      assert.equal(record.sourceSha256, slide.file.split(".")[0]);
      assert.equal(record.status, "ready");
      assert.ok(record.blocks.length > 0);
    }
  }
});

test("the real catalog places the new batch first in each workflow and preserves earlier slideshow identities", () => {
  const references = getRecreateReferences();
  assert.equal(new Set(references.map(item => item.id)).size, references.length);
  const expected = { hook: hookRefresh.items.map(item => item.id), slideshow: slideshows.items.map(item => item.id), wall_text: [] };
  assert.equal(references.find(item => item.id === hook.id).isNew, undefined, "The next Hook batch retires only the prior Hook badge.");
  for (const [format, ids] of Object.entries(expected)) {
    const matching = filterReferences(references, format, []);
    const ordered = prioritizeRecentReferences(format === "slideshow" ? interleaveReferenceCategories(matching) : matching);
    assert.deepEqual(new Set(ordered.filter(item => item.isNew).map(item => item.id)), new Set(ids));
    assert.deepEqual(new Set(ordered.slice(0, ids.length).map(item => item.id)), new Set(ids));
  }
  for (const item of base.items.filter(item => item.format === "slideshow")) {
    const reference = references.find(reference => reference.id === item.id);
    assert.ok(reference);
    assert.deepEqual(reference.slides.map(slide => slide.id), item.slides.map(slide => slide.id));
    assert.equal(reference.isNew, undefined);
  }
  for (const item of slideshows.items) assert.equal(references.find(reference => reference.id === item.id).sourceUrl, undefined);
});

test("the Hook retains the reaction-only source, verified TikTok link, native audio mapping and frame-bound review", () => {
  assert.equal(hookRelease.mediaStatus, "published");
  assert.equal(hookRelease.activation, "active");
  assert.equal(hookRelease.items.length, 1);
  assert.equal(hook.id, "explore-paired-hook-17133540b2315e0a3a05bfbd");
  assert.equal(hook.durationSeconds, 4.1);
  assert.equal(hook.sourceUrl, "https://www.tiktok.com/@tweetytakespics/video/7647168888169450784");
  assert.equal(hook.sourcePlatform, "tiktok");
  assert.equal(hook.previewStorageKey, hook.videoStorageKey);
  assert.equal(hook.previewSha256, hook.videoSha256);
  assert.ok(Math.abs(hook.audioDurationSeconds - hook.durationSeconds) < 0.05);
  const { eligible } = validateHookAdditionRelease(hookRelease, text);
  assert.equal(eligible.length, 1);
  assert.equal(getHookReferenceGalleryItems().find(item => item.id === hook.id)?.videoSha256, hook.videoSha256);
  const reference = getRecreateReferences().find(item => item.id === hook.id);
  assert.ok(reference.pairedAudio);
  assert.match(reference.generationPrompt, /raised hand across the mouth/);
  const motion = getHookKeyframeMotionReviewDraft(hook.id, hook.videoSha256);
  assert.ok(motion.candidatePlan);
  assert.equal(motion.canSubmitPaidAnimation, false);
});

test("local staged slideshow media uses the exact manifest allowlist and remains unavailable in production", async () => {
  const exports = {}, reads = [], process = { env: { NODE_ENV: "development" }, cwd: () => "C:/fixture" };
  const dependencies = {
    "node:fs/promises": { readFile: async file => { reads.push(file); return Buffer.from([1, 2, 3, 4]); } },
    "node:path": { default: path },
    "@/lib/explore/imported-catalog.json": { default: base },
    "@/lib/explore/slideshow-reference-additions.json": { default: json("../lib/explore/slideshow-reference-additions.json") },
    "@/lib/explore/slideshow-reference-oct23.json": { default: slideshows },
  };
  const source = readFileSync(new URL("../app/api/explore/local-media/[file]/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, process, Response, Headers, Buffer, Uint8Array, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } });
  const file = slideshows.items[0].slides[0].file;
  const params = { params: Promise.resolve({ file }) };
  const response = await exports.GET(new Request("http://fixture.test/"), params);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(reads[0], path.join("C:/fixture", ".tmp", "explore-upload-batch-20261023", "media", file));
  assert.equal((await exports.GET(new Request("http://fixture.test/"), { params: Promise.resolve({ file: "../secrets.png" }) })).status, 404);
  assert.equal((await exports.GET(new Request("http://fixture.test/"), { params: Promise.resolve({ file: `${"0".repeat(64)}.png` }) })).status, 404);
  process.env.NODE_ENV = "production";
  assert.equal((await exports.GET(new Request("http://fixture.test/"), params)).status, 404);
  assert.equal(reads.length, 1);
});
