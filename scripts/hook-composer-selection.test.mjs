import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as storage from "../lib/explore/hook-composer-selection.ts";

const frame = { ownerId: "owner", assetId: "11111111-1111-4111-8111-111111111111", jobId: "22222222-2222-4222-8222-222222222222",
  draftId: "33333333-3333-4333-8333-333333333333", referenceId: "hook-15", sourceSha256: "a".repeat(64), url: "https://media.example.test/frame.png?signature=temporary",
  width: 720, height: 1280, durationSeconds: 8, motionInstructions: "Custom reviewed motion", generateAudio: true };
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function harness({ raw = storage.serializeHookComposerSelection(frame), load = async () => ({ ...frame, url: "https://media.example.test/fresh.png", motionInstructions: "Suggested motion", generateAudio: false }), storageFails = false, tabScoped = false, resumeDraftId = null, shared = null, tab = new Map() } = {}) {
  const stored = shared ?? new Map(raw === null ? [] : [[storage.hookComposerSelectionKey("owner"), raw]]), slots = [], effects = [], calls = [];
  let cursor = 0, owner = "owner", enabled = true, namespace = "hook";
  const react = {
    useCallback: callback => callback,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(run, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, n) => value !== previous.deps[n])) { const next = { deps }; slots[index] = next; effects.push(() => { previous?.cleanup?.(); next.cleanup = run(); }); } },
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/use-hook-composer-selection.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: exported, AbortController, Error, sessionStorage: { getItem: key => tab.get(key) ?? null, setItem: (key,value) => tab.set(key,value), removeItem: key => tab.delete(key) }, localStorage: {
    getItem: key => stored.get(key) ?? null,
    setItem(key, value) { if (storageFails) throw new Error("storage unavailable"); stored.set(key, value); },
    removeItem(key) { if (storageFails) throw new Error("storage unavailable"); stored.delete(key); },
  }, require(name) {
    if (name === "react") return react;
    if (name.endsWith("hook-composer-selection")) return storage;
    if (name.endsWith("hook-starting-frame-history-client")) return { fetchRecentStartingFrame: async (...args) => { calls.push(args); return load(...args); } };
    throw new Error(name);
  } });
  return { stored, tab, calls, render() { cursor = 0; const result = exported.useHookComposerSelection(owner, enabled, namespace, { tabScoped, resumeDraftId }); effects.splice(0).forEach(run => run()); return result; }, setNamespace(value) { namespace = value; }, setOwner(value) { owner = value; }, disable() { enabled = false; }, unmount() { slots.forEach(value => value?.cleanup?.()); } };
}

test("Hook, Wall and individual Talking Head drafts preserve independent approved selections", async () => {
  const h = harness(); h.render(); await settle(); assert.equal(h.render().frame.referenceId, frame.referenceId);
  for (const namespace of ["wall_text", "talking_head:draft-one", "talking_head:draft-two"]) {
    h.setNamespace(namespace); assert.equal(h.render().frame, null); await settle();
    assert.equal(h.render().ready, true); assert.equal(h.render().frame, null);
    const next = { ...frame, referenceId: namespace.replace(/:/g, "-") };
    assert.equal(h.render().setFrame(next), true);
    assert.equal(h.stored.has(storage.hookComposerSelectionKey("owner", namespace)), true);
  }
  h.setNamespace("hook"); assert.equal(h.render().frame, null); await settle();
  assert.equal(h.render().frame.referenceId, frame.referenceId); assert.equal(h.stored.size, 4);
  h.unmount();
});

