import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import release from "../worker/src/lib/explore-hook-reference-release.json" with { type: "json" };
import browserPreviews from "../lib/explore/browser-reference-previews.json" with { type: "json" };
import additions from "../worker/src/lib/explore-hook-reference-addition-release.json" with { type: "json" };
import newBatch from "../worker/src/lib/explore-hook-reference-new-batch-release.json" with { type: "json" };
import octoberBatch from "../worker/src/lib/explore-hook-reference-oct23-release.json" with { type: "json" };
import octoberRefresh from "../worker/src/lib/explore-hook-reference-oct23-refresh-release.json" with { type: "json" };
import reclassified from "../worker/src/lib/explore-hook-wall-reclassification-release.json" with { type: "json" };
import notbeen3 from "../worker/src/lib/explore-hook-notbeen3-release.json" with { type: "json" };
import notbeen3Text from "../lib/explore/hook-notbeen3-text.json" with { type: "json" };
import notbeen2 from "../worker/src/lib/explore-hook-notbeen2-release.json" with { type: "json" };
import reclassifiedText from "../lib/explore/hook-wall-reclassification-text.json" with { type: "json" };
import notbeen2Text from "../lib/explore/hook-notbeen2-text.json" with { type: "json" };
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
  const notbeenReady = validateHookAdditionRelease(notbeen2, { items: notbeen2Text.items });
  const latestReady = validateHookAdditionRelease(notbeen3, { items: notbeen3Text.items });
  const expected = [...ready.eligible, ...additionReady.eligible, ...batchReady.eligible, ...octoberReady.eligible, ...refreshReady.eligible, ...reclassified.items.filter(item => !reclassified.excludedReferenceIds.includes(item.id)), ...notbeenReady.eligible, ...latestReady.eligible];
  assert.equal(ready.eligible.length, 42); assert.equal(release.items.length, 45);
  assert.equal(additionReady.eligible.length, 30); assert.equal(additions.items.length, 31);
  assert.equal(batchReady.eligible.length, 21);
  assert.equal(octoberReady.eligible.length, 1);
  assert.equal(refreshReady.eligible.length, 7);
  assert.equal(notbeenReady.eligible.length, 18);
  assert.equal(hooks.length, 129); assert.deepEqual(hooks.map(item => item.id), expected.map(item => item.id));
  assert.deepEqual(hooks.map(item => item.title), Array(129).fill("Hook"));
  assert.equal(hooks.some(item => item.id === "explore-paired-hook-6070b6ecbe246d879ce0bdcb"), false);
  assert.equal(hooks.some(item => item.sourceUrl === "https://www.instagram.com/reel/DeQwSJTxiza/"), false);
  for (const hook of hooks) {
    const registered = [...release.items, ...additions.items, ...newBatch.items, ...octoberBatch.items, ...octoberRefresh.items, ...reclassified.items, ...notbeen2.items, ...notbeen3.items].find(item => item.id === hook.id);
    assert.equal(hook.instagramUrl, registered.instagramUrl);
    assert.equal(hook.sourceUrl, registered.sourceUrl ?? registered.instagramUrl);
    assert.equal(hook.sourcePlatform, registered.sourcePlatform ?? (registered.instagramUrl ? "instagram" : undefined));
    if (registered.audioPolicy === "silent") {
      const browserPreview = browserPreviews.items.find(row => row.referenceId === hook.id && row.sourceStorageKey === registered.videoStorageKey && row.audioPolicy === "silent");
      if (browserPreview) assert.ok(hook.previewVideoUrl.endsWith(browserPreview.previewStorageKey));
      else assert.equal(hook.previewVideoUrl, hook.videoUrl);
      assert.equal(hook.pairedAudio, undefined);
    } else {
      // A native-audio source can be its own soundtrack preview without remuxing.
      if (registered.previewSha256 === registered.videoSha256) assert.equal(hook.previewVideoUrl, hook.videoUrl);
      else assert.notEqual(hook.previewVideoUrl, hook.videoUrl);
      assert.ok(hook.previewVideoUrl.endsWith(`${registered.previewSha256}.mp4`));
      assert.ok(hook.pairedAudio.url.endsWith(`${registered.audioSha256}.mp3`));
    }
    assert.ok(hook.videoUrl.endsWith(`${registered.videoSha256}.mp4`));
    assert.equal(getReferenceText(hook.id, null, "hook").status, [...textCatalog.items, ...reclassifiedText.items, ...notbeen2Text.items, ...notbeen3Text.items].find(item => item.referenceId === hook.id && item.slideId === null).status);
    assert.equal(getExplorePairedReference(hook.id).audioSha256, registered.audioSha256);
  }
  assert.equal(hooks.some(item => release.excludedReferenceIds.includes(item.id)), false);
});

