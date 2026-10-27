import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
const asset = number => ({ id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`, title: "Owned clip", url: `https://owned.test/${number}.mp4`, durationSeconds: 10 });
function fixture(backgroundScheduling = false) {
  const slots = [], effects = []; let cursor = 0;
  const react = { useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useCallback(value) { cursor++; return value; }, useEffect(fn) { cursor++; effects.push(fn); } };
  const imports = { "@tanstack/react-query": { useQuery: () => ({ data: props.catalogue ?? [] }) }, "./recreate-workspace": { fetchRecreateReferences: async () => [] }, react, "react/jsx-runtime": jsx, "@/components/explore/format-video-editor": { FormatVideoEditor: "editor" },
    "@/lib/trending/hook-video-client-upload": { uploadHookVideoDemo() { throw new Error("Recovery must not upload"); } },
    "@/lib/explore/format-video-source": { formatVideoFromAsset: source => ({ ...source, mediaAssetId: source.id }) },
    "@/components/explore/workflow-section-layout.module.css": { default: {} } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/explore/talking-head-clip-editing.tsx", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: key => { assert.ok(key in imports, key); return imports[key]; } });
  const props = { enabled: true, ownerId: "owner", source: asset(1), sourcePreview: null, demo: { asset: null }, demoSource: asset(2), active: true, backgroundScheduling, onDirty() {}, children: value => value };
  const render = () => { cursor = 0; const tree = exports.TalkingHeadClipEditing(props); while (effects.length) effects.shift()(); return tree; };
  return { props, render, view: () => render().props.children[0].props.value, editors: () => render().props.children.filter(node => node?.type === "editor") };
}
test("saved JSON clip drafts reach final composition independently of background capability", () => {
  for (const capability of [false, true]) {
    const h = fixture(capability);
    assert.match(h.view().error, /Loading your saved clip edits/);
    const [opening, demo] = h.editors(); assert.ok(demo, "Restored owned demo mounts its draft without a file upload");
    assert.equal(opening.props.fullDurationHookText, undefined, "Talking Head opening keeps independent timing despite using format=hook");
    assert.equal(demo.props.fullDurationHookText, undefined, "Talking Head demo never opts into Hook-only timing");
    assert.equal(opening.props.showSoundControls, false, "Talking-head speech is already in the footage; audio setup stays in Demo");
    assert.equal(demo.props.showSoundControls, false, "The focused demo editor must not duplicate Demo audio setup");
    for (const [editor, source] of [[opening, h.props.source], [demo, h.props.demoSource]]) {
      editor.props.onClipStateChange({ sourceId: source.id, editing: { version: 1, format: "hook", trimStartMs: 1000, trimEndMs: 9000, originalVolume: .8, musicVolume: .2, text: null },
        needsSaving: true, needsDraftSaving: false, savedDraft: { revision: 1 }, output: asset(9), busy: false, error: null });
    }
    const view = h.view(); assert.equal(view.error, null);
    assert.equal(view.source.id, h.props.source.id); assert.equal(view.demoSource.id, h.props.demoSource.id);
    assert.equal(view.openingState.savedDraft.revision, 1); assert.equal(view.demoState.savedDraft.revision, 1);
    view.openDemo(); assert.equal(h.view().editing, true);
  }
});

test("separate tasks editing the same media have independent opening/demo draft scopes",()=>{
  const first=fixture(),second=fixture();first.props.draftId="00000000-0000-4000-8000-000000000090";second.props.draftId="00000000-0000-4000-8000-000000000091";
  const a=first.editors(),b=second.editors();
  assert.equal(a[0].props.video.mediaAssetId,b[0].props.video.mediaAssetId);
  assert.notEqual(a[0].props.draftScope,b[0].props.draftScope);
  assert.notEqual(a[1].props.draftScope,b[1].props.draftScope);
  assert.notEqual(a[0].props.draftScope,a[1].props.draftScope);
});

test("Demo sidebar sound uses the mounted demo draft while its focused editor remains closed", () => {
  const h = fixture();
  const target = { id: "demo-sound-sidebar" };
  h.view().demoOriginalSound.props.ref(target);
  const [opening, demo] = h.editors();
  assert.equal(demo.props.originalSoundTarget, target);
  assert.equal(demo.props.active, false);
  assert.equal(opening.props.originalSoundTarget, undefined, "Demo volume never changes the opening's draft");
  demo.props.onClipStateChange({ sourceId: h.props.demoSource.id, editing: { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 10000, originalVolume: .35, musicVolume: .2, text: null }, needsSaving: true, needsDraftSaving: true, busy: false, error: null });
  assert.equal(h.view().demoState.editing.originalVolume, .35);
  h.view().openDemo();
  assert.equal(h.editors()[1].props.originalSoundTarget, target, "Opening the editor retains the same sidebar/draft owner");
});

test("Videos navigation closes either Talking Head clip editor and preserves its draft state", () => {
  const h = fixture();
  for (const target of ["opening", "demo"]) {
    const view = h.view();
    (target === "opening" ? view.openOpening : view.openDemo)();
    const editors = h.editors();
    const editor = editors[target === "opening" ? 0 : 1];
    const state = { sourceId: target === "opening" ? h.props.source.id : h.props.demoSource.id, editing: { text: { value: "Keep my text" } }, needsDraftSaving: true, busy: false };
    editor.props.onClipStateChange(state);
    assert.equal(h.view().editing, true);
    h.view().closeEditor();
    assert.equal(h.view().editing, false);
    assert.equal(h.view()[target === "opening" ? "openingState" : "demoState"], state);
    assert.equal(h.editors()[target === "opening" ? 0 : 1].props.draftScope, editor.props.draftScope);
  }
});
test("unsaved changes and missing current clip states block final preparation", () => {
  const h = fixture(); const [opening, demo] = h.editors();
  demo.props.onClipStateChange({ sourceId: h.props.demoSource.id, needsSaving: false, needsDraftSaving: false, busy: false, error: null });
  opening.props.onClipStateChange({ sourceId: h.props.source.id, needsSaving: true, needsDraftSaving: true, busy: false, error: null });
  assert.match(h.view().error, /Save your talking-head clip edits/);
  opening.props.onClipStateChange({ sourceId: h.props.source.id, needsSaving: false, needsDraftSaving: true, savedDraft: { revision: 1 }, busy: false, error: null });
  assert.match(h.view().error, /Save your talking-head clip edits/, "Returning to default settings must save over a different existing draft first");
  h.props.source = asset(3); assert.match(h.view().error, /Loading your saved clip edits/);
});

test("a separate clip export cannot block a saved raw composition, while draft writes still block", () => {
  const h = fixture(); const [opening, demo] = h.editors();
  const state = sourceId => ({ sourceId, needsSaving: true, needsDraftSaving: false, savedDraft: { revision: 1 },
    busy: true, error: "The earlier publishing export failed.", draftBusy: false, draftError: null });
  opening.props.onClipStateChange(state(h.props.source.id)); demo.props.onClipStateChange(state(h.props.demoSource.id));
  assert.equal(h.view().error, null); assert.equal(h.view().busy, false);
  h.view().openOpening(); assert.equal(h.view().editing, true, "Saved clips remain editable during separate publishing preparation");
  opening.props.onClipStateChange({ ...state(h.props.source.id), draftBusy: true });
  assert.equal(h.view().busy, true); assert.match(h.view().error, /finish saving/);
  opening.props.onClipStateChange({ ...state(h.props.source.id), draftError: "The edited audio could not load." });
  assert.match(h.view().error, /edited audio could not load/);
  opening.props.onClipStateChange({ ...state(h.props.source.id), draftError: "Loading your saved clip edits…" });
  assert.match(h.view().error, /Loading your saved clip edits/);
  opening.props.onClipStateChange({ ...state(h.props.source.id), needsDraftSaving: true });
  assert.match(h.view().error, /Save your talking-head clip edits/);
});

test("opening or switching the clip editor resets the shared control and preview scroll", () => {
  const h = fixture(), resets = [];
  const target = name => ({ closest(selector) { return { scrollTo(value) { resets.push([name, selector, value.top]); } }; } });
  let view = h.view(); view.controls.props.ref(target("controls")); view.preview.props.ref(target("preview"));
  h.view().openOpening(); view = h.view();
  assert.deepEqual(resets.slice(-2), [["controls", "[data-workflow-section-content]", 0], ["preview", "#hook-workflow-preview", 0]]);
  view.openDemo(); assert.equal(h.view().editing, true);
  assert.deepEqual(resets.slice(-2), [["controls", "[data-workflow-section-content]", 0], ["preview", "#hook-workflow-preview", 0]]);
});


test("Talking Head supplies canonical reference lookup to each clip without borrowing the current selection", () => {
  const h = fixture();
  const canonical = { id: "hook-original", format: "hook", videoUrl: "https://owned.test/original.mp4", slides: [] };
  h.props.catalogue = [canonical];
  h.props.remixReferences = [{ id: "talking-current", format: "hook", slides: [] }];
  const [opening, demo] = h.editors();
  assert.deepEqual(Array.from(opening.props.remixReferences, reference => reference.id), ["hook-original", "talking-current"]);
  assert.deepEqual(Array.from(demo.props.remixReferences, reference => reference.id), ["hook-original", "talking-current"]);
  assert.equal(opening.props.remixReference, undefined);
  assert.equal(demo.props.remixReference, undefined);
  assert.equal(opening.props.fullDurationHookText, undefined);
  assert.equal(demo.props.fullDurationHookText, undefined);
});