test("persisted composer identity excludes URLs and restores exact custom motion/audio using verified fresh media", async () => {
  const raw = storage.serializeHookComposerSelection(frame);
  assert.equal(raw.includes(frame.url), false); assert.equal(raw.includes("signature"), false);
  assert.equal(storage.readHookComposerSelection(null, "owner"), null);
  assert.throws(() => storage.readHookComposerSelection(raw, "other"));
  assert.throws(() => storage.restoreHookComposerSelection(storage.readHookComposerSelection(raw, "owner"), { ...frame, sourceSha256: "b".repeat(64) }));
  const h = harness(); assert.equal(h.render().ready, false); await settle(); const result = h.render();
  assert.equal(result.ready, true); assert.equal(result.frame.url, "https://media.example.test/fresh.png");
  assert.equal(result.frame.motionInstructions, frame.motionInstructions); assert.equal(result.frame.generateAudio, true); assert.equal(h.calls.length, 1);
  h.unmount();
});
test("late restore cannot overwrite a newly selected frame or explicit removal", async () => {
  for (const next of [null, { ...frame, assetId: "44444444-4444-4444-8444-444444444444" }]) {
    let resolve; const pending = new Promise(done => { resolve = done; }); const h = harness({ load: () => pending });
    h.render(); await settle(); const state = h.render(); assert.equal(state.setFrame(next), true); resolve(frame); await settle();
    assert.equal(h.render().frame, next); assert.equal(h.render().ready, true); assert.equal(h.calls[0][2].aborted, true);
    if (next === null) assert.equal(h.stored.size, 0);
    h.unmount();
  }
});
test("failed recovery preserves its receipt, blocks fallback and retries by read only", async () => {
  let fail = true; const h = harness({ load: async () => { if (fail) throw new Error("temporary outage"); return frame; } });
  h.render(); await settle(); let state = h.render(); assert.equal(state.ready, false); assert.match(state.error, /outage/); assert.equal(h.stored.size, 1);
  fail = false; state.retry(); h.render(); await settle(); state = h.render(); assert.equal(state.ready, true); assert.equal(state.frame.assetId, frame.assetId); assert.equal(h.calls.length, 2);
  h.unmount();
});
test("foreign owner, mismatched scene and malformed persisted records never restore a frame", async () => {
  for (const options of [{ raw: "broken JSON" }, { raw: storage.serializeHookComposerSelection({ ...frame, ownerId: "other" }) }, { load: async () => ({ ...frame, referenceId: "different" }) }]) {
    const h = harness(options); h.render(); await settle(); const state = h.render(); assert.equal(state.frame, null); assert.equal(state.ready, false); assert.ok(state.error); assert.equal(h.stored.size, 1); h.unmount();
  }
});
test("storage failure does not acknowledge a lost selection and empty/disabled recovery performs no read", async () => {
  const h = harness({ raw: null, storageFails: true }); h.render(); await settle(); const state = h.render();
  assert.equal(state.setFrame(frame), false); assert.equal(h.render().frame, null); assert.match(h.render().error, /browser/); assert.equal(h.calls.length, 0); h.unmount();
  const preview = harness(); preview.disable(); preview.render(); await settle(); assert.equal(preview.calls.length, 0); assert.equal(preview.render().setFrame(frame), true); preview.unmount();
});
test("account changes abort the old read and hide the previous selection immediately", async () => {
  let resolve; const h = harness({ load: () => new Promise(done => { resolve = done; }) }); h.render(); await settle();
  h.setOwner("other"); assert.equal(h.render().frame, null); resolve(frame); await settle();
  assert.equal(h.render().frame, null); assert.equal(h.calls[0][2].aborted, true); h.unmount();
});
test("signed-out screens remain available without initiating an owned-frame read", async () => {
  const h = harness(); h.setOwner(null); assert.equal(h.render().ready, true); await settle();
  assert.equal(h.render().frame, null); assert.equal(h.calls.length, 0); h.unmount();
});


test("two Hook tabs retain separate frames, custom instructions and explicit removals through reload", async () => {
  const shared=new Map([[storage.hookComposerSelectionKey("owner"),storage.serializeHookComposerSelection(frame)]]), aTab=new Map(), bTab=new Map();
  const load=async saved=>({...frame,...saved,url:frame.url});
  const a=harness({tabScoped:true,shared,tab:aTab,load}), b=harness({tabScoped:true,shared,tab:bTab,load});
  a.render();b.render();await settle();assert.equal(a.render().frame,null);assert.equal(b.render().frame,null);
  a.render().setFrame({...frame,motionInstructions:"Tab A custom motion"});
  b.render().setFrame({...frame,referenceId:"hook-other",assetId:"44444444-4444-4444-8444-444444444444",motionInstructions:"Tab B custom motion"});
  a.unmount();b.unmount();
  const ar=harness({tabScoped:true,shared,tab:aTab,load}), br=harness({tabScoped:true,shared,tab:bTab,load});ar.render();br.render();await settle();
  assert.equal(ar.render().frame.motionInstructions,"Tab A custom motion");assert.equal(br.render().frame.referenceId,"hook-other");assert.equal(br.render().frame.motionInstructions,"Tab B custom motion");
  assert.equal(storage.readHookComposerSelection(shared.get(storage.hookComposerSelectionKey("owner")),"owner").motionInstructions,frame.motionInstructions);
  ar.render().setFrame(null);ar.unmount();br.unmount();
  const cleared=harness({tabScoped:true,shared,tab:aTab,load,resumeDraftId:frame.draftId});cleared.render();await settle();assert.equal(cleared.render().frame,null);assert.equal(cleared.calls.length,0);cleared.unmount();
});

test("legacy Hook selection is adopted only for an explicitly matching frame draft",async()=>{
  const h=harness({tabScoped:true,resumeDraftId:frame.draftId});h.render();await settle();assert.equal(h.render().frame.assetId,frame.assetId);assert.equal(h.stored.size,1);h.unmount();
});
