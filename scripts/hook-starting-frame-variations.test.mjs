import assert from "node:assert/strict";
import test from "node:test";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "../lib/explore/hook-keyframe-draft.ts";
import { createHookKeyframeCheckpoint } from "../lib/explore/hook-keyframe-client.ts";
import { createHookKeyframeVariationBatch, hookKeyframeRecoverableVariations, hookKeyframeVariationsKey,
  importHookKeyframeCheckpoint, readHookKeyframeVariations, selectHookKeyframeVariation, updateHookKeyframeVariation } from "../lib/explore/hook-keyframe-variations.ts";

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = { ownerId: "owner", draftId: uuid(1), referenceId: "hook-15", sourceSha256: "a".repeat(64) };
const draft = updateHookKeyframeDraft(createHookKeyframeDraft(scope), {
  sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, imageAssetIds: [uuid(2)],
});
function batch(count = 4, previous = null, start = 10, input = draft) {
  return createHookKeyframeVariationBatch(previous, input, Array.from({ length: count }, (_, i) => uuid(start + i)));
}
function terminal(store, key, jobId = uuid(300)) {
  return updateHookKeyframeVariation(updateHookKeyframeVariation(store, key, { state: "submitting" }), key, { state: "settled", jobId });
}

test("1–4 variations freeze separate stable identities and the exact same source/person/model contract", () => {
  for (let count = 1; count <= 4; count++) {
    const store = batch(count);
    assert.equal(store.entries.length, count); assert.equal(store.revision, 1);
    assert.equal(store.batchId, uuid(10)); assert.equal(store.selectedRequestKey, null);
    assert.equal(new Set(store.entries.map(entry => entry.checkpoint.requestKey)).size, count);
    assert.equal(new Set(store.entries.map(entry => entry.checkpoint.inputKey)).size, 1);
    assert.ok(store.entries.every(entry => entry.state === "planned" && entry.checkpoint.jobId === null));
    const parsed = JSON.parse(store.entries[0].checkpoint.inputKey);
    assert.equal(parsed.imageModel, "gemini_3_pro"); assert.deepEqual(parsed.imageAssetIds, [uuid(2)]);
    assert.equal(parsed.sourceFrame.sha256, "b".repeat(64));
  }
  assert.throws(() => batch(0)); assert.throws(() => batch(5));
  assert.throws(() => createHookKeyframeVariationBatch(null, draft, [uuid(10), uuid(10)]));
});

test("restoring a partial batch only recovers submitted requests; unused plans never become paid retries", () => {
  let store = batch();
  store = updateHookKeyframeVariation(store, uuid(10), { state: "submitting" });
  store = updateHookKeyframeVariation(store, uuid(10), { state: "accepted", jobId: uuid(100) });
  store = updateHookKeyframeVariation(store, uuid(11), { state: "submitting" });
  const raw = JSON.stringify(store), restored = readHookKeyframeVariations(raw, scope);
  assert.equal(JSON.stringify(store), raw, "transitions are immutable");
  assert.deepEqual(hookKeyframeRecoverableVariations(restored).map(entry => [entry.checkpoint.requestKey, entry.state]), [[uuid(10), "accepted"], [uuid(11), "submitting"]]);
  assert.equal(restored.entries.filter(entry => entry.state === "planned").length, 2);
  assert.throws(() => updateHookKeyframeVariation(restored, uuid(11), { state: "submitting" }), /could not be verified/);
  assert.throws(() => updateHookKeyframeVariation(restored, uuid(10), { state: "planned" }));
  assert.throws(() => updateHookKeyframeVariation(restored, uuid(11), { state: "accepted" }), /could not be verified/);
});

test("verified GET may settle an uncertain submission directly, retaining exact existing identity", () => {
  const original = updateHookKeyframeVariation(batch(1), uuid(10), { state: "submitting" });
  const settled = updateHookKeyframeVariation(original, uuid(10), { state: "settled", jobId: uuid(100) });
  assert.equal(settled.entries[0].checkpoint.requestKey, uuid(10));
  assert.equal(settled.entries[0].checkpoint.jobId, uuid(100));
  assert.equal(settled.revision, 3); assert.equal(hookKeyframeRecoverableVariations(settled).length, 0);
  assert.throws(() => updateHookKeyframeVariation(settled, uuid(10), { state: "submitting" }));
});

