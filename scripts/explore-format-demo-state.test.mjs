import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming } from "../lib/explore/format-demo.ts";
import { formatTextLayout, formatTextOverlays, parseExploreFormatEdit } from "../worker/src/lib/explore-format-edit.ts";
import * as editDraft from "../lib/explore/format-edit-draft.ts";
import { canReuseUnchangedHookSource } from "../lib/explore/unchanged-hook-source.ts";
import { getReferenceAudioPreview } from "../lib/explore/reference-audio-preview.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
import { mapSequencePreviewDemoReference } from "../lib/explore/sequence-preview.ts";
import * as finishingContract from "../worker/src/lib/explore-finishing-contract.ts";
import * as wallTextEditor from "../lib/explore/wall-text-editor.ts";

const textFields = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/format-video-text-fields.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: textFields, require: name => name === "@/lib/explore/wall-text-editor" ? wallTextEditor : ({ jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" }) });

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const asset = (n, collection = "video") => ({ id: id(n), status: "ready", sourceType: collection === "video" ? "demo_upload" : "upload", collection, durationSeconds: 8, width: 720, height: 1280,
  title: `Owned ${collection} ${n}`, url: `/owned-${n}.${collection === "audio" ? "mp3" : "mp4"}`, mimeType: collection === "audio" ? "audio/mpeg" : "video/mp4" });
const output = n => ({ id: id(n), kind: "media_asset", url: asset(n).url, title: `Opening ${n}` });
const draft = (demo = 2) => ({ version: 1, demoId: id(demo), audioId: id(4), editing: { ...defaultDemoEdit(8), trimStartMs: 500, trimEndMs: 6500, originalVolume: .35, musicVolume: .6 },
  framing: { version: 1, width: .5, height: 1, points: [[0, .1, 0], [7000, .4, 0]] }, playback: "repeat" });
const draftKey = (owner = "owner", format = "hook") => `ugc-explore:demo:v2:${owner}:${format}`;
const normalize = value => JSON.parse(JSON.stringify(value));
function nodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : "";
}

/** Runs the real Demo component and its event/effect callbacks. Child render
 * coordinators stay observable so a test cannot accidentally submit a render. */
function harness({ owner = "owner", format = "hook", storage = new Map(), owned = [asset(1), asset(2), asset(3), asset(4, "audio"), asset(5)], enabled = true } = {}) {
  const slots = [], effects = [], selectionReports = [], savedReports = [], queryInputs = [], uploads = [], queryFailures = new Set(), draftSaves = [], draftInputs = [];
  const ownedAssets = new Map(owned.map(value => [value.id, value]));
  let cursor = 0, needsRender = false, tree, dirty = 0, pendingVideo = null, sourceInput;
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const sourceState = { mode: "upload", selected: null, uploaded: null, preview: null, busy: false, error: null };
  const audio = { asset: null, loading: false, error: null, async choose(file) { this.asset = { name: file.name, url: "blob:audio", duration: 8, file }; return true; }, remove() { this.asset = null; } };
  const props = { format, videoId: null, opening: null, openingRevision: 0, enabled, active: true, allowDemoAudio: true,
    controlsTarget: { name: "controls" }, actionsTarget: { name: "actions" }, resultsTarget: { name: "results" },
    editActive: true, editControlsTarget: { name: "edit-controls" }, editActionsTarget: { name: "edit-actions" }, editResultsTarget: { name: "edit-results" },
    onDirty: () => { dirty++; }, onSaved: result => savedReports.push(result), onSkip() {}, onEdit() {}, onAdd() {}, onEditDone() {}, onCreate() {}, onContinue() { props.prepareRequest = (props.prepareRequest ?? 0) + 1; props.scheduleActive = true; },
    onSelectionChange: present => selectionReports.push(present) };
  function queueEffect(callback, deps, layout = false) {
    const i = cursor++, previous = slots[i];
    if (!previous || !deps || deps.some((dep, n) => !Object.is(dep, previous.deps?.[n]))) {
      slots[i] = { deps, cleanup: previous?.cleanup }; effects.push({ i, callback, layout });
    }
  }
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, next => { const value = typeof next === "function" ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; needsRender = true; } }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(callback, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) slots[i] = { callback, deps };
      return slots[i].callback;
    },
    useMemo(callback, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) slots[i] = { value: callback(), deps };
      return slots[i].value;
    },
    useEffect: (callback, deps) => queueEffect(callback, deps),
    useLayoutEffect: (callback, deps) => queueEffect(callback, deps, true),
  };
  const source = {
    setMode(mode) { sourceState.mode = mode; },
    selectAsset(value) {
      if (value.status !== "ready" || value.collection !== "video") return false;
      sourceState.selected = value;
      sourceInput.onSelected?.(value, { name: value.title, url: value.url, duration: value.durationSeconds }); return true;
    },
    chooseUpload(file) {
      sourceState.busy = true; sourceState.error = null;
      const callback = sourceInput.onSelected;
      sourceState.preview = { name: file.name, url: "blob:pending-demo", duration: 8 };
      sourceInput.onUploadPreview?.(sourceState.preview);
      return new Promise(resolve => { pendingVideo = { file, callback, resolve }; });
    },
    cancelUpload() { sourceState.busy = false; sourceState.error = null; },
    removeUpload() { sourceState.busy = false; sourceState.uploaded = null; sourceState.preview = null; },
    clearSelection() { sourceState.selected = null; sourceState.uploaded = null; sourceState.preview = null; sourceState.error = null; sourceState.busy = false; },
    clearUploadError() { sourceState.error = null; },
  };
  const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: "fragment" };
  const imports = {
    "./clip-preview-controls": { ClipPreviewControls: "ClipPreviewControls" },
    "./clip-trim-timeline": { ClipTrimTimeline: "ClipTrimTimeline" },
    "./format-video-editor.module.css": { default: new Proxy({}, { get: (_, name) => name }) },
    react, "react/jsx-runtime": jsx, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery(input) { queryInputs.push(input); return { data: input.enabled ? ownedAssets.get(input.queryKey.at(-1)) : undefined, isError: queryFailures.has(input.queryKey[0]), refetch() {} }; } },
    "@/contexts/auth-context": { useAuth: () => ({ user: owner ? { uid: owner } : null }) },
    "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo(input) {
      sourceInput = input;
      const selected = sourceState.mode === "assets" ? sourceState.selected : sourceState.mode === "upload" && !sourceState.busy ? sourceState.uploaded : null;
      return { ...source, source: selected, preview: selected ? { name: selected.title, url: selected.url, duration: selected.durationSeconds } : sourceState.preview,
        mode: sourceState.mode, busy: sourceState.busy, error: sourceState.error };
    } },
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => audio },
    "@/components/explore/format-video-text-fields": textFields,
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing() { throw new Error("A selection or prop transition cannot dispatch finishing."); } },
    "@/lib/explore/remix-text-edit": { applyVideoTextRemix },
    "@/lib/explore/format-demo": { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming },
    "@/lib/explore/unchanged-hook-source": { canReuseUnchangedHookSource },
    "@/lib/explore/reference-audio-preview": { getReferenceAudioPreview },
    "@/lib/explore/workflow-default-music-client": { loadWorkflowDefaultMusic: async () => { throw new Error("Test attempted default music download."); } },
    "@/lib/explore/sequence-preview": { mapSequencePreviewDemoReference },
    "@/worker/src/lib/explore-format-edit": { parseExploreFormatEdit, formatTextLayout, formatTextOverlays },
    "@/worker/src/lib/explore-finishing-contract": finishingContract,
    "@/lib/explore/format-edit-draft": editDraft,
    "@/components/explore/use-clip-draft-save": { useClipDraftSave: input => { draftInputs.push(input); return { loaded: true, busy: false, dirty: true, saved: null, error: null, reload() {},
      async save() { draftSaves.push(normalize(input.content)); return { id: id(99), scope: input.scope, revision: 1, content: input.content }; } }; } },
    "@/lib/explore/format-video-source": { formatVideoFromAsset(value) { if (value.status !== "ready" || value.collection !== "video") throw new Error("Choose an owned ready video."); return value; } },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => { throw new Error("Test attempted authentication."); } },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async () => { throw new Error("Test attempted network media loading."); } },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (...args) => { uploads.push(args); return { asset: asset(4, "audio") }; } },
    "@/components/explore/workflow-creation.module.css": new Proxy({}, { get: (_, name) => name }),
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-demo-section.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, window: { localStorage }, localStorage, require(name) {
    if (name in imports) return imports[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected import: ${name}`);
  } });
  function render(patch = {}) {
    Object.assign(props, patch);
    for (let pass = 0; pass < 30; pass++) {
      needsRender = false; cursor = 0; tree = exported.FormatDemoSection(props);
      while (effects.length) {
        const layout = effects.findIndex(effect => effect.layout);
        const [effect] = effects.splice(layout < 0 ? 0 : layout, 1);
        slots[effect.i].cleanup?.(); slots[effect.i].cleanup = effect.callback();
      }
      if (!needsRender) return tree;
    }
    throw new Error("Demo effects did not settle.");
  }
  const find = (predicate) => nodes(tree).find(predicate);
  return { render, props, audio, storage, ownedAssets, queryInputs, queryFailures, uploads, selectionReports, savedReports, draftSaves, draftInputs, get sourceInput() { return sourceInput; }, get dirty() { return dirty; },
    find, button(label) { const currentLabel = label === "Save final video" || label === "Schedule" ? "Schedule video" : label; const found = find(node => node.type === "Button" && text(node).trim() === currentLabel); assert.ok(found, `Missing ${currentLabel}`); return found; },
    input(label) { const found = find(node => node.props?.["aria-label"] === label); assert.ok(found, `Missing ${label}`); return found; },
    select(value = asset(2)) { render(); const picker = find(node => node.type === "WorkflowVideoAssetPicker"); assert.equal(picker.props.onSelect(value), true); return render(); },
    edit(label, value) { this.input(label).props.onChange({ target: { value: String(value) } }); return render(); },
    saveRun() { return find(node => node.type === exported.DemoSaveRun); },
    completeVideoUpload(value = asset(2)) {
      assert.ok(pendingVideo, "No video upload is pending");
      const pending = pendingVideo; pendingVideo = null; sourceState.uploaded = value; sourceState.busy = false;
      sourceState.preview = value ? { name: value.title, url: value.url, duration: value.durationSeconds } : { name: pending.file.name, url: "blob:local-demo", duration: 8 };
      pending.callback?.(value, sourceState.preview); pending.resolve(true);
    },
    rejectVideoUpload() {
      assert.ok(pendingVideo); const pending = pendingVideo; pendingVideo = null;
      sourceState.busy = false; sourceState.error = "Upload rejected"; pending.resolve(false);
    },
  };
}

test("Content Edit selects its requested demo over another browser draft and restores all saved settings without rendering", () => {
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(draft(3))]]) });
  h.render({ contentDemoId: id(2) });
  assert.equal(h.sourceInput.library, "content");
  assert.equal(readFormatDemoDraft(h.storage.get(draftKey())).demoId, id(2));
  const saved = { version: 1, sourceAssetId: id(2), editing: draft().editing, backgroundAssetId: id(4), backgroundPlayback: "repeat", framing: draft().framing,
    workflowMusic: { enabled: true, assetId: id(4), playback: "once" } };
  h.draftInputs.at(-1).onRestore(saved, false); h.render();
  const restored = readFormatDemoDraft(h.storage.get(draftKey()));
  assert.deepEqual(normalize(restored.editing), saved.editing); assert.deepEqual(normalize(restored.framing), saved.framing);
  assert.equal(restored.audioId, id(4)); assert.equal(restored.backgroundAudioId, id(4)); assert.equal(restored.backgroundPlayback, "once");
  assert.equal(h.saveRun(), undefined); assert.equal(h.uploads.length, 0);
});

test("a slow Content restore cannot overwrite current-session demo changes", () => {
  const h = harness(); h.render({ contentDemoId: id(2) });
  h.edit("Demo trim start", 2);
  h.draftInputs.at(-1).onRestore({ version: 1, sourceAssetId: id(2), editing: draft().editing, backgroundAssetId: id(4), backgroundPlayback: "repeat", framing: draft().framing }, false);
  h.render(); assert.equal(readFormatDemoDraft(h.storage.get(draftKey())).editing.trimStartMs, 2000);
});

test("Content demo edits reopen and save independently of rendering availability", async () => {
  const h = harness({ enabled: false }); h.render({ contentDemoId: id(2) });
  assert.equal(h.draftInputs.at(-1).enabled, true);
  h.draftInputs.at(-1).onRestore({ version: 1, sourceAssetId: id(2), editing: defaultDemoEdit(8), backgroundAssetId: id(4), backgroundPlayback: "once", framing: null }, false);
  h.render();
  assert.equal(h.queryInputs.filter(query => query.queryKey[0] === "format-demo-audio").at(-1).enabled, true);
  assert.equal(h.button("Save edits").props.disabled, false);
  await h.button("Save edits").props.onClick(); h.render();
  assert.equal(h.draftSaves.length, 1); assert.equal(h.draftSaves[0].sourceAssetId, id(2));
  assert.equal(h.saveRun(), undefined); assert.equal(h.savedReports.length, 0);
});

test("Hook overview exposes replacement controls but has no separate demo audio track", () => {
  const saved = { ...draft(2), audioId: id(4) };
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(saved)]]) });
  const tree = h.render({ allowDemoAudio: false, editActive: false, editPreviewActive: true });
  const overview = nodes(tree).find(n => n.type === "portal" && n.props.target === h.props.controlsTarget);
  const source = nodes(overview).find(n => n.props?.["aria-label"] === "Demo video source");
  assert.ok(source); assert.notEqual(source.props.hidden, true);
  assert.ok(nodes(source).some(n => n.props?.["data-demo-source"] === "upload"));
  assert.equal(nodes(overview).some(n => n.props?.["aria-label"] === "Demo sound"), false);
  assert.equal(nodes(tree).some(n => n.type === "WorkflowSavedAudioPicker"), false);
  assert.equal(h.queryInputs.some(q => q.queryKey[0] === "format-demo-audio" && q.enabled), false, "Legacy demo-only audio must not enter the Hook mix");
  assert.equal(h.draftInputs.at(-1).content.backgroundAssetId, null);
  assert.ok(nodes(overview).some(n => n.props?.["aria-label"] === "Background audio settings"), "One shared background track remains available");
  const legacy = harness({ storage: new Map([[`ugc-explore:demo:v1:owner:hook:${id(1)}`, JSON.stringify(saved)]]) });
  legacy.render({ allowDemoAudio: false, videoId: id(1) });
  assert.equal(legacy.draftInputs.at(-1).content.backgroundAssetId, null, "Migrating an older opening-scoped draft must not add a demo-only track");
});

test("Demo Change opens its own asset chooser and cancels without changing the accepted draft", () => {
  const stored = draft(2), storage = new Map([[draftKey(), JSON.stringify(stored)]]);
  const h = harness({ storage }); h.render({ editActive: false, editPreviewActive: true });
  const before = normalize(h.draftInputs.at(-1).content);
  const change = h.find(n => n.type === "WorkflowClipSourceActions" && n.props.triggerLabel === "Change");
  assert.equal(change.props.onGenerate, undefined, "A demo cannot start hook generation");
  change.props.onChooseAssets(); h.render();
  const picker = h.find(n => n.type === "WorkflowVideoAssetPicker");
  assert.equal(picker.props.open, true); picker.props.onOpenChange(false); h.render();
  assert.equal(picker.props.library, "content");
  assert.equal(picker.props.onSelect({ ...asset(3), sourceType: "generated_video" }), false, "Ordinary Creative Assets cannot replace a demo");
  assert.deepEqual(normalize(h.draftInputs.at(-1).content), before);
  assert.equal(h.props.editActive, false); assert.equal(h.dirty, 0);
  change.props.onChooseAssets(); h.render();
  h.find(n => n.type === "WorkflowVideoAssetPicker").props.onSelect(asset(3)); h.render();
  assert.equal(h.draftInputs.at(-1).content.sourceAssetId, id(3));
  assert.equal(h.props.editActive, false);
  assert.equal(h.saveRun(), undefined, "Replacement never starts a paid render");
});

test("demo Edit and Change stay available while uploading, and pending trim survives confirmation", async () => {
  const h = harness(); h.render({ editActive: false, editPreviewActive: true });
  const pending = h.find(n => n.type === "WorkflowClipSourceActions").props.onUpload({ name: "slow.mp4" }); h.render();
  assert.equal(h.button("Edit demo video").props.disabled, false);
  assert.equal(h.find(n => n.type === "WorkflowClipSourceActions" && n.props.triggerLabel === "Change").props.disabled, false);
  assert.equal(h.button("Schedule video").props.disabled, true);
  h.render({ editActive: true });
  assert.equal(h.button("Save edits").props.disabled, true);
  assert.equal(h.button("Back to videos").props.disabled, false);
  const editor = h.find(n => n.type === "portal" && n.props.target === h.props.editControlsTarget);
  assert.equal(nodes(editor).find(n => n.type === "fieldset").props.disabled, false);
  h.edit("Demo trim start", 1.5); h.edit("Demo trim end", 6);
  const fields = h.find(n => n.type === textFields.FormatVideoTextFields);
  fields.props.onChange({ ...fields.props.editing, text: { value: "Edited during upload", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 4500 } }); h.render();
  assert.equal(h.storage.get(draftKey()), undefined, "Unconfirmed footage must not overwrite a recoverable accepted draft");
  h.completeVideoUpload(asset(2)); await pending; h.render();
  const saved = readFormatDemoDraft(h.storage.get(draftKey()));
  assert.equal(saved.demoId, id(2)); assert.equal(saved.editing.trimStartMs, 1500); assert.equal(saved.editing.trimEndMs, 6000);
  assert.equal(saved.editing.text.value, "Edited during upload");
  assert.equal(h.button("Save edits").props.disabled, false);
  assert.doesNotMatch(text(h.render()), /Changes appear in the preview immediately\. Save edits to keep them\./);
});

test("a failed upload discards only its transient edits and restores the accepted demo", async () => {
  const stored = draft(2), storage = new Map([[draftKey(), JSON.stringify(stored)]]);
  const h = harness({ storage }); h.render();
  h.input("Upload or replace demo video").props.onChange({ currentTarget: { files: [{ name: "replacement.mp4" }], value: "" } }); h.render();
  h.edit("Demo trim start", 2); h.render();
  assert.deepEqual(JSON.parse(storage.get(draftKey())), stored);
  h.rejectVideoUpload(); await new Promise(setImmediate); h.render();
  assert.equal(h.input("Demo trim start").props.value, .5);
  assert.deepEqual(JSON.parse(storage.get(draftKey())), stored);
  assert.equal(h.find(n => n.type === "video" && n.props["aria-label"] === "Demo video being edited").props.src, asset(2).url);
});

test("a replacement superseding another pending upload still restores the original Creative Assets selection on failure", async () => {
  const h = harness(); h.render(); h.select(asset(3));
  const original = JSON.parse(h.storage.get(draftKey()));
  const upload = name => h.input("Upload or replace demo video").props.onChange({ currentTarget: { files: [{ name }], value: "" } });
  upload("first.mp4"); h.render(); upload("second.mp4"); h.render();
  h.rejectVideoUpload(); await new Promise(setImmediate); h.render();
  assert.equal(h.draftInputs.at(-1).sourceAssetId, id(3));
  assert.deepEqual(JSON.parse(h.storage.get(draftKey())), original);
});

test("Hook demo editor has only trim/text tools while audio and legacy framing recovery stay in Demo", () => {
  const stored = draft(2);
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]) });
  const tree = h.render({ allowDemoAudio: false });
  const editor = nodes(tree).find(n => n.type === "portal" && n.props.target === h.props.editControlsTarget);
  const overview = nodes(tree).find(n => n.type === "portal" && n.props.target === h.props.controlsTarget);
  assert.ok(nodes(editor).some(n => n.props?.["aria-label"] === "Demo trim"));
  assert.ok(nodes(editor).some(n => n.type === "RemixTextSection"));
  assert.ok(nodes(editor).some(n => n.type === textFields.FormatVideoTextFields));
  assert.equal(nodes(editor).some(n => n.type === "WorkflowDemoControls" || n.type === "WorkflowFilePicker" || n.type === "WorkflowSavedAudioPicker"), false);
  assert.doesNotMatch(text(editor), /Crop & zoom|Original sound|Demo sound/);
  assert.equal(nodes(editor).some(n => n.props?.["aria-label"] === "Demo original volume"), false);
  assert.ok(nodes(overview).some(n => n.props?.["aria-label"] === "Demo original volume"));
  assert.ok(nodes(overview).some(n => n.props?.["aria-label"] === "Background audio settings"));
  assert.ok(nodes(overview).some(n => n.type === "Button" && text(n) === "Reset demo framing"));
  assert.deepEqual(normalize(h.draftInputs.at(-1).content.framing), stored.framing, "Removing crop tools must not silently rewrite saved media edits");
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: empty Demo card uploads and chooses saved demos without opening the side panel`, async () => {
    const h = harness(); h.render({ active: false, editActive: false, editPreviewActive: true });
    const sourceActions = () => h.find(n => n.type === "WorkflowClipSourceActions");
    assert.ok(sourceActions()); assert.equal(sourceActions().props.label, "demo video");
    sourceActions().props.onChooseAssets(); h.render();
    const library = h.find(n => n.type === "WorkflowVideoAssetPicker"); assert.equal(library.props.open, true);
    assert.equal(library.props.library, "content");
    assert.equal(h.sourceInput.library, "content"); assert.equal(h.sourceInput.assetLibrary, "content");
    assert.equal(sourceActions().props.library, "content");
    library.props.onOpenChange(false); h.render(); assert.equal(h.dirty, 0, "Cancelling the chooser does not change a draft");
    const pending = sourceActions().props.onUpload({ name: "demo.mp4" }); h.render();
    assert.equal(h.button("Edit demo video").props.disabled, false, "A pending upload must not trap editing");
    h.completeVideoUpload(asset(2)); await pending; h.render();
    assert.equal(h.find(n => n.type === "video" && n.props.src === asset(2).url).props.src, asset(2).url);
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey())).demoId, id(2));
    assert.equal(h.saveRun(), undefined, "Uploading does not start a render");
  });
  for (const playback of ["once", "repeat"]) test(`${format}: background library selection saves ${playback} and keeps demo edits`, async () => {
    const stored = { ...draft(), backgroundMusic: false };
    const h = harness({ format, storage: new Map([[draftKey("owner", format), JSON.stringify(stored)]]) });
    h.render({ opening: output(1), videoId: id(1), openingRevision: 1 });
    const picker = h.find(node => node.type === "WorkflowBackgroundAudioPicker");
    assert.ok(picker); assert.equal(await picker.props.onChoose({ name: "Hook track 01.mp3" }, playback), true); h.render();
    const next = readFormatDemoDraft(h.storage.get(draftKey("owner", format)));
    assert.equal(next.backgroundAudioId, id(4)); assert.equal(next.backgroundMusic, true); assert.equal(next.backgroundPlayback, playback);
    assert.equal(next.audioId, stored.audioId); assert.deepEqual(normalize(next.editing), stored.editing); assert.deepEqual(normalize(next.framing), stored.framing);
    const savedSpeech = h.find(node => node.type === "WorkflowSavedAudioPicker");
    assert.ok(savedSpeech, "Demo speech remains a separate personal recording choice");
    assert.notEqual(savedSpeech.props.attachment, picker.props.attachment);
    assert.equal(h.uploads.length, 1); assert.equal(h.uploads[0][4].purpose, "explore-demo");
  });
  test(`${format}: background upload in the overview preserves demo text, trim and its separate audio`, async () => {
    const stored = { ...draft(), audioId: id(4), framing: { version: 1, width: 1, height: 1, points: [[0, 0, 0], [7000, 0, 0]] } };
    const h = harness({ format, storage: new Map([[draftKey("owner", format), JSON.stringify(stored)]]) });
    h.render({ editActive: false, opening: output(1), videoId: id(1), openingRevision: 1 });
    const picker = h.find(node => node.type === "WorkflowFilePicker" && node.props.label === "Upload background audio");
    assert.equal(await picker.props.attachment.choose({ name: "soundtrack.mp3" }), true); h.render();
    const next = readFormatDemoDraft(h.storage.get(draftKey("owner", format)));
    assert.equal(next.backgroundMusic, true); assert.equal(next.backgroundAudioId, id(4));
    assert.deepEqual(normalize(next.editing), stored.editing);
    assert.equal(next.audioId, stored.audioId); assert.deepEqual(normalize(next.framing), stored.framing);
    h.button("Schedule").props.onClick(); h.render();
    assert.equal(h.saveRun().props.save.background.id, id(4));
    assert.equal(h.saveRun().props.save.audio.id, id(4));
    picker.props.attachment.remove(); h.render();
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey("owner", format))).backgroundAudioId, null);
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey("owner", format))).audioId, stored.audioId);
    assert.equal(h.uploads.length, 1);
  });
  test(`${format}: background audio is a persisted preference and does not render on toggle`, () => {
    const h = harness({ format }); h.render({ editActive: false });
    const toggle = () => h.input("Background audio");
    assert.equal(toggle().props.role, "switch"); assert.equal(toggle().props["aria-checked"], false);
    toggle().props.onClick(); h.render();
    assert.equal(toggle().props["aria-checked"], true);
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey("owner", format))).backgroundMusic, true);
    assert.equal(h.saveRun(), undefined); assert.equal(h.uploads.length, 0);
    h.select(); assert.equal(toggle().props["aria-checked"], true, "Choosing a demo keeps the soundtrack preference");
    h.find(n => n.props?.["aria-label"] === "Remove demo").props.onClick(); h.render();
    assert.equal(toggle().props["aria-checked"], true, "Music can accompany an opening without a demo");
    const restored = harness({ format, storage: h.storage }); restored.render({ opening: output(1) });
    assert.equal(restored.input("Background audio").props["aria-checked"], true);
    assert.equal(restored.button("Save final video").props.disabled, false);
    assert.equal(restored.find(n => n.type === "Button" && text(n) === "Continue without demo"), undefined, "Cannot silently skip selected soundtrack");
    restored.button("Save final video").props.onClick(); restored.render();
    assert.equal(restored.saveRun().props.save.demo, null);
    assert.equal(restored.saveRun().props.save.draft.backgroundMusic, true);
    restored.input("Background audio").props.onClick(); restored.render();
    assert.equal(restored.input("Background audio").props["aria-checked"], true, "A pending save keeps its frozen music preference");
    const run = restored.saveRun(); run.props.onSaved(output(5)); run.props.onBusy(false); restored.render();
    const dirty = restored.dirty;
    restored.input("Background audio").props.onClick(); restored.render();
    assert.equal(restored.saveRun(), undefined); assert.equal(restored.dirty, dirty + 1);
    assert.equal(restored.input("Background audio").props["aria-checked"], false);
    assert.ok(restored.button("Continue without demo"));
  });
  test(`${format}: a pending source replacement blocks the background audio switch`, () => {
    const h = harness({ format }); h.render({ pendingSource: true });
    h.input("Background audio").props.onClick(); h.render();
    assert.equal(h.input("Background audio").props["aria-checked"], false);
    assert.equal(h.dirty, 0); assert.equal(h.saveRun(), undefined);
  });
  test(`${format}: Demo preview keeps tools hidden until its own Edit action`, () => {
    const h = harness({ format }); h.render(); h.select();
    h.render({ active: false, editActive: false, editPreviewActive: true });
    assert.ok(h.find(n => n.props?.["aria-label"] === "Demo edit preview"));
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim"), undefined);
    h.props.onEdit = () => h.render({ editActive: true }); h.render();
    h.button("Edit demo video").props.onClick();
    assert.ok(h.find(n => n.props?.["aria-label"] === "Demo trim"));
    h.find(n => n.props?.["aria-label"] === "Demo trim start").props.onChange({ target: { value: "1" } });
    h.render({ editActive: false });
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim"), undefined);
    h.button("Edit demo video").props.onClick();
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim start").props.value, 1);
    assert.equal(h.find(n => n.type === "DemoSaveRun"), undefined);
  });
  test(`${format}: changing Demo trim seeks the preview and warns if framing would cut its own text`, () => {
    const h = harness({ format }); h.select();
    const player = { currentTime: 7, paused: true, pause() {} };
    h.input("Demo video being edited").props.ref.current = player;
    h.edit("Demo trim start", 2); assert.equal(player.currentTime, 2);
    const fields = h.find(n => n.type === textFields.FormatVideoTextFields);
    fields.props.onChange({ ...fields.props.editing, text: { value: "Demo title", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 6000 } }); h.render();
    h.draftInputs.at(-1).onRestore({ ...h.draftInputs.at(-1).content, workflowMusic: undefined, framing: { version: 1, width: .5, height: .5, points: [[0, .25, .4]] } }, true); h.render();
    assert.match(text(h.find(n => n.props?.role === "status")), /crop may cut off this heading/);
    assert.match(text(h.find(n => n.props?.["aria-label"] === "Demo edit preview")), /Full clip preview/);
  });
  test(`${format}: Demo edit entry opens the shared editor and keeps clip text through Apply and restore`, async () => {
    const h = harness({ format }); h.render({ editActive: false, editPreviewActive: true }); h.select();
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim start"), undefined, "Demo selection screen does not duplicate editing tools");
    h.props.onEdit = () => h.render({ active: false, editActive: true });
    h.render(); h.button("Edit demo video").props.onClick();
    assert.equal(h.input("Demo video being edited").props.src, asset(2).url);
    assert.equal(h.input("Demo trim end").props.value, 8);
    const fields = h.find(n => n.type === textFields.FormatVideoTextFields);
    const overlay = { value: "My demo heading", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 8000 };
    fields.props.onChange({ ...fields.props.editing, text: overlay }); h.render();
    const stored = normalize(readFormatDemoDraft(h.storage.get(draftKey("owner", format))));
    assert.deepEqual(stored.editing.text, overlay);
    h.props.onEditDone = () => h.render({ active: true, editActive: false }); h.render();
    await h.button("Save edits").props.onClick();
    assert.equal(h.draftSaves.length, 1, "Apply persists one draft snapshot");
    assert.deepEqual(h.draftSaves[0].editing.text, overlay);
    assert.equal(h.saveRun(), undefined, "Save edits does not render the publishing file");
    assert.ok(h.input("Demo trim start"), "Saving keeps the focused editor open");
    h.button("Back to videos").props.onClick();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.ok(h.button("Replace demo"), "Sidebar keeps the original replacement control");
    assert.ok(h.button("Saved demos"), "Sidebar keeps its separate asset-library control");
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim start"), undefined);
    const restored = harness({ format, storage: h.storage }); restored.render({ opening: output(1) });
    assert.deepEqual(normalize(restored.find(n => n.type === textFields.FormatVideoTextFields).props.editing.text), overlay);
    restored.button("Save final video").props.onClick(); restored.render();
    assert.deepEqual(normalize(restored.saveRun().props.save.draft.editing.text), overlay);
    assert.equal(restored.saveRun().props.save.opening.id, id(1));
  });
  test(`${format}: Demo ignores the opening reference and retains independent manual text controls`, () => {
    const stored = draft();
    stored.editing.text = { value: "Demo caption", width: .94, y: .075, fontSize: 56, color: "#ffffff", startMs: 100, endMs: 1500, preset: "snapchat-classic", backgroundOpacity: .4 };
    const storage = new Map([[draftKey("owner", format), JSON.stringify(stored)]]);
    const h = harness({ format, storage }); h.render({ opening: output(1), remixReference: { id: "reference-a", format } });
    const remix = h.find(n => n.type === "RemixTextSection");
    assert.ok(!remix.props.expanded && remix.props.editorNavigation, "Demo keeps Remix as one compact optional entry beside its manual text controls");
    assert.equal(remix.props.reference, undefined, "Demo remix never inherits the opening reference");
    assert.equal(remix.props.format, "hook");
    assert.match(remix.props.targetKey, /^demo:/);
    const fields = h.find(n => n.type === textFields.FormatVideoTextFields);
    fields.props.onChange({ ...fields.props.editing, text: { ...fields.props.editing.text, value: "New demo copy" } });
    h.render();
    const saved = normalize(readFormatDemoDraft(storage.get(draftKey("owner", format))));
    assert.deepEqual(saved, { ...stored, editing: { ...stored.editing, text: { ...stored.editing.text, value: "New demo copy" } } });
    assert.equal(saved.editing.format, "hook");
  });
  test(`${format}: failed Demo replacement preserves restored trim, sound, framing and ready save`, async () => {
    const stored = draft(); stored.framing.height = .5;
    const storage = new Map([[draftKey("owner", format), JSON.stringify(stored)]]);
    const h = harness({ format, storage }); h.props.opening = output(1); h.render();
    assert.equal(h.button("Save final video").props.disabled, false);
    const previousDirty = h.dirty;
    const pending = h.input("Upload or replace demo video").props.onChange({ currentTarget: { files: [{ name: "invalid.mp4" }], value: "invalid.mp4" } });
    h.render(); h.rejectVideoUpload(); await new Promise(setImmediate); h.render();
    assert.ok(h.find(n => n.props?.["aria-label"] === "Selected demo video" && n.props.src === asset(2).url));
    assert.deepEqual(JSON.parse(storage.get(draftKey("owner", format))), stored);
    assert.equal(h.dirty, previousDirty); assert.equal(h.button("Save final video").props.disabled, false);
    assert.match(text(h.find(n => n.props?.role === "alert")), /previous demo is kept/);
    assert.equal(h.uploads.length, 0); void pending;
  });
  test(`${format}: opening replacement blocks scheduling but leaves independent Demo source controls available`, () => {
    const h = harness({ format }); h.props.pendingSource = true; const tree = h.render();
    assert.equal(h.find(n => n.type === "fieldset").props.disabled, false);
    assert.equal(h.button("Save final video").props.disabled, true);
    assert.equal(nodes(tree).some(n => n.type === "DemoSaveRun"), false);
  });
  test(`${format}: a demo can schedule alone, while merging waits for an owned opening`, () => {
    const h = harness({ format }); h.render();
    assert.ok(h.button("Upload demo"));
    assert.ok(h.button("Saved demos"));
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
    assert.equal(h.button("Save final video").props.disabled, true);
    h.select();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.equal(h.selectionReports.at(-1), true);
    assert.equal(h.button("Save final video").props.disabled, false);
    h.render({ opening: output(99), openingRevision: 1 });
    h.button("Save final video").props.onClick(); h.render();
    assert.equal(h.saveRun(), undefined, "Schedule may open, but an unverified opening cannot merge");
    h.render({ videoId: id(1), opening: output(1), openingRevision: 2 });
    assert.equal(h.button("Save final video").props.disabled, false);
    assert.equal(h.saveRun().props.save.opening.id, id(1), "The explicit Schedule request waits until the opening becomes verified");
  });

  test(`${format}: creating, saving, editing and replacing an opening retain demo trim, framing and audio`, async () => {
    const h = harness({ format }); h.select();
    h.edit("Demo trim start", .5); h.edit("Demo trim end", 6.5); h.edit("Demo original volume", 35);
    h.draftInputs.at(-1).onRestore({ ...h.draftInputs.at(-1).content, workflowMusic: undefined, framing: draft().framing }, true); h.render();
    const audioPicker = h.find(node => node.type === "WorkflowFilePicker" && node.props.label === "Upload demo audio");
    assert.equal(await audioPicker.props.attachment.choose({ name: "music.mp3" }), true); h.render();
    h.edit("Demo added audio volume", 60); h.edit("Demo audio playback", "repeat");
    const expected = normalize(readFormatDemoDraft(h.storage.get(draftKey("owner", format))));
    assert.deepEqual(expected, draft(), "Every chosen demo edit is saved in the workflow draft");
    for (const patch of [
      { active: false, videoId: id(1) }, { active: true, opening: output(1), openingRevision: 1 },
      { opening: null, openingRevision: 2 }, { opening: output(1), openingRevision: 2 },
      { opening: null, videoId: null, openingRevision: 3 }, { opening: output(3), videoId: id(3), openingRevision: 4 },
    ]) {
      h.render(patch);
      assert.deepEqual(normalize(readFormatDemoDraft(h.storage.get(draftKey("owner", format)))), expected);
      if (patch.active !== false && h.props.active) {
        assert.equal(h.input("Selected demo video").props.src, asset(2).url);
        assert.equal(h.input("Demo trim start").props.value, .5);
        assert.equal(h.input("Demo trim end").props.value, 6.5);
        assert.equal(h.input("Demo original volume").props.value, 35);
        assert.equal(h.input("Demo audio playback").props.value, "repeat");
        assert.deepEqual(normalize(h.draftInputs.at(-1).content.framing), normalize(draft().framing));
      }
    }
    assert.equal(h.uploads.length, 1);
  });

  test(`${format}: a demo upload completing after opening selection or replacement remains selected`, async () => {
    const h = harness({ format }); h.render();
    const event = { currentTarget: { files: [{ name: "demo.mp4" }], value: "demo.mp4" } };
    h.find(n => n.type === "WorkflowClipSourceActions").props.onUpload(event.currentTarget.files[0]); h.render();
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
    h.render({ videoId: id(1), opening: output(1), openingRevision: 1 });
    h.render({ videoId: id(3), opening: null, openingRevision: 2 });
    h.completeVideoUpload(); await Promise.resolve(); h.render();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
    assert.equal(h.button("Save final video").props.disabled, false, "Schedule opens a preparation preview while the replacement is verified");
    h.button("Save final video").props.onClick(); h.render();
    assert.equal(h.saveRun(), undefined, "An unprepared selected opening must not be treated as a demo-only request");
    h.render({ opening: output(3), openingRevision: 3 });
    assert.equal(h.button("Save final video").props.disabled, false);
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey("owner", format))).demoId, id(2));
  });
}

