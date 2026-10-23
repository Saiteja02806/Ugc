import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import release from "../worker/src/lib/explore-hook-reference-release.json" with { type: "json" };
import additions from "../worker/src/lib/explore-hook-reference-addition-release.json" with { type: "json" };
import newBatch from "../worker/src/lib/explore-hook-reference-new-batch-release.json" with { type: "json" };
import octoberBatch from "../worker/src/lib/explore-hook-reference-oct23-release.json" with { type: "json" };
import octoberRefresh from "../worker/src/lib/explore-hook-reference-oct23-refresh-release.json" with { type: "json" };
import legacy from "../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };
import textCatalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };
import { validateHookRelease } from "./hook-reference-release-readiness.mjs";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";
import { scanHookRelease } from "./prepare-hook-reference-release.mjs";
import { canonicalInstagramSource } from "../worker/src/lib/explore-instagram-source.ts";
import { filterReferences } from "../lib/explore/recreate-types.ts";
import { resolveRemixSource } from "../lib/explore/remix-source.ts";
import { remixInputSource } from "../lib/explore/remix-text-input.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
import { validateRemixOutput } from "../lib/explore/reference-text.ts";
import { formatTextLayout } from "../worker/src/lib/explore-format-edit.ts";

process.env.GCP_STORAGE_BUCKET = "hook-release-offline-fixture";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://catalogue.example.test";
mock.module(new URL("../worker/src/lib/explore-hook-reference-release.json", import.meta.url), { defaultExport: { ...release, mediaStatus: "published", activation: "active" } });
mock.module(new URL("../worker/src/lib/explore-hook-reference-addition-release.json", import.meta.url), { defaultExport: { ...additions, mediaStatus: "published", activation: "active" } });
mock.module(new URL("../worker/src/lib/explore-hook-reference-new-batch-release.json", import.meta.url), { defaultExport: { ...newBatch, mediaStatus: "published", activation: "active" } });
const { getRecreateReferences, getRecreateReference, getArchivedHookReferences, getLocalRecreateReferences } = await import("../lib/explore/recreate-catalog.ts");
const { getReferenceText } = await import("../lib/explore/reference-text-store.ts");
const { getExplorePairedReference, getAssetReferenceSoundtrack } = await import("../worker/src/lib/explore-reference-soundtrack.ts");

test("the active Hook gallery retains reviewed source links and respects silent preview decisions", () => {
  const ready = validateHookRelease(release, textCatalog), additionReady = validateHookAdditionRelease(additions, textCatalog), hooks = getRecreateReferences().filter(item => item.format === "hook");
  const batchReady = validateHookAdditionRelease(newBatch, textCatalog);
  const octoberReady = validateHookAdditionRelease(octoberBatch, textCatalog);
  const refreshReady = validateHookAdditionRelease(octoberRefresh, textCatalog);
  const expected = [...ready.eligible, ...additionReady.eligible, ...batchReady.eligible, ...octoberReady.eligible, ...refreshReady.eligible];
  assert.equal(ready.eligible.length, 45); assert.equal(release.items.length, 46);
  assert.equal(additionReady.eligible.length, 31); assert.equal(additions.items.length, 31);
  assert.equal(batchReady.eligible.length, 22);
  assert.equal(octoberReady.eligible.length, 1);
  assert.equal(refreshReady.eligible.length, 8);
  assert.equal(hooks.length, 107); assert.deepEqual(hooks.map(item => item.id), expected.map(item => item.id));
  assert.deepEqual(hooks.map(item => item.title), Array(107).fill("Hook"));
  for (const hook of hooks) {
    const registered = [...release.items, ...additions.items, ...newBatch.items, ...octoberBatch.items, ...octoberRefresh.items].find(item => item.id === hook.id);
    assert.equal(hook.instagramUrl, registered.instagramUrl);
    assert.equal(hook.sourceUrl, registered.sourceUrl ?? registered.instagramUrl);
    assert.equal(hook.sourcePlatform, registered.sourcePlatform ?? (registered.instagramUrl ? "instagram" : undefined));
    if (registered.audioPolicy === "silent") {
      assert.equal(hook.previewVideoUrl, hook.videoUrl);
      assert.equal(hook.pairedAudio, undefined);
    } else {
      // A native-audio source can be its own soundtrack preview without remuxing.
      if (registered.previewSha256 === registered.videoSha256) assert.equal(hook.previewVideoUrl, hook.videoUrl);
      else assert.notEqual(hook.previewVideoUrl, hook.videoUrl);
      assert.ok(hook.previewVideoUrl.endsWith(`${registered.previewSha256}.mp4`));
      assert.ok(hook.pairedAudio.url.endsWith(`${registered.audioSha256}.mp3`));
    }
    assert.ok(hook.videoUrl.endsWith(`${registered.videoSha256}.mp4`));
    assert.equal(getReferenceText(hook.id, null, "hook").status, textCatalog.items.find(item => item.referenceId === hook.id && item.slideId === null).status);
    assert.equal(getExplorePairedReference(hook.id).audioSha256, registered.audioSha256);
  }
  assert.equal(hooks.some(item => release.excludedReferenceIds.includes(item.id)), false);
});

