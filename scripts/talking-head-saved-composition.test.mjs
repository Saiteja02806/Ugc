import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
const asset = number => ({ id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`, title: "Owned clip", url: `https://owned.test/${number}.mp4`, durationSeconds: 10 });
function fixture(backgroundScheduling = false) {
  const slots = []; let cursor = 0;
  const react = { useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useCallback(value) { cursor++; return value; }, useEffect() { cursor++; } };
  const imports = { react, "react/jsx-runtime": jsx, "@/components/explore/format-video-editor": { FormatVideoEditor: "editor" },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia() { throw new Error("Recovery must not upload"); } },
    "@/lib/explore/format-video-source": { formatVideoFromAsset: source => ({ ...source, mediaAssetId: source.id }) },
    "@/components/explore/workflow-section-layout.module.css": { default: {} } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/explore/talking-head-clip-editing.tsx", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: key => { assert.ok(key in imports, key); return imports[key]; } });
  const props = { enabled: true, ownerId: "owner", source: asset(1), sourcePreview: null, demo: { asset: null }, demoSource: asset(2), active: true, backgroundScheduling, onDirty() {}, children: value => value };
  const render = () => { cursor = 0; return exports.TalkingHeadClipEditing(props); };
  return { props, render, view: () => render().props.children[0].props.value, editors: () => render().props.children.filter(node => node?.type === "editor") };
}
test("saved JSON clip drafts reach final composition independently of background capability", () => {
  for (const capability of [false, true]) {
    const h = fixture(capability);
    assert.match(h.view().error, /Loading your saved clip edits/);
    const [opening, demo] = h.editors(); assert.ok(demo, "Restored owned demo mounts its draft without a file upload");
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
test("unsaved changes and missing current clip states block final preparation", () => {
  const h = fixture(); const [opening, demo] = h.editors();
  demo.props.onClipStateChange({ sourceId: h.props.demoSource.id, needsSaving: false, needsDraftSaving: false, busy: false, error: null });
  opening.props.onClipStateChange({ sourceId: h.props.source.id, needsSaving: true, needsDraftSaving: true, busy: false, error: null });
  assert.match(h.view().error, /Save your talking-head clip edits/);
  opening.props.onClipStateChange({ sourceId: h.props.source.id, needsSaving: false, needsDraftSaving: true, savedDraft: { revision: 1 }, busy: false, error: null });
  assert.match(h.view().error, /Save your talking-head clip edits/, "Returning to default settings must save over a different existing draft first");
  h.props.source = asset(3); assert.match(h.view().error, /Loading your saved clip edits/);
});
