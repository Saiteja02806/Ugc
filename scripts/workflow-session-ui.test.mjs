import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as sessions from "../lib/explore/workflow-session.ts";
import * as generationClient from "../lib/explore/workflow-generation-client.ts";
import { createWorkflowGenerationSettings } from "../lib/explore/workflow-generation-settings.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";
import { workflowVisitStorage } from "../lib/explore/workflow-visit-storage.ts";
import * as draftLifecycle from "../lib/explore/workflow-draft-lifecycle.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const media = n => ({ id: id(n), title: `Video ${n}`, url: `https://media.test/${n}.mp4`, status: "ready", collection: "video", mimeType: "video/mp4", sourceType: "generated_video", durationSeconds: 5, fileSizeBytes: 1000 });
const tick = () => new Promise(setImmediate);
function hooks() {
  let cursor = 0;
  const slots = [], effects = [];
  return { react: {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, n) => !Object.is(value, slots[i].deps[n]))) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((value, n) => !Object.is(value, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    useSyncExternalStore(_subscribe, read) { cursor++; return read(); },
  }, reset() { cursor = 0; }, flush() { while (effects.length) effects.shift()(); }, unmount() { for (const value of slots) value?.cleanup?.(); } };
}
function load(file, imports, globals = {}) {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: exported, require(name) { if (name === "@/lib/explore/format-reference-images") return {fetchFormatReferenceImage: async () => {throw Error("Unexpected saved-image lookup")}}; if (name === "@/lib/explore/workflow-draft-lifecycle") return draftLifecycle; if (name === "@/lib/explore/workflow-visit-storage") return { workflowVisitStorage }; assert.ok(name in imports, name); return imports[name]; }, Error, AbortController, AbortSignal, ...globals });
  return exported;
}
function sessionHarness({ owner = "owner-a", saved = null, lookup = async assetId => media(Number(assetId.slice(-1))), store = new Map(), token = async () => "temporary-owner-token", deadlineMs, draftEntry, locks } = {}) {
  const h = hooks(), reads = [], writes = [], tokenReads = [];
  const key = sessions.workflowSessionStorageKey(owner);
  const backing={ getItem: value => store.get(value) ?? null, setItem: (value, raw) => store.set(value, raw), removeItem: value => store.delete(value) };
  if (saved) (draftEntry ? draftLifecycle.workflowDraftStorage(backing,draftEntry.id) : workflowVisitStorage(backing)).setItem(key, sessions.serializeWorkflowSession(saved));
  const testModule = load("components/explore/use-workflow-session.ts", { react: h.react, "@/lib/explore/workflow-session": sessions,
    "@/lib/http/read-deadline": { withReadDeadline: (read, signal) => withReadDeadline(read, signal, deadlineMs) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async expected => { assert.equal(expected, owner); tokenReads.push(expected); return token(); } },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async (assetId, token) => { assert.equal(token, "temporary-owner-token"); reads.push(assetId); return lookup(assetId); } },
  }, { navigator:{locks:locks??{request:async(_name,_options,run)=>run({})}},localStorage:{...backing,setItem:(key,raw)=>{writes.push({key,raw});store.set(key,raw);}},sessionStorage: { getItem: value => store.get(value) ?? null, setItem: (value, raw) => { writes.push({ key: value, raw }); store.set(value, raw); }, removeItem: value => store.delete(value) } });
  return { store, backing, key: `ugc-explore:visit:v1:${key}`, reads, writes, tokenReads, render() { h.reset(); const value = testModule.useWorkflowSession({ ownerId: owner, enabled: true, defaults: createWorkflowGenerationSettings(),draftEntry }); h.flush(); return value; }, unmount: h.unmount };
}