test("retired references still resolve saved remix/video/audio identities without returning to browsing", () => {
  const archives = getArchivedHookReferences(), refs = [...getRecreateReferences(), ...archives];
  assert.ok(archives.some(item => item.id === "explore-hook-01"));
  assert.ok(!filterReferences(refs, "hook", []).some(item => item.archived));
  for (const archived of archives) {
    assert.equal(getRecreateReference(archived.id).id, archived.id);
    assert.equal(resolveRemixSource({ format: "hook", referenceId: archived.id, sourceUrl: archived.videoUrl }, refs, "hook").reference.id, archived.id);
    assert.doesNotThrow(() => getReferenceText(archived.id, null, "hook"));
  }
  for (const item of legacy.items) assert.equal(getExplorePairedReference(item.id).audioSha256, item.audioSha256);
  const old = legacy.items[0];
  assert.equal(getAssetReferenceSoundtrack({ render: { referenceSoundtrack: { version: 1, referenceId: old.id, audioSha256: old.audioSha256, volume: .35 } } }).volume, .35);
  assert.deepEqual(getRecreateReferences().filter(item => item.format !== "hook"), getRecreateReferences(true).filter(item => item.format !== "hook"));
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = "development";
  try { assert.equal(getLocalRecreateReferences().filter(item => item.format === "hook").length, 107); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("reviewed current captions preserve their retained timing and audio through remix", () => {
  for (const hook of getRecreateReferences().filter(item => item.format === "hook")) {
    const source = getReferenceText(hook.id, null, "hook");
    const original = structuredClone(source);
    if (source.status === "no_text") { assert.deepEqual(source.blocks, []); continue; }
    const input = remixInputSource({ requestKey: "00000000-0000-4000-8000-000000000001", referenceId: hook.id, slideId: null,
      format: "hook", instructions: "", referenceBlocks: source.blocks.map(block => block.text) }, source);
    assert.deepEqual(input.blocks, source.blocks, hook.id);
    assert.deepEqual(source, original, "The original reviewed transcription stays intact");
    // Use deterministic copy, so the test verifies integration without a paid AI call.
    const output = validateRemixOutput({ blocks: input.blocks.map(block => block.text), heading: "", body: "" }, input);
    for (const duration of [3000, 5000, 10000]) {
      const editing = { version: 1, format: "hook", trimStartMs: 500, trimEndMs: duration + 500, originalVolume: .6, musicVolume: .35, text: null };
      const applied = applyVideoTextRemix(editing, output, input);
      assert.deepEqual(applied.textOverlays.map(block => block.value), output.blocks, hook.id);
      assert.equal(applied.musicVolume, .35); assert.equal(applied.originalVolume, .6);
      assert.equal(applied.trimStartMs, 500); assert.equal(applied.trimEndMs, duration + 500);
      const end = Math.max(...input.blocks.map(block => block.endMs));
      for (const [i, overlay] of applied.textOverlays.entries()) {
        assert.equal(overlay.startMs, Math.min(duration - 1, Math.round(input.blocks[i].startMs / end * duration)));
        assert.ok(overlay.endMs > overlay.startMs && overlay.endMs <= duration, hook.id);
        assert.ok(formatTextLayout(overlay, 1080, 1920).fits, `Caption fits for ${hook.id}`);
      }
    }
  }
});

test("activation rejects missing/unreviewed text, stale source hashes, invalid media mappings and unsupported lengths", () => {
  const id = release.items.find(item => !release.excludedReferenceIds.includes(item.id)).id;
  for (const change of [undefined, { status: "needs_review" }, { sourceSha256: "0".repeat(64) }]) {
    const texts = structuredClone(textCatalog); texts.items = texts.items.flatMap(item => item.referenceId !== id ? [item] : change ? [{ ...item, ...change }] : []);
    assert.throws(() => validateHookRelease(release, texts), /reviewed|match/);
  }
  for (const change of [{ audioStorageKey: "other.mp3" }, { durationSeconds: 16 }, { instagramUrl: "https://instagram.com.evil.test/reel/source/" }]) {
    const value = structuredClone(release); Object.assign(value.items.find(item => item.id === id), change);
    assert.throws(() => validateHookRelease(value, textCatalog), /mapping|limit|Instagram/);
  }
  const duplicate = structuredClone(release); duplicate.items.push(duplicate.items[0]);
  assert.throws(() => validateHookRelease(duplicate, textCatalog), /duplicate/);
});

test("source links lose tracking parameters and reject scripts, credentials, unrelated hosts and non-post URLs", () => {
  assert.equal(canonicalInstagramSource("https://www.instagram.com/reel/Ab_C-12/?utm_source=copy#fragment"), "https://www.instagram.com/reel/Ab_C-12/");
  for (const value of ["javascript:alert(1)", "http://instagram.com/reel/abc/", "https://user:pass@instagram.com/reel/abc/", "https://instagram.com.evil.test/reel/abc/", "https://www.instagram.com/accounts/login/", "https://instagram.com/reel/abc/extra", null]) assert.equal(canonicalInstagramSource(value), null);
});

test("folder import binds MP4, MP3 and source URL together and rejects extra or ambiguous files", async t => {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true }); const directory = await mkdtemp(join(parent, "hook-source-test-"));
  t.after(async () => { assert.equal(dirname(directory), parent); assert.ok(basename(directory).startsWith("hook-source-test-")); await rm(directory, { recursive: true, force: true }); });
  const folder = join(directory, "one"); await mkdir(folder);
  await writeFile(join(folder, "clip.mp4"), "video"); await writeFile(join(folder, "track.mp3"), "audio"); await writeFile(join(folder, "source.txt"), "https://www.instagram.com/reel/abc/?utm_source=copy");
  assert.equal(scanHookRelease(directory)[0].instagramUrl, "https://www.instagram.com/reel/abc/");
  await writeFile(join(folder, "extra.mp3"), "ambiguous"); assert.throws(() => scanHookRelease(directory), /exactly one/);
});