test("Hook 121 uses the approved 2.600-second cut across gallery, caption and Recreate", async () => {
  const referenceId = "explore-paired-hook-8d1bbacd825c45f74e3eb78a";
  const sourceSha256 = "8caa12e6de5bc31c4d5393369bb6635dde87918dc2e146ac048b286afee56cf4";
  const oldSha256 = "9946c9c20f1c664951097e9a24baf0852c336ad4557ad92b6d6635ba712ba995";
  const reference = getRecreateReference(referenceId);
  assert.equal(reference.durationSeconds, 2.6);
  assert.ok(reference.videoUrl.endsWith(sourceSha256 + ".mp4"));
  assert.ok(reference.previewVideoUrl.endsWith("eff64c89e8aa9d1394515cbce7da65e72ef5ceaaad5d42b7ffd484886602e33d.mp4"));
  const caption = getReferenceText(referenceId, null, "hook");
  assert.equal(caption.sourceSha256, sourceSha256);
  assert.equal(caption.blocks.at(-1).endMs, 2600);
  const { getReferenceVideoPrompt } = await import("../lib/explore/reference-video-prompts.ts");
  const { createHookKeyframeDraft, updateHookKeyframeDraft } = await import("../lib/explore/hook-keyframe-draft.ts");
  const { getHookKeyframePromptPreview } = await import("../lib/explore/hook-keyframe-prompt-preview.ts");
  const draft = updateHookKeyframeDraft(createHookKeyframeDraft({
    ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId, sourceSha256,
  }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
  const preview = getHookKeyframePromptPreview(draft, "hook", undefined, undefined, undefined, 2.6);
  assert.equal(preview.animationError, null);
  assert.equal(preview.requiresDecision, false);
  const openingEnd = Number(preview.animationPrompt.match(/OPENING: 0–([\d.]+)s:/)?.[1]);
  assert.ok(Math.abs(openingEnd - 1.5) < 0.02, "Displayed phase rounding stays within one source frame");
  assert.match(preview.animationPrompt, /MIDDLE: [\d.]+–1\.9s:/);
  assert.match(preview.animationPrompt, /FINAL HOLD 2\.6–3s:/);
  assert.match(getReferenceVideoPrompt(referenceId, reference.videoUrl), /1\.9–2\.6s:/);
  assert.equal(getReferenceVideoPrompt(referenceId, "https://source.test/" + oldSha256 + ".mp4"), undefined);
});

test("retired references still resolve saved remix/video/audio identities without returning to browsing", () => {
  const archives = getArchivedHookReferences(), refs = [...getRecreateReferences(), ...archives];
  assert.ok(archives.some(item => item.id === "explore-hook-01"));
  assert.equal(archives.find(item => item.id === "explore-paired-hook-9ee299bb7c8ab66ad9387bbf")?.sourceUrl, "https://www.instagram.com/reel/DdyrKJgDLYL/");
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
  try { assert.equal(getLocalRecreateReferences().filter(item => item.format === "hook").length, 129); }
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