test("draft-ID recovery preserves exact work; fresh work and unavailable copies cannot expose it", async()=>{
  const saved={...sessions.createWorkflowSession("owner-a"),generatedAssetId:id(2),demoAssetId:id(3),section:"edit"};
  const h=sessionHarness({saved,draftEntry:{id:id(90),createNew:false}});h.render();await tick();await tick();
  assert.equal(h.render().assets.source.id,id(2));h.render().complete();assert.equal(draftLifecycle.workflowDraftState(h.backing,"owner-a",id(90)),"scheduled");h.unmount();
  const fresh=sessionHarness({store:h.store,draftEntry:{id:id(91),createNew:true}});fresh.render();await tick();await tick();
  assert.equal(fresh.render().assets.source,null);assert.equal(fresh.reads.length,0);fresh.unmount();
  const missing=sessionHarness({draftEntry:{id:id(92),createNew:false}});missing.render();await tick();await tick();assert.match(missing.render().error,/not available/);assert.equal(missing.reads.length,0);missing.unmount();
  const duplicate=sessionHarness({store:h.store,draftEntry:{id:id(90),createNew:false},locks:{request:async(_name,_options,run)=>run(null)}});duplicate.render();await tick();assert.match(duplicate.render().error,/another tab/);assert.equal(duplicate.reads.length,0);duplicate.unmount();
});

test("legacy permanent history cannot populate a fresh compatibility visit", async () => {
  const saved = { ...sessions.createWorkflowSession("owner-a"), generatedAssetId: id(2), demoAssetId: id(3), section: "edit" };
  const legacy = new Map([[sessions.workflowSessionStorageKey("owner-a"), sessions.serializeWorkflowSession(saved)], ["ugc-explore:schedule:receipt", "keep-me"]]);
  const first = sessionHarness({ store: legacy }); first.render(); await tick(); await tick();
  assert.equal(first.render().session.generatedAssetId, null); assert.equal(first.reads.length, 0); assert.equal(first.tokenReads.length, 0); first.unmount();
  const expired = sessionHarness({ saved });
  const envelope = JSON.parse(expired.store.get(expired.key)); envelope.savedAt -= 48 * 60 * 60 * 1000;
  expired.store.set(expired.key, JSON.stringify(envelope)); expired.render(); await tick(); await tick();
  const value = expired.render(); assert.equal(value.loaded, true); assert.equal(value.session.section, "edit"); assert.equal(value.assets.source.id, id(2));
  assert.equal(expired.reads.length, 2); assert.equal(legacy.get("ugc-explore:schedule:receipt"), "keep-me"); expired.unmount();
});

test("session hydration verifies exact chosen owned media without writes or uploads, then edits survive remount", async () => {
  const saved = { ...sessions.createWorkflowSession("owner-a"), sourceMode: "assets", sourceAssetId: id(2), demoAssetId: id(3), section: "edit" };
  const h = sessionHarness({ saved });
  assert.equal(h.render().loaded, false); await tick(); await tick(); let value = h.render();
  assert.equal(value.assets.source.id, id(2)); assert.equal(value.assets.demo.id, id(3)); assert.equal(value.session.section, "edit"); assert.equal(h.writes.length, 0); assert.equal(h.tokenReads.length, 1);
  value.update(previous => ({ ...previous, section: "schedule", scheduleDraft: { platform: "instagram", connectionId: id(5), date: "2099-12-01", time: "18:45", caption: "Review me", timezone: "Asia/Calcutta" } }));
  assert.equal(h.writes.length, 1); assert.doesNotMatch(h.writes[0].raw, /temporary-owner-token|https?:|blob:/); h.unmount();
  const reloaded = sessionHarness({ store: h.store }); reloaded.render(); await tick(); await tick(); value = reloaded.render();
  assert.equal(value.assets.source.id, id(2)); assert.equal(value.session.scheduleDraft.caption, "Review me"); assert.equal(value.session.section, "schedule"); assert.equal(reloaded.writes.length, 0); reloaded.unmount();
});