test("an opening edit invalidates merge busy state and a finished result even when its asset ID is reused", () => {
  const h = harness(); h.select(); h.render({ opening: output(1), videoId: id(1), openingRevision: 1 });
  h.button("Save final video").props.onClick(); h.render();
  const first = h.saveRun(); assert.ok(first); assert.equal(first.props.save.openingRevision, 1);
  first.props.onBusy(true); h.render();
  assert.equal(h.find(node => node.type === "fieldset").props.disabled, true);
  h.render({ opening: null, openingRevision: 2 });
  assert.equal(h.saveRun(), undefined);
  assert.equal(h.find(node => node.type === "fieldset").props.disabled, false, "Stale render busy state must not lock demo editing");
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
  first.props.onSaved(output(5)); h.render();
  assert.equal(h.savedReports.length, 0, "A completed prior revision cannot publish into Schedule");
  assert.equal(h.find(node => node.props?.["aria-label"] === "Merged final video"), undefined);
  h.render({ opening: output(1) });
  assert.equal(h.saveRun(), undefined, "A reused opening ID cannot reactivate its old save revision");
  h.button("Save final video").props.onClick(); h.render();
  const current = h.saveRun(); assert.ok(current); assert.equal(current.props.save.openingRevision, 2);
  current.props.onBusy(false); current.props.onSaved(output(5)); h.render();
  assert.equal(h.input("Merged final video").props.src, output(5).url);
  assert.equal(h.savedReports.at(-1).id, id(5));
  h.render({ opening: output(3), videoId: id(3), openingRevision: 3 });
  assert.equal(h.find(node => node.props?.["aria-label"] === "Merged final video"), undefined);
  assert.equal(h.saveRun(), undefined);
  assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
});

