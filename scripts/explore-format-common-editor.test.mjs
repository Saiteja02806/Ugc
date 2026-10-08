import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { formatTextLayout, parseExploreFormatEdit } from "../worker/src/lib/explore-format-edit.ts";

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function load(path, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, localStorage: { getItem: () => null, setItem() {} }, require(name) {
    return imports[name] ?? (name === "react/jsx-runtime" ? jsx : new Proxy({}, { get: (_, key) => String(key) }));
  } });
  return exports;
}
const fields = load("components/explore/format-video-text-fields.tsx", {});
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const editing = { version: 1, format: "hook", trimStartMs: 2000, trimEndMs: 8000, originalVolume: 1, musicVolume: .2, text: null };

test("shared opening and demo text controls retain timing within the edited clip", () => {
  let next;
  const tree = fields.FormatVideoTextFields({ editing, onChange: value => { next = value; } });
  nodes(tree).find(n => n.props?.["aria-label"] === "Overlay text").props.onChange({ target: { value: "My own heading" } });
  assert.equal(next.text.endMs, 6000);
  assert.equal(parseExploreFormatEdit(next).text.value, "My own heading");
  next.text.startMs = 4000;
  const trimmed = fields.trimFormatVideoEdit(next, 3000, 5000);
  assert.equal(trimmed.text.startMs, 1999); assert.equal(trimmed.text.endMs, 2000);
  assert.doesNotThrow(() => parseExploreFormatEdit(trimmed));
  const clear = fields.FormatVideoTextFields({ editing: trimmed, onChange: value => { next = value; } });
  nodes(clear).find(n => n.props?.["aria-label"] === "Overlay text").props.onChange({ target: { value: "" } });
  assert.equal(next.text, null);
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: clip preview reveals tools only through its Edit action and retains its draft`, () => {
    let cursor = 0; const slots = []; let requests = 0, opened = 0;
    const react = {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect() {},
    };
    const mod = load("components/explore/format-video-editor.tsx", {
      react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
      "@tanstack/react-query": { useQuery: () => ({}) },
      "@/contexts/auth-context": { useAuth: () => ({ user: null }) },
      "@/components/explore/format-video-text-fields": fields,
      "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
      "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ action: { disabled: true, onAction() { requests++; } } }) },
      "@/worker/src/lib/explore-format-edit": { formatTextLayout, parseExploreFormatEdit },
    });
    const controlsTarget = {}, resultsTarget = {}, actionsTarget = {};
    const render = editingActive => { cursor = 0; return mod.FormatVideoEditor({ format, video: { id: "local:clip", url: "blob:video", title: "My clip", durationSeconds: 8, ratio: "9:16", mediaAssetId: null }, active: true, editingActive, controlsTarget, resultsTarget, actionsTarget, enabled: false, onEdit() { opened++; }, onDirty() {}, onSaved() {}, onContinue() {} }); };
    let tree = render(false);
    assert.equal(nodes(tree).some(n => n.type === "portal" && n.props.target === controlsTarget), false);
    nodes(tree).find(n => n.props?.["data-edit-clip"] === "opening").props.onClick();
    assert.equal(opened, 1); assert.equal(requests, 0);
    tree = render(true);
    nodes(tree).find(n => n.props?.["aria-label"] === "Trim start").props.onChange({ target: { value: "2" } });
    assert.equal(nodes(render(false)).some(n => n.type === "portal" && n.props.target === controlsTarget), false);
    assert.equal(nodes(render(true)).find(n => n.props?.["aria-label"] === "Trim start").props.value, 2);
    assert.equal(requests, 0);
  });
  test(`${format}: trimmed opening preview starts added sound at clip zero and repeats relative to the trim`, () => {
    let cursor = 0; const slots = [];
    const react = {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect() {},
    };
    const mod = load("components/explore/format-video-editor.tsx", {
      react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
      "@tanstack/react-query": { useQuery: () => ({}) },
      "@/contexts/auth-context": { useAuth: () => ({ user: null }) },
      "@/components/explore/format-video-text-fields": fields,
      "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({ asset: { url: "blob:music" } }) },
      "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ action: { disabled: true } }) },
      "@/worker/src/lib/explore-format-edit": { formatTextLayout, parseExploreFormatEdit },
    });
    const render = () => { cursor = 0; return mod.FormatVideoEditor({ format, video: { id: "local:clip", url: "blob:video", title: "My clip", durationSeconds: 8, ratio: "9:16", mediaAssetId: null }, active: true, controlsTarget: {}, resultsTarget: {}, enabled: false, onDirty() {}, onSaved() {}, onContinue() {} }); };
    let tree = render();
    const player = { currentTime: 0, paused: false, pause() { this.paused = true; } };
    const sound = { currentTime: 0, duration: 3, pause() {}, play: async () => {} };
    nodes(tree).find(n => n.type === "video").props.ref.current = player;
    nodes(tree).find(n => n.type === "audio").props.ref.current = sound;
    nodes(tree).find(n => n.props?.["aria-label"] === "Trim start").props.onChange({ target: { value: "2" } });
    assert.equal(player.currentTime, 2); tree = render();
    player.currentTime = 2.5; nodes(tree).find(n => n.type === "video").props.onSeeked();
    assert.equal(sound.currentTime, .5);
    nodes(tree).find(n => n.props?.["aria-label"] === "Music playback").props.onChange({ target: { value: "repeat" } });
    tree = render(); player.currentTime = 6.5; nodes(tree).find(n => n.type === "video").props.onSeeked();
    assert.equal(sound.currentTime, 1.5);
  });
}