test("admission rejection preserves completed choices; a new explicit batch discards only never-submitted plans", () => {
  let store = terminal(batch(), uuid(10));
  store = selectHookKeyframeVariation(store, uuid(10));
  store = updateHookKeyframeVariation(store, uuid(11), { state: "submitting" });
  store = updateHookKeyframeVariation(store, uuid(11), { state: "rejected", error: "Insufficient credits" });
  const next = batch(2, store, 20);
  assert.equal(next.entries.length, 4); assert.equal(next.selectedRequestKey, uuid(10));
  assert.deepEqual(next.entries.map(entry => entry.checkpoint.requestKey), [uuid(10), uuid(11), uuid(20), uuid(21)]);
  assert.equal(next.entries[1].error, "Insufficient credits"); assert.equal(next.batchId, uuid(20));
  assert.throws(() => selectHookKeyframeVariation(next, uuid(11))); assert.throws(() => selectHookKeyframeVariation(next, uuid(20)));
  assert.throws(() => updateHookKeyframeVariation(next, uuid(11), { state: "submitting" }));
});

test("accepted identity is immutable and cross-account/source/model storage tampering fails closed", () => {
  let store = updateHookKeyframeVariation(batch(1), uuid(10), { state: "submitting" });
  store = updateHookKeyframeVariation(store, uuid(10), { state: "accepted", jobId: uuid(100) });
  assert.throws(() => updateHookKeyframeVariation(store, uuid(10), { state: "settled", jobId: uuid(101) }));
  for (const change of [s => { s.scope.ownerId = "another"; }, s => { s.scope.sourceSha256 = "c".repeat(64); },
    s => { s.entries[0].checkpoint.scope.draftId = uuid(5); },
    s => { const key = JSON.parse(s.entries[0].checkpoint.inputKey); key.ownerId = "another"; s.entries[0].checkpoint.inputKey = JSON.stringify(key); },
    s => { s.selectedRequestKey = uuid(99); }, s => { s.entries[0].checkpoint.jobId = null; },
    s => { s.entries.push(s.entries[0]); }, s => { s.entries[0].state = "unknown"; },
    s => { s.entries[0].checkpoint.requestKey = "not-an-id"; }, s => { s.revision = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.unreviewed = true; }]) {
    const modified = JSON.parse(JSON.stringify(store)); change(modified);
    assert.throws(() => readHookKeyframeVariations(JSON.stringify(modified), scope), /preserved/);
  }
  assert.throws(() => readHookKeyframeVariations("{", scope)); assert.equal(readHookKeyframeVariations(null, scope), null);
  assert.notEqual(hookKeyframeVariationsKey(scope), hookKeyframeVariationsKey({ ...scope, ownerId: "other" }));
});

test("bounded history prunes oldest terminal results, preserves selection and refuses to evict running requests", () => {
  let store = batch();
  for (const entry of store.entries) store = terminal(store, entry.checkpoint.requestKey, uuid(300 + Number(entry.checkpoint.requestKey.slice(-2))));
  store = selectHookKeyframeVariation(store, uuid(10));
  for (const start of [20, 30]) {
    store = batch(4, store, start);
    for (const entry of store.entries.filter(item => item.state === "planned")) store = terminal(store, entry.checkpoint.requestKey, uuid(300 + Number(entry.checkpoint.requestKey.slice(-2))));
  }
  assert.equal(store.entries.length, 12);
  store = batch(4, store, 40);
  assert.equal(store.entries.length, 12); assert.equal(store.entries[0].checkpoint.requestKey, uuid(10));
  assert.equal(store.selectedRequestKey, uuid(10)); assert.ok(!store.entries.some(entry => entry.checkpoint.requestKey === uuid(11)));
  let pending = batch();
  for (let round = 0; round < 3; round++) {
    if (round) pending = batch(4, pending, 10 + round * 10);
    for (const entry of pending.entries.filter(item => item.state === "planned")) pending = updateHookKeyframeVariation(pending, entry.checkpoint.requestKey, { state: "submitting" });
  }
  assert.equal(pending.entries.length, 12);
  assert.throws(() => batch(1, pending, 99), /Check the saved image requests/);
  assert.throws(() => batch(1, pending, 10), /could not be verified/);
});

test("legacy single request imports unchanged for read recovery and can coexist with new model-aware batches", () => {
  const legacy = JSON.parse(JSON.stringify(draft)); legacy.version = 1; legacy.imageModel = "nano_banana_2";
  const checkpoint = createHookKeyframeCheckpoint(legacy, uuid(10));
  const uncertain = importHookKeyframeCheckpoint(checkpoint);
  assert.deepEqual(uncertain.entries[0].checkpoint, checkpoint); assert.equal(uncertain.entries[0].state, "submitting");
  assert.equal(hookKeyframeRecoverableVariations(uncertain).length, 1);
  const completedCheckpoint = { ...checkpoint, jobId: uuid(100) };
  const accepted = importHookKeyframeCheckpoint(completedCheckpoint);
  assert.deepEqual(accepted.entries[0].checkpoint, completedCheckpoint); assert.equal(accepted.selectedRequestKey, uuid(10));
  const next = batch(2, accepted, 20);
  assert.equal(JSON.parse(next.entries[0].checkpoint.inputKey).version, 1);
  assert.equal(JSON.parse(next.entries[1].checkpoint.inputKey).version, 4);
});