test("a changed opening aspect preserves the demo draft and requires an explicit legacy framing reset in Demo before merging", () => {
  const h = harness(); h.select(); h.edit("Demo trim start", 1); h.edit("Demo trim end", 7);
  const framing = { version: 1, width: .8, height: .8, points: [[0, .1, .1], [7000, .2, .2]] };
  h.draftInputs.at(-1).onRestore({ ...h.draftInputs.at(-1).content, workflowMusic: undefined, framing }, true); h.render();
  h.render({ opening: output(1), videoId: id(1), openingRevision: 1 });
  assert.equal(h.button("Save final video").props.disabled, false);
  const selected = normalize(readFormatDemoDraft(h.storage.get(draftKey())));
  h.ownedAssets.set(id(3), { ...asset(3), width: 1280, height: 720 });
  h.render({ opening: output(3), videoId: id(3), openingRevision: 2 });
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
  assert.deepEqual(normalize(readFormatDemoDraft(h.storage.get(draftKey()))), selected);
  assert.deepEqual(normalize(h.draftInputs.at(-1).content.framing), framing);
  assert.equal(h.button("Save final video").props.disabled, true);
  assert.ok(h.find(node => node.props?.role === "alert" && /reframe|framing/i.test(text(node))), "The incompatible crop must be explained before rendering");
  assert.equal(h.saveRun(), undefined);
  h.button("Reset demo framing").props.onClick(); h.render();
  assert.equal(h.button("Save final video").props.disabled, false);
  assert.equal(h.input("Demo trim start").props.value, 1);
  assert.equal(h.input("Demo trim end").props.value, 7);
  assert.equal(readFormatDemoDraft(h.storage.get(draftKey())).demoId, id(2));
  assert.equal(readFormatDemoDraft(h.storage.get(draftKey())).framing, null);
});