test("default state cannot overwrite stored choices before hydration; owner change cannot expose prior media", async () => {
  let complete;
  const saved = { ...sessions.createWorkflowSession("owner-a"), generatedAssetId: id(2) };
  const h = sessionHarness({ saved, lookup: () => new Promise(resolve => { complete = resolve; }) });
  let value = h.render(); assert.equal(value.update(previous => ({ ...previous, generatedAssetId: id(1) })), false); await tick();
  assert.equal(h.writes.length, 0); h.unmount(); complete(media(2)); await tick();
  const next = sessionHarness({ owner: "owner-b", store: h.store }); next.render(); await tick(); value = next.render();
  assert.equal(value.assets.source, null); assert.equal(value.session.generatedAssetId, null); assert.equal(value.session.ownerId, "owner-b"); next.unmount();
});

test("unavailable owned selection remains visible as an error with explicit recovery and reset preserves receipts", async () => {
  const saved = { ...sessions.createWorkflowSession("owner-a"), generatedAssetId: id(2) };
  const h = sessionHarness({ saved, lookup: async () => { throw new Error("not owned"); } });
  h.store.set("ugc-explore:schedule:receipt", "immutable-receipt"); h.store.set("ugc-explore:finish:request", "immutable-render");
  h.render(); await tick(); await tick(); let value = h.render();
  assert.equal(value.assets.source, null); assert.equal(value.session.generatedAssetId, id(2)); assert.match(value.problems.source, /unavailable/);
  const beforeReset = value.recoveryRevision;
  value.reset(); value = h.render(); assert.equal(value.session.generatedAssetId, null); assert.equal(Object.keys(value.problems).length, 0); assert.notEqual(value.recoveryRevision, beforeReset, "Reset remounts local source/form/options state");
  assert.equal(h.store.get("ugc-explore:schedule:receipt"), "immutable-receipt"); assert.equal(h.store.get("ugc-explore:finish:request"), "immutable-render"); h.unmount();
});

test("accepted uploads store only IDs; interrupted replacement cannot silently reuse an older selection after reload", async () => {
  const h = sessionHarness(); h.render(); await tick(); let value = h.render();
  value.acceptAsset("source", media(2), "upload"); value = h.render(); value.acceptAsset("demo", media(3));
  value = h.render(); value.markPending("demo"); h.unmount();
  const reload = sessionHarness({ store: h.store }); reload.render(); await tick(); await tick(); value = reload.render();
  assert.equal(value.assets.source.id, id(2)); assert.equal(value.session.sourceMode, "upload"); assert.equal(value.assets.demo.id, id(3)); assert.match(value.problems.demo, /interrupted/);
  value.clearMedia("demo"); value = reload.render(); assert.equal(value.assets.demo, null); assert.equal(value.session.demoAssetId, null); assert.equal(value.session.pendingDemo, false); reload.unmount();
});

test("token and media parsing stalls leave bounded recovery errors without exposing or overwriting saved selections", async () => {
  for (const stage of ["token", "asset"]) {
    const saved = { ...sessions.createWorkflowSession("owner-a"), generatedAssetId: id(2) };
    const h = sessionHarness({ saved, deadlineMs: 10, ...(stage === "token" ? { token: () => new Promise(() => {}) } : { lookup: () => new Promise(() => {}) }) });
    const original = h.store.get(h.key); h.render();
    await new Promise(resolve => setTimeout(resolve, 40));
    const value = h.render(); assert.equal(value.loaded, true); assert.match(value.error, /Loading took too long/);
    assert.equal(value.assets.source, null); assert.equal(h.writes.length, 0); assert.equal(h.store.get(h.key), original);
    assert.equal(h.tokenReads.length, 1); assert.equal(h.reads.length, stage === "token" ? 0 : 1); h.unmount();
  }
});

