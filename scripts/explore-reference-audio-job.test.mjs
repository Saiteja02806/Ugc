import assert from "node:assert/strict";
import { mock, test } from "node:test";
import catalog from "../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };
import newBatch from "../worker/src/lib/explore-hook-reference-new-batch-release.json" with { type: "json" };
mock.module(new URL("../worker/dist/lib/explore-hook-reference-new-batch-release.json", import.meta.url), { defaultExport: { ...newBatch, mediaStatus: "published", activation: "active" } });
const verified = [];
mock.module(new URL("../worker/dist/lib/explore-reference-audio-render.js", import.meta.url), { namedExports: {
  verifyReferenceAudioFile: async (file, hash) => { verified.push({ file, hash }); }, renderExploreReferenceAudio: async () => { throw new Error("Only the injected finisher should run."); },
} });
const { runFinishExploreVideoJob } = await import("../worker/dist/jobs/finish-explore-video.js");
const { referenceAudioBaseStorageKey } = await import("../worker/dist/lib/explore-reference-soundtrack.js");
const { parseExploreFinishDraft } = await import("../worker/dist/lib/explore-finishing-contract.js");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fixture({ format = "hook", clean = false, custom = false, reference: selectedReference } = {}) {
  const reference = selectedReference ?? catalog.items.find(item => item.format === format), events = [];
  const soundtrack = { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .35, cleanStorageKey: referenceAudioBaseStorageKey(id(1)) };
  const source = { id: id(1), source_type: clean ? "combined_render" : "generated_video", metadata: clean ? { render: { referenceSoundtrack: soundtrack } } : { exploreReferenceId: reference.id }, storage_key: "generated/hook.mp4", ratio: "9:16" };
  const receipt = { user_id: "owner", request_key: id(3), job_id: id(4), output_asset_id: id(5), fingerprint: "a".repeat(64), status: "queued", draft: {
    version: 1, kind: "hook", sourceAssetId: source.id, demoAssetId: format === "hook" ? id(2) : null, demoAudioAssetId: null, demoAudioPlayback: "once",
    backgroundAssetId: custom ? id(6) : null, backgroundPlayback: "once", subtitles: null,
  } };
  const job = { id: receipt.job_id, job_type: "render_demo_video", project_id: "explore", user_id: "owner", claim_token: id(7), idempotency_key: `explore-finish:${receipt.request_key}`,
    input_json: { version: 1, userId: "owner", requestKey: receipt.request_key, fingerprint: receipt.fingerprint, outputAssetId: receipt.output_asset_id } };
  let options, details;
  const deps = { store: {
    read: async () => receipt,
    asset: async (owner, assetId, collection) => { assert.equal(owner, "owner"); assert.equal(collection, assetId === id(6) ? "audio" : "video"); events.push(`owned:${assetId}`); return assetId === source.id ? source : { id: assetId, storage_key: `owned/${assetId}`, metadata: {}, source_type: "upload" }; },
    finalize: async () => {},
  }, storage: {
    existing: async () => null,
    download: async (key, file) => { events.push({ key, file }); },
    upload: async (_receipt, _file, value) => { details = value; return {}; },
  }, finish: async value => { options = value; return { outputPath: "finished.mp4", referenceAudioBasePath: "clean.mp4", durationMs: 2000, width: 256, height: 384, sourceHashes: [], segments: [], demoAudioTiming: null, backgroundMusicTiming: null, subtitleStyle: null, subtitlePlacement: null, subtitleWordCount: 0 }; } };
  return { reference, source, receipt, job, deps, events, run: () => runFinishExploreVideoJob(job, { checkpoint: async () => {} }, deps), options: () => options, details: () => details };
}

test("the owned final hook/demo and wall-text jobs use the registered MP3 even when generic music was submitted", async () => {
  for (const format of ["hook", "wall_text"]) {
    const f = fixture({ format, custom: true }); await f.run();
    const options = f.options(), metadata = f.details().metadata.referenceSoundtrack;
    assert.equal(options.backgroundMusicPath, undefined); assert.equal(options.sourceOriginalVolume, 0);
    assert.equal(options.referenceAudioVolume, .2); assert.equal(options.demoPath !== undefined, format === "hook");
    assert.ok(f.events.some(e => e.key === f.reference.audioStorageKey));
    assert.equal(verified.at(-1).hash, f.reference.audioSha256);
    assert.equal(metadata.referenceId, f.reference.id); assert.equal(metadata.cleanStorageKey, referenceAudioBaseStorageKey(f.receipt.output_asset_id));
    assert.equal(f.details().referenceAudioBasePath, "clean.mp4");
  }
});