test("workflow draft restoration is owner and format scoped and never needs an opening", () => {
  const storage = new Map([[draftKey(), JSON.stringify(draft())]]);
  const own = harness({ storage }); own.render();
  assert.equal(own.input("Selected demo video").props.src, asset(2).url);
  assert.equal(own.input("Demo trim start").props.value, .5);
  assert.equal(own.input("Demo audio playback").props.value, "repeat");
  assert.equal(own.selectionReports.at(-1), true);
  for (const options of [{ owner: "different-owner" }, { format: "wall_text" }]) {
    const other = harness({ ...options, storage }); other.render();
    assert.equal(other.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined);
    assert.equal(other.button("Save final video").props.disabled, true);
  }
  assert.deepEqual(normalize(readFormatDemoDraft(storage.get(draftKey()))), draft());
});

test("signed-in preview selection and removal preserve the real workflow draft and never migrate legacy drafts", async () => {
  const realKey = draftKey(), previewKey = "ugc-explore:demo:preview:v2:owner:hook";
  const legacyKey = `ugc-explore:demo:v1:owner:hook:${id(1)}`;
  const realDraft = JSON.stringify(draft()), legacyDraft = JSON.stringify(draft(3));
  const storage = new Map([[realKey, realDraft], [legacyKey, legacyDraft]]);
  const h = harness({ storage, enabled: false }); h.render({ localPreview: true, videoId: id(1) });
  assert.equal(h.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined);
  assert.equal(storage.get(previewKey), undefined, "Preview must not migrate the legacy opening draft");
  const event = { currentTarget: { files: [{ name: "local-demo.mp4" }], value: "local-demo.mp4" } };
  h.find(n => n.type === "WorkflowClipSourceActions").props.onUpload(event.currentTarget.files[0]); h.render();
  h.completeVideoUpload(null); await Promise.resolve(); h.render();
  assert.equal(h.input("Selected demo video").props.src, "blob:local-demo");
  assert.equal(readFormatDemoDraft(storage.get(previewKey)).demoId, null);
  assert.equal(storage.get(realKey), realDraft);
  h.find(n => n.props?.["aria-label"] === "Remove demo").props.onClick(); h.render();
  assert.equal(h.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined);
  assert.equal(storage.get(realKey), realDraft);
  assert.equal(storage.get(legacyKey), legacyDraft);
  assert.equal(h.uploads.length, 0, "Local preview cannot upload owned media");
});