function generationHarness(selection, available = [media(1), media(2)]) {
  const h = hooks(), callbacks = [], jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const testModule = load("components/explore/workflow-generation-boundary.tsx", { react: h.react, "react/jsx-runtime": jsx,
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {} }), useQueries: ({ queries }) => queries.map(query => { const data = available.find(asset => asset.id === query.queryKey[2]); return { data, isPending: false, isError: !data }; }) },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({ data: { userId: "owner-a", videoGenerationCreditsPerSecond: 1, creditsRemaining: 100 }, isPending: false }) },
    "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" }, "@/contexts/auth-context": {}, "@/lib/ai-studio/access-policy": {}, "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [] },
    "@/lib/ai-studio/media-client": {}, "@/lib/ai-studio/reference-media-upload": {}, "@/lib/firebase/auth": {}, "@/lib/explore/workflow-generation-client": { ...generationClient, createWorkflowGenerationClient: () => ({}) },
    "@/lib/jobs/background-job-client": { usePersistedJobIdFromUrl: () => "job", useBackgroundJobs: () => [1, 2].map(n => ({ data: { id: `job${n}`, status: "completed", jobType: "video_generation", projectId: "ai-studio", output: { mediaAssetId: id(n) } } })) },
  }, { window: { localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null } } });
  return { callbacks, render() { h.reset(); const element = testModule.WorkflowGenerationBoundary({ enabled: true, ownerId: "owner-a", draft: { kind: "hook", settings: createWorkflowGenerationSettings(), instructions: "Create a talking head" }, restoredSelection: selection, onSelectionChange: asset => callbacks.push(asset), children: view => view }); const value = element.type(element.props); h.flush(); return value; } };
}

test("restored generated result two remains exact and unavailable choices never default to result one", () => {
  for (const chosen of [media(2), media(8)]) {
    const h = generationHarness({ assetId: chosen.id, asset: chosen, ready: true }); assert.equal(h.render().selected.id, chosen.id); assert.equal(h.callbacks.length, 0);
  }
  const unavailable = generationHarness({ assetId: id(8), asset: null, ready: true }); const view = unavailable.render();
  assert.equal(view.selected, null); assert.equal(view.disabled, true); assert.match(view.error, /saved selected video is unavailable/); assert.equal(unavailable.callbacks.length, 0);
  view.selectResult(id(2)); assert.equal(unavailable.callbacks.at(-1).id, id(2));
  const hydrating = generationHarness({ assetId: id(2), asset: null, ready: false }); assert.equal(hydrating.render().selected, null); assert.equal(hydrating.callbacks.length, 0);
  const removed = generationHarness({ assetId: null, asset: null, ready: true, allowAutomaticSelection: false }); assert.equal(removed.render().selected, null); assert.equal(removed.callbacks.length, 0);
});