test("all 98 reviewed Hook + Demo jobs and re-edits retain their exact track and saved music volume", async () => {
  const { getHookReferenceGalleryItems } = await import("../worker/dist/lib/explore-hook-reference-release.js");
  const references = getHookReferenceGalleryItems(); assert.equal(references.length, 98);
  for (const reference of references) for (const clean of [false, true]) {
    const f = fixture({ reference, clean, custom: true }); await f.run();
    assert.equal(f.options().referenceAudioVolume, clean ? .35 : .2);
    assert.equal(f.options().backgroundMusicPath, undefined, "generic music cannot replace the paired track");
    assert.ok(f.options().demoPath); assert.equal(f.options().demoOriginalVolume, undefined, "ordinary Demo speech is preserved");
    assert.equal(f.events.filter(event => event.key === reference.audioStorageKey).length, 1);
    assert.equal(verified.at(-1).hash, reference.audioSha256);
    assert.equal(f.details().metadata.referenceSoundtrack.referenceId, reference.id);
  }
});

test("reload/re-edit downloads the owned clean base, retains music volume, and rejects another asset's clean key before downloads", async () => {
  const f = fixture({ clean: true }); await f.run();
  assert.ok(f.events.some(e => e.key === referenceAudioBaseStorageKey(f.source.id)));
  assert.equal(f.options().sourceOriginalVolume, undefined); assert.equal(f.options().referenceAudioVolume, .35);
  const foreign = fixture({ clean: true }); foreign.source.metadata.render.referenceSoundtrack.cleanStorageKey = referenceAudioBaseStorageKey(id(99));
  await assert.rejects(foreign.run(), /another video/);
  assert.equal(foreign.events.some(e => typeof e === "object"), false);
});

test("explicit audio on a paired single-clip edit reaches the clean mix with its selected playback", async () => {
  for (const backgroundPlayback of ["once", "repeat"]) {
    const f = fixture({ clean: true, custom: true });
    f.receipt.draft.demoAssetId = null;
    f.receipt.draft.backgroundPlayback = backgroundPlayback;
    f.receipt.draft.editing = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .4, text: null };
    assert.deepEqual(parseExploreFinishDraft(f.receipt.draft), f.receipt.draft);
    await f.run();
    const options = f.options();
    assert.equal(options.backgroundMusicPlayback, backgroundPlayback);
    assert.match(options.backgroundMusicPath, /source-1$/);
    assert.equal(options.referenceAudioVolume, .4);
    assert.equal(options.editing.musicVolume, .4);
    assert.equal(options.sourceOriginalVolume, undefined);
    assert.equal(f.events.filter(event => event.key === f.reference.audioStorageKey).length, 1);
    assert.ok(f.events.some(event => event.key === `owned/${f.receipt.draft.backgroundAssetId}`));
    assert.equal(f.details().referenceAudioBasePath, "clean.mp4");
    assert.equal(f.details().metadata.referenceSoundtrack.referenceId, f.reference.id);
    assert.equal(f.details().metadata.referenceSoundtrack.volume, .4);
  }
});

test("the contract limits explicit paired edit audio to one clip", () => {
  const f = fixture({ clean: true, custom: true });
  f.receipt.draft.editing = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .4, text: null };
  assert.throws(() => parseExploreFinishDraft(f.receipt.draft), /one video/);
});

test("a paired clip's explicit audio is owner-checked before any download or rendering", async () => {
  const f = fixture({ clean: true, custom: true }); f.receipt.draft.demoAssetId = null;
  f.receipt.draft.editing = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .2, text: null };
  const ownedAsset = f.deps.store.asset;
  f.deps.store.asset = async (owner, assetId, collection) => {
    if (assetId === f.receipt.draft.backgroundAssetId) throw new Error("Selected audio belongs to another owner.");
    return ownedAsset(owner, assetId, collection);
  };
  await assert.rejects(f.run(), /another owner/);
  assert.equal(f.events.some(event => typeof event === "object"), false);
  assert.equal(f.options(), undefined);
});