test("an untouched legacy draft migrates when opening identity arrives after first mount", () => {
  const legacyKey = `ugc-explore:demo:v1:owner:hook:${id(1)}`;
  const storage = new Map([[legacyKey, JSON.stringify(draft())]]);
  const h = harness({ storage }); h.render();
  assert.equal(h.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined);
  h.render({ videoId: id(1) });
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
  assert.equal(h.input("Demo trim end").props.value, 6.5);
  assert.equal(h.input("Demo audio playback").props.value, "repeat");
  assert.deepEqual(normalize(readFormatDemoDraft(storage.get(draftKey()))), draft());
});

test("a current workflow draft takes precedence over a legacy opening draft", () => {
  const legacyKey = `ugc-explore:demo:v1:owner:hook:${id(1)}`;
  const storage = new Map([[legacyKey, JSON.stringify(draft())], [draftKey(), JSON.stringify(draft(3))]]);
  const h = harness({ storage }); h.render({ videoId: id(1) });
  assert.equal(h.input("Selected demo video").props.src, asset(3).url);
  assert.deepEqual(normalize(readFormatDemoDraft(storage.get(draftKey()))), draft(3));
});

test("legacy opening drafts cannot overwrite a selected or explicitly removed workflow demo", () => {
  const legacyKey = `ugc-explore:demo:v1:owner:hook:${id(1)}`;
  for (const remove of [false, true]) {
    const storage = new Map([[legacyKey, JSON.stringify(draft())]]);
    const h = harness({ storage }); h.select(asset(3));
    if (remove) { h.find(n => n.props?.["aria-label"] === "Remove demo").props.onClick(); h.render(); }
    h.render({ videoId: id(1) });
    assert.equal(readFormatDemoDraft(storage.get(draftKey())).demoId, remove ? null : id(3));
    if (remove) {
      assert.equal(h.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined);
      assert.equal(h.selectionReports.at(-1), false);
      const reloaded = harness({ storage }); reloaded.render({ videoId: id(1) });
      assert.equal(reloaded.find(node => node.props?.["aria-label"] === "Selected demo video"), undefined, "Explicit removal must survive reopening the old opening");
    }
    else assert.equal(h.input("Selected demo video").props.src, asset(3).url);
  }
});