function demoSelectionHarness() {
  // Execute the actual component handlers with deferred metadata/uploads. This
  // verifies the cross-handler handoff instead of reproducing a guard in a test.
  const source = readFileSync(new URL("../components/explore/hook-workflow-preview.tsx", import.meta.url), "utf8");
  const syntax = ts.createSourceFile("hook-workflow-preview.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const layout = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "RestoredHookWorkflowLayout");
  const handlers = layout.body.statements.filter(node => ts.isFunctionDeclaration(node) && ["chooseDemo", "chooseDemoAudio"].includes(node.name?.text));
  assert.equal(handlers.length, 2);
  const exported = {}, uploads = [], acceptedAudio = [];
  const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
  const demoMetadata = deferred(), audioMetadata = deferred();
  const session = { ...sessions.createWorkflowSession("owner-a"), demoAssetId: id(1), demoAudioAssetId: id(8) };
  const currentDemoIdentity = { current: id(1) }, assets = { demo: media(1), demoAudio: { ...media(8), collection: "audio", mimeType: "audio/mpeg" } };
  const demo = { asset: { url: media(1).url } }, state = { audioUpload: null, demoUpload: null };
  const recovery = { session, assets, markPending(role) { session[role === "demo" ? "pendingDemo" : "pendingDemoAudio"] = true; },
    acceptAsset(role, asset) {
      assets[role] = asset;
      if (role === "demo") { session.demoAssetId = asset.id; session.demoAudioAssetId = null; assets.demoAudio = null; currentDemoIdentity.current = asset.id; demo.asset = { url: asset.url }; }
      else { session.demoAudioAssetId = asset.id; acceptedAudio.push({ demo: session.demoAssetId, audio: asset.id }); }
      return true;
    } };
  vm.runInNewContext(ts.transpileModule(handlers.map(node => `export ${node.getText(syntax)}`).join("\n"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: exported, Error, demo, demoIdentity: id(1), currentDemoIdentity, demoRevision: { current: 0 }, audioRevision: { current: 0 }, active: { current: true }, generationEnabled: true, ownerId: "owner-a", recovery,
      localDemo: { choose: () => demoMetadata.promise, remove() {} }, localDemoAudio: { choose: () => audioMetadata.promise, remove() {}, cancelPending() {} },
      updateSession(change) { Object.assign(session, change(session)); }, clearProblem() {}, setDemoAudioPlayback() {}, setDemoFraming() {},
      setDemoUpload(next) { state.demoUpload = typeof next === "function" ? next(state.demoUpload) : next; }, setAudioUpload(next) { state.audioUpload = typeof next === "function" ? next(state.audioUpload) : next; },
      uploadHookVideoDemo(file) { const pending = deferred(); uploads.push({ file, kind:"video", ...pending }); return pending.promise.then(result => result.asset); },
      uploadAIStudioReferenceMedia(file, kind) { const pending = deferred(); uploads.push({ file, kind, ...pending }); return pending.promise; },
    });
  return { ...exported, uploads, acceptedAudio, demoMetadata, audioMetadata, session, assets, state };
}

test("replacing a demo while audio metadata is pending prevents the old audio upload from starting", async () => {
  const h = demoSelectionHarness(); const audioChoice = h.chooseDemoAudio({ name: "audio-A" });
  const demoChoice = h.chooseDemo({ name: "demo-B" }); h.demoMetadata.resolve(true); await tick();
  h.uploads.find(upload => upload.kind === "video").resolve({ asset: media(2) }); assert.equal(await demoChoice, true);
  h.audioMetadata.resolve(true); assert.equal(await audioChoice, false);
  assert.equal(h.uploads.some(upload => upload.kind === "audio"), false); assert.equal(h.acceptedAudio.length, 0); assert.equal(h.session.demoAssetId, id(2)); assert.equal(h.session.demoAudioAssetId, null);
});

test("late audio upload for demo A cannot attach to accepted demo B or re-enable old loading state", async () => {
  const h = demoSelectionHarness(); const audioChoice = h.chooseDemoAudio({ name: "audio-A" }); h.audioMetadata.resolve(true); await tick();
  const audioUpload = h.uploads.find(upload => upload.kind === "audio"); assert.ok(audioUpload);
  const demoChoice = h.chooseDemo({ name: "demo-B" }); h.demoMetadata.resolve(true); await tick();
  h.uploads.find(upload => upload.kind === "video").resolve({ asset: media(2) }); assert.equal(await demoChoice, true);
  audioUpload.resolve({ asset: { ...media(9), collection: "audio", mimeType: "audio/mpeg" } }); assert.equal(await audioChoice, false);
  assert.equal(h.acceptedAudio.length, 0); assert.equal(h.session.demoAssetId, id(2)); assert.equal(h.session.demoAudioAssetId, null); assert.equal(h.state.audioUpload.busy, false);
});

test("a rejected demo replacement retains prior accepted demo/audio while cancelling its pending audio candidate", async () => {
  const h = demoSelectionHarness(); const audioChoice = h.chooseDemoAudio({ name: "audio-A" }); h.audioMetadata.resolve(true); await tick();
  const demoChoice = h.chooseDemo({ name: "invalid-demo-B" }); h.demoMetadata.resolve(false); assert.equal(await demoChoice, false);
  h.uploads.find(upload => upload.kind === "audio").resolve({ asset: { ...media(9), collection: "audio", mimeType: "audio/mpeg" } }); assert.equal(await audioChoice, false);
  assert.equal(h.session.demoAssetId, id(1)); assert.equal(h.session.demoAudioAssetId, id(8)); assert.equal(h.acceptedAudio.length, 0); assert.equal(h.session.pendingDemoAudio, false); assert.equal(h.session.pendingDemo, false);
});
