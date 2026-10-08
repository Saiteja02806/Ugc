import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming } from "../lib/explore/format-demo.ts";
import { formatTextLayout, parseExploreFormatEdit } from "../worker/src/lib/explore-format-edit.ts";

const textFields = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/format-video-text-fields.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: textFields, require: () => ({ jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" }) });

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const asset = (n, collection = "video") => ({ id: id(n), status: "ready", collection, durationSeconds: 8, width: 720, height: 1280,
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
  const slots = [], effects = [], selectionReports = [], savedReports = [], queryInputs = [], uploads = [];
  const ownedAssets = new Map(owned.map(value => [value.id, value]));
  let cursor = 0, needsRender = false, tree, dirty = 0, pendingVideo = null, sourceInput;
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const sourceState = { mode: "upload", selected: null, uploaded: null, preview: null, busy: false, error: null };
  const audio = { asset: null, loading: false, error: null, async choose(file) { this.asset = { name: file.name, url: "blob:audio", duration: 8, file }; return true; }, remove() { this.asset = null; } };
  const props = { format, videoId: null, opening: null, openingRevision: 0, enabled, active: true,
    controlsTarget: { name: "controls" }, actionsTarget: { name: "actions" }, resultsTarget: { name: "results" },
    editActive: true, editControlsTarget: { name: "edit-controls" }, editActionsTarget: { name: "edit-actions" }, editResultsTarget: { name: "edit-results" },
    onDirty: () => { dirty++; }, onSaved: result => savedReports.push(result), onSkip() {}, onEdit() {}, onEditDone() {}, onCreate() {}, onContinue() {},
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
      return new Promise(resolve => { pendingVideo = { file, callback, resolve }; });
    },
    clearSelection() { sourceState.selected = null; sourceState.uploaded = null; sourceState.preview = null; sourceState.error = null; sourceState.busy = false; },
    clearUploadError() { sourceState.error = null; },
  };
  const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: "fragment" };
  const imports = {
    react, "react/jsx-runtime": jsx, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery(input) { queryInputs.push(input); return { data: input.enabled ? ownedAssets.get(input.queryKey.at(-1)) : undefined, refetch() {} }; } },
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
    "@/lib/explore/format-demo": { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming },
    "@/worker/src/lib/explore-format-edit": { parseExploreFormatEdit, formatTextLayout },
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
  return { render, props, storage, ownedAssets, queryInputs, uploads, selectionReports, savedReports, get dirty() { return dirty; },
    find, button(label) { const found = find(node => node.type === "Button" && text(node).trim() === label); assert.ok(found, `Missing ${label}`); return found; },
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

for (const format of ["hook", "wall_text"]) {
  test(`${format}: background audio is a persisted preference and does not render on toggle`, () => {
    const h = harness({ format }); h.render({ editActive: false });
    const toggle = () => h.input("Background audio");
    assert.equal(toggle().props.role, "switch"); assert.equal(toggle().props["aria-checked"], false);
    toggle().props.onClick(); h.render();
    assert.equal(toggle().props["aria-checked"], true);
    assert.equal(readFormatDemoDraft(h.storage.get(draftKey("owner", format))).backgroundMusic, true);
    assert.equal(h.saveRun(), undefined); assert.equal(h.uploads.length, 0);
    h.select(); assert.equal(toggle().props["aria-checked"], true, "Choosing a demo keeps the soundtrack preference");
    h.button("Remove").props.onClick(); h.render();
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
    h.find(n => n.type === "WorkflowDemoControls").props.onChange({ version: 1, width: .5, height: .5, points: [[0, .25, .4]] }); h.render();
    assert.match(text(h.find(n => n.props?.role === "status")), /crop may cut off this heading/);
    assert.match(text(h.find(n => n.props?.["aria-label"] === "Demo edit preview")), /Full clip preview/);
  });
  test(`${format}: Demo edit entry opens the shared editor and keeps clip text through Apply and restore`, () => {
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
    h.button("Apply demo edits").props.onClick();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.equal(h.input("Upload demo video").props.type, "file");
    assert.equal(h.find(n => n.props?.["aria-label"] === "Demo trim start"), undefined);
    const restored = harness({ format, storage: h.storage }); restored.render({ opening: output(1) });
    assert.deepEqual(normalize(restored.find(n => n.type === textFields.FormatVideoTextFields).props.editing.text), overlay);
    restored.button("Save final video").props.onClick(); restored.render();
    assert.deepEqual(normalize(restored.saveRun().props.save.draft.editing.text), overlay);
    assert.equal(restored.saveRun().props.save.opening.id, id(1));
  });
  test(`${format}: failed Demo replacement preserves restored trim, sound, framing and ready save`, async () => {
    const stored = draft(); stored.framing.height = .5;
    const storage = new Map([[draftKey("owner", format), JSON.stringify(stored)]]);
    const h = harness({ format, storage }); h.props.opening = output(1); h.render();
    assert.equal(h.button("Save final video").props.disabled, false);
    const previousDirty = h.dirty;
    const pending = h.input("Upload demo video").props.onChange({ currentTarget: { files: [{ name: "invalid.mp4" }], value: "" } });
    h.render(); h.rejectVideoUpload(); await new Promise(setImmediate); h.render();
    assert.ok(h.find(n => n.props?.["aria-label"] === "Selected demo video" && n.props.src === asset(2).url));
    assert.deepEqual(JSON.parse(storage.get(draftKey("owner", format))), stored);
    assert.equal(h.dirty, previousDirty); assert.equal(h.button("Save final video").props.disabled, false);
    assert.match(text(h.find(n => n.props?.role === "alert")), /previous demo is kept/);
    assert.equal(h.uploads.length, 0); void pending;
  });
  test(`${format}: opening replacement blocks Demo actions without turning live upload into preview`, () => {
    const h = harness({ format }); h.props.pendingSource = true; const tree = h.render();
    assert.ok(h.find(n => n.type === "fieldset" && n.props.disabled === true));
    assert.equal(h.button("Save final video").props.disabled, true);
    assert.equal(nodes(tree).some(n => n.type === "DemoSaveRun"), false);
  });
  test(`${format}: Demo controls work before an opening, and only owned saved opening enables merging`, () => {
    const h = harness({ format }); h.render();
    assert.equal(h.button("First upload demo").props.disabled, undefined);
    assert.equal(h.button("Choose from Creative Assets").props.disabled, undefined);
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
    assert.equal(h.button("Save final video").props.disabled, true);
    h.select();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.equal(h.selectionReports.at(-1), true);
    assert.equal(h.button("Save final video").props.disabled, true);
    h.render({ opening: output(99), openingRevision: 1 });
    assert.equal(h.button("Save final video").props.disabled, true, "An unverified opening cannot merge");
    h.render({ videoId: id(1), opening: output(1), openingRevision: 2 });
    assert.equal(h.button("Save final video").props.disabled, false);
    assert.equal(h.saveRun(), undefined, "Selecting a demo cannot start a render");
  });

  test(`${format}: creating, saving, editing and replacing an opening retain demo trim, framing and audio`, async () => {
    const h = harness({ format }); h.select();
    h.edit("Demo trim start", .5); h.edit("Demo trim end", 6.5); h.edit("Demo original volume", 35);
    h.find(node => node.type === "WorkflowDemoControls").props.onChange(draft().framing); h.render();
    const audioPicker = h.find(node => node.type === "WorkflowFilePicker" && node.props.kind === "audio");
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
        assert.deepEqual(normalize(h.find(node => node.type === "WorkflowDemoControls").props.value), normalize(draft().framing));
      }
    }
    assert.equal(h.uploads.length, 1);
  });

  test(`${format}: a demo upload completing after opening selection or replacement remains selected`, async () => {
    const h = harness({ format }); h.render();
    const event = { currentTarget: { files: [{ name: "demo.mp4" }], value: "demo.mp4" } };
    h.input("Upload demo video").props.onChange(event); h.render();
    assert.equal(event.currentTarget.value, "");
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, true);
    h.render({ videoId: id(1), opening: output(1), openingRevision: 1 });
    h.render({ videoId: id(3), opening: null, openingRevision: 2 });
    h.completeVideoUpload(); await Promise.resolve(); h.render();
    assert.equal(h.input("Selected demo video").props.src, asset(2).url);
    assert.equal(h.find(node => node.type === "fieldset").props.disabled, false);
    assert.equal(h.button("Save final video").props.disabled, true);
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

test("a changed opening aspect preserves the demo draft and requires reframing or an explicit reset before merging", () => {
  const h = harness(); h.select(); h.edit("Demo trim start", 1); h.edit("Demo trim end", 7);
  const framing = { version: 1, width: .8, height: .8, points: [[0, .1, .1], [7000, .2, .2]] };
  h.find(node => node.type === "WorkflowDemoControls").props.onChange(framing); h.render();
  h.render({ opening: output(1), videoId: id(1), openingRevision: 1 });
  assert.equal(h.button("Save final video").props.disabled, false);
  const selected = normalize(readFormatDemoDraft(h.storage.get(draftKey())));
  h.ownedAssets.set(id(3), { ...asset(3), width: 1280, height: 720 });
  h.render({ opening: output(3), videoId: id(3), openingRevision: 2 });
  assert.equal(h.input("Selected demo video").props.src, asset(2).url);
  assert.deepEqual(normalize(readFormatDemoDraft(h.storage.get(draftKey()))), selected);
  assert.deepEqual(normalize(h.find(node => node.type === "WorkflowDemoControls").props.value), framing);
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
  h.input("Upload demo video").props.onChange(event); h.render();
  h.completeVideoUpload(null); await Promise.resolve(); h.render();
  assert.equal(h.input("Selected demo video").props.src, "blob:local-demo");
  assert.equal(readFormatDemoDraft(storage.get(previewKey)).demoId, null);
  assert.equal(storage.get(realKey), realDraft);
  h.button("Remove").props.onClick(); h.render();
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
    if (remove) { h.button("Remove").props.onClick(); h.render(); }
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