test("local preview restores its demo fixture without an owned fetch or changing edits", () => {
  const value = { ...draft(), audioId: null };
  const storage = new Map([["ugc-explore:demo:preview:v2:owner:hook", JSON.stringify(value)]]);
  const h = harness({ storage, enabled: false });
  h.render({ localPreview: true, previewAssets: [asset(2)] });
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
  assert.equal(h.input("Demo trim end").props.value, 6.5);
  assert.equal(h.queryInputs.some(query => query.enabled), false);
  assert.equal(h.button("Save final video").props.disabled, false, "Local preview allows navigation but cannot dispatch finishing");
});

test("local preview gives an unavailable fixture a recovery message instead of indefinite restoration", () => {
  const storage = new Map([["ugc-explore:demo:preview:v2:owner:hook", JSON.stringify(draft())]]);
  const h = harness({ storage, enabled: false });
  const tree = h.render({ localPreview: true, previewAssets: [] });
  assert.ok(text(tree).includes("This preview clip is unavailable."), text(tree));
  assert.ok(!text(tree).includes("Restoring your demo…"));
  assert.equal(h.button("Save final video").props.disabled, true);
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: Schedule shows no source clips while joining, then exactly one finished video`, () => {
    const h = harness({ format }); h.select();
    h.render({ opening: output(1), openingRevision: 1, scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
    h.props.onContinue(); h.render();
    const schedule = () => h.find(node => node.props?.["aria-label"] === "Schedule video preview");
    assert.equal(nodes(schedule()).filter(node => node.type === "video").length, 0, "A raw Hook/Demo must not look like the final scheduled result");
    const run = h.saveRun(); assert.ok(run);
    run.props.onSaved(output(5)); h.render();
    const videos = nodes(schedule()).filter(node => node.type === "video");
    assert.equal(videos.length, 1);
    assert.equal(videos[0].props.src, output(5).url);
    h.render({ opening: null, openingRevision: 2 });
    assert.equal(nodes(schedule()).filter(node => node.type === "video").length, 0, "Editing the opening invalidates its previous combined preview");
  });
}

test("a standalone finished opening appears once, but adding background music requires a new final result", () => {
  const h = harness();
  h.render({ opening: output(1), scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false, finalVideo: output(1) });
  const schedule = () => h.find(node => node.props?.["aria-label"] === "Schedule video preview");
  assert.equal(nodes(schedule()).filter(node => node.type === "video").length, 1);
  h.render({ active: true });
  h.find(node => node.props?.["aria-label"] === "Background audio").props.onClick(); h.render();
  assert.equal(nodes(schedule()).filter(node => node.type === "video").length, 0, "The old opening cannot stand in for the pending audio mix");
  h.render({ finalVideo: output(5) });
  assert.equal(nodes(schedule()).find(node => node.type === "video").props.src, output(5).url);
});

test("an opening preparation failure keeps Schedule free of source clips and offers retry", () => {
  const h = harness(); h.render({ videoId: id(1), sourcePreview: { url: asset(1).url }, scheduleActive: true, scheduleResultsTarget: {}, openingPreparation: { busy: false, error: "Render failed. Try again." } });
  const schedule = h.find(node => node.props?.["aria-label"] === "Schedule video preview");
  assert.equal(nodes(schedule).filter(node => node.type === "video").length, 0);
  assert.match(text(schedule), /Render failed/);
  h.button("Retry preparation").props.onClick();
  assert.equal(h.props.prepareRequest, 1);
});

test("Schedule immediately previews the live Hook and Demo drafts without reporting them as published output", () => {
  const hookText = { value: "Hook only", width: .8, y: .2, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  const demoText = { ...hookText, value: "Demo only" };
  const stored = { ...draft(), framing: null, editing: { ...draft().editing, text: demoText } };
  const openingPreview = { segment: { id: id(1), label: "Hook", url: "/original-hook.mp4", durationSeconds: 8, width: 720, height: 1280,
    editing: { ...defaultDemoEdit(8), trimStartMs: 2000, trimEndMs: 7000, text: hookText },
    addedAudio: { url: "/hook-music.mp3", volume: .4, playback: "repeat", timelineOffsetMs: 2000, mixDurationMs: 8000 } }, referenceAudio: null };
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]) });
  h.render({ opening: output(1), openingPreview, openingRevision: 1, scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
  const player = h.find(n => n.type === "WorkflowSequencePreview"); assert.ok(player);
  const [hook, demo] = normalize(player.props.segments);
  assert.equal(hook.url, "/original-hook.mp4"); assert.equal(hook.editing.trimStartMs, 2000);
  assert.deepEqual(hook.editing.text, hookText); assert.equal(hook.addedAudio.timelineOffsetMs, 2000);
  assert.equal(demo.url, asset(2).url); assert.deepEqual(demo.editing.text, demoText);
  assert.equal(demo.editing.trimStartMs, 500); assert.equal(demo.editing.trimEndMs, 6500);
  assert.equal(demo.addedAudio.url, asset(4, "audio").url); assert.equal(demo.addedAudio.volume, .6);
  assert.notEqual(hook.id, demo.id); assert.equal(player.props.backgroundAudio, null);
  assert.equal(h.savedReports.length, 0); assert.equal(h.saveRun(), undefined);
  assert.equal(h.uploads.length, 0, "Previewing drafts cannot upload or create a finishing receipt");
});

test("a playing sequence stays mounted when its verified file arrives, then switches only on request", () => {
  const h = harness(); h.select();
  h.render({ opening: output(1), openingRevision: 1, scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
  h.props.onContinue(); h.render();
  const player = () => h.find(n => n.type === "WorkflowSequencePreview");
  player().props.onPlaybackStart(); h.render();
  const run = h.saveRun(); run.props.onSaved(output(5)); run.props.onBusy(false); h.render();
  assert.ok(player(), "The final file must not interrupt current preview playback");
  assert.equal(h.find(n => n.props?.["aria-label"] === "Final video"), undefined);
  h.button("View finished video").props.onClick(); h.render();
  assert.equal(player(), undefined); assert.equal(h.input("Final video").props.src, output(5).url);
  h.render({ openingRevision: 2, opening: null });
  assert.equal(h.find(n => n.props?.["aria-label"] === "Final video"), undefined);
});

test("background schedule snapshots raw clip edits, independent sound and global music without dispatching exports", async () => {
  const stored = { ...draft(), framing: null, backgroundMusic: true, backgroundAudioId: id(6), backgroundPlayback: "repeat" };
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]), owned: [asset(1), asset(2), asset(4, "audio"), asset(5, "audio"), asset(6, "audio")] });
  let composition;
  const sourceEditing = { ...defaultDemoEdit(8), trimStartMs: 1000, trimEndMs: 4000, originalVolume: .7, musicVolume: .4 };
  h.render({ videoId: id(1), opening: null, backgroundScheduling: true, sourcePreview: { name: "Hook", url: asset(1).url, duration: 8 },
    openingClipState: { sourceId: id(1), editing: sourceEditing, backgroundAssetId: id(5), backgroundPlayback: "repeat", output: null, busy: false, error: null, needsSaving: true },
    onPendingCompositionChange: value => { composition = value; }, scheduleActive: true, scheduleResultsTarget: {} });
  assert.equal(composition.error, null);
  const value = await composition.resolve();
  assert.equal(value.sourceAssetId, id(1)); assert.equal(value.demoAssetId, id(2));
  assert.deepEqual(normalize(value.composition.sourceEditing), normalize(sourceEditing));
  assert.deepEqual(normalize(value.composition.demoEditing), normalize(editDraft.prepareFormatEditForExport(stored.editing)));
  assert.equal(value.composition.sourceAudioAssetId, id(5)); assert.equal(value.demoAudioAssetId, id(4)); assert.equal(value.backgroundAssetId, id(6));
  assert.equal(h.uploads.length, 0); assert.equal(h.savedReports.length, 0);
});

test("a pending or failed soundtrack selection cannot save or schedule the previous demo audio", async () => {
  const stored = { ...draft(), framing: null };
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]) });
  let composition;
  h.audio.loading = true;
  h.render({ backgroundScheduling: true, onPendingCompositionChange: value => { composition = value; }, prepareRequest: 1 });
  assert.match(composition.error, /selected media to finish uploading/);
  assert.equal(h.button("Save edits").props.disabled, true);
  assert.equal(h.saveRun(), undefined);
  await assert.rejects(composition.resolve(), /selected media to finish uploading/);
  h.audio.loading = false; h.audio.error = "Selected audio unavailable.";
  h.render();
  assert.equal(composition.error, h.audio.error);
  assert.equal(h.button("Save edits").props.disabled, true);
  assert.equal(h.saveRun(), undefined);
  await assert.rejects(composition.resolve(), /Selected audio unavailable/);
  h.audio.error = null; h.render({ prepareRequest: 0 });
  assert.equal(composition.error, null);
  assert.equal(h.button("Save edits").props.disabled, false);
  assert.equal((await composition.resolve()).sourceAssetId, id(2));
});

test("reference music continues globally without replacing the Demo's independent soundtrack", () => {
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify({ ...draft(), framing: null })]]) });
  const track = { url: "/paired-reference.mp3", volume: .35, playback: "repeat" };
  h.render({ opening: output(1), openingPreview: { segment: { id: id(1), label: "Hook", url: "/clean-hook.mp4", durationSeconds: 8, width: 720, height: 1280 }, referenceAudio: track },
    scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
  const player = h.find(n => n.type === "WorkflowSequencePreview");
  assert.deepEqual(normalize(player.props.backgroundAudio), track);
  assert.equal(player.props.segments[0].url, "/clean-hook.mp4");
  assert.equal(player.props.segments[1].addedAudio.url, asset(4, "audio").url);
  assert.equal(h.savedReports.length, 0);
});

test("a paired Demo uses its clean speech base and retains its selected added audio through both opening modes", () => {
  const stored = { ...draft(), framing: null };
  const pairedDemo = { ...asset(2), metadata: { referenceAudioPreview: { referenceId: "demo-pair", title: "Demo reference",
    audioUrl: "/demo-reference.mp3", cleanVideoUrl: "/clean-demo.mp4", volume: .3 } } };
  const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]), owned: [asset(1), pairedDemo, asset(4, "audio")] });
  const openingPreview = { segment: { id: id(1), label: "Hook", url: "/clean-hook.mp4", durationSeconds: 8, width: 720, height: 1280 }, referenceAudio: null };
  h.render({ opening: output(1), openingPreview, scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
  const segment = () => h.find(n => n.type === "WorkflowSequencePreview").props.segments[1];
  assert.equal(segment().url, "/clean-demo.mp4"); assert.equal(segment().referenceAudio.url, "/demo-reference.mp3");
  assert.equal(segment().referenceAudio.volume, .6, "The sound pass uses the selected Demo music volume");
  assert.equal(segment().addedAudio.url, asset(4, "audio").url); assert.equal(segment().editing.originalVolume, .35);
  h.render({ openingPreview: { ...openingPreview, referenceAudio: { url: "/opening-reference.mp3", volume: .2, playback: "repeat" } } });
  assert.equal(segment().url, "/clean-demo.mp4"); assert.equal(segment().referenceAudio, null, "The continuous opening track replaces the Demo pair");
  assert.equal(segment().addedAudio.url, asset(4, "audio").url);
});

for (const kind of ["demo", "background"]) {
  test(`a restored ${kind} soundtrack keeps Play unavailable until the selected owned audio loads`, () => {
    const stored = { ...draft(), framing: null, audioId: kind === "demo" ? id(4) : null,
      backgroundMusic: kind === "background", backgroundAudioId: kind === "background" ? id(4) : null };
    const h = harness({ storage: new Map([[draftKey(), JSON.stringify(stored)]]), owned: [asset(1), asset(2)] });
    h.render({ opening: output(1), scheduleActive: true, scheduleResultsTarget: {}, active: false, editActive: false });
    const player = () => h.find(n => n.type === "WorkflowSequencePreview");
    assert.match(player().props.playbackDisabledReason, /Loading.*audio|Loading background music/);
    h.queryFailures.add(kind === "demo" ? "format-demo-audio" : "format-background-audio"); h.render();
    assert.match(player().props.playbackDisabledReason, /could not load/);
    h.queryFailures.clear(); h.ownedAssets.set(id(4), asset(4, "audio")); h.render();
    assert.equal(player().props.playbackDisabledReason, null);
    assert.equal(kind === "demo" ? player().props.segments[1].addedAudio.url : player().props.backgroundAudio.url, asset(4, "audio").url);
    assert.equal(h.savedReports.length, 0);
  });
}


test("Demo remix applies only to its own draft, retains trim, framing and sound, and saves without rendering", async () => {
  const stored = draft();
  stored.framing.height = .5;
  const openingKey = "ugc-explore:format-draft:v1:owner:hook:opening";
  const openingDraft = JSON.stringify({ editing: { text: "Keep this hook" } });
  const storage = new Map([[draftKey(), JSON.stringify(stored)], [openingKey, openingDraft]]);
  const h = harness({ storage }); h.render({ opening: output(1) });
  const source = { referenceId: null, slideId: null, sourceSha256: "b".repeat(64), format: "hook", status: "ready", blocks: [{ text: "Demo idea", startMs: 0, endMs: 6000 }], extractedAt: "2026-10-15T12:00:00Z", model: "manual", notes: "" };
  const remix = h.find(n => n.type === "RemixTextSection");
  assert.equal(remix.props.reference, undefined);
  assert.equal(remix.props.onUse({ blocks: ["Try the demo"], heading: "", body: "" }, source), true);
  h.render();
  const saved = normalize(readFormatDemoDraft(storage.get(draftKey())));
  assert.equal(formatTextOverlays(saved.editing)[0].value, "Try the demo");
  assert.equal(saved.editing.trimStartMs, stored.editing.trimStartMs);
  assert.equal(saved.editing.trimEndMs, stored.editing.trimEndMs);
  assert.deepEqual(saved.framing, stored.framing);
  assert.equal(saved.audioId, stored.audioId);
  assert.equal(saved.editing.originalVolume, stored.editing.originalVolume);
  assert.equal(storage.get(openingKey), openingDraft);
  assert.equal(h.saveRun(), undefined);
  await h.button("Save edits").props.onClick(); h.render();
  assert.equal(h.draftSaves.length, 1);
  assert.equal(formatTextOverlays(h.draftSaves[0].editing)[0].value, "Try the demo");
  assert.ok(h.input("Demo trim start"));
});
