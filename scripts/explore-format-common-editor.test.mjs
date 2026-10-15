import { readRemixTextDraft } from "../lib/explore/remix-text-draft.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { formatTextLayout, formatTextOverlays, parseExploreFormatEdit } from "../worker/src/lib/explore-format-edit.ts";
import * as editDraft from "../lib/explore/format-edit-draft.ts";
import * as unchangedHook from "../lib/explore/unchanged-hook-source.ts";
import * as referenceAudio from "../lib/explore/reference-audio-preview.ts";
import * as remixSource from "../lib/explore/remix-source.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
import * as referenceText from "../lib/explore/reference-text.ts";
import * as sequencePreview from "../lib/explore/sequence-preview.ts";
import { isExploreUuid } from "../worker/src/lib/explore-finishing-contract.ts";

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, ...globals, require(name) {
    if (name === "@/lib/explore/format-edit-draft") return editDraft;
    if (name === "@/components/explore/use-clip-draft-save") return imports[name] ?? { useClipDraftSave: () => ({ saved: null, loaded: true, busy: false, dirty: true, error: null, save() {}, reload() {} }) };
    if (name === "@/lib/explore/unchanged-hook-source") return unchangedHook;
    if (name === "@/lib/explore/reference-audio-preview") return referenceAudio;
    if (name === "@/lib/explore/sequence-preview") return sequencePreview;
    if (name === "@/lib/explore/remix-source") return remixSource;
    if (name === "@/lib/explore/remix-text-edit") return { applyVideoTextRemix };
    if (name === "@/worker/src/lib/explore-format-edit") return { formatTextLayout, formatTextOverlays, parseExploreFormatEdit };
    if (name === "@/worker/src/lib/explore-finishing-contract") return { isExploreUuid };
    return imports[name] ?? (name === "react/jsx-runtime" ? jsx : new Proxy({}, { get: (_, key) => String(key) }));
  } });
  return exports;
}

test("Schedule's opening snapshot waits for owned source and audio settings and preserves the raw music clock", () => {
  let cursor = 0, audioLoaded = false, sourceLoaded = true, audioFailed = false, snapshot;
  const slots = [], effects = [];
  const source = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4",
    url: "/raw-hook.mp4", durationSeconds: 8, width: 720, height: 1280, metadata: {} };
  const stored = { editing: { version: 1, format: "hook", trimStartMs: 2000, trimEndMs: 6000, originalVolume: .7, musicVolume: .4, text: null },
    backgroundId: "00000000-0000-4000-8000-000000000002", playback: "repeat" };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn,
    useEffect(fn) { effects.push(fn); },
  };
  const mod = load("components/explore/format-video-editor.tsx", { react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery: options => options.queryKey[0] === "explore-edit-source" ? { data: sourceLoaded ? source : null } : { data: audioLoaded ? { url: "/owned-music.mp3" } : null, isError: audioFailed } },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ action: { disabled: true, busy: false, message: "" } }) },
  }, { window: {}, localStorage: { getItem: () => JSON.stringify(stored), setItem() {} } });
  function render() { cursor = 0; mod.FormatVideoEditor({ format: "hook", video: { ...source, mediaAssetId: source.id, title: "Owned hook", ratio: "9:16" },
    active: false, controlsTarget: null, resultsTarget: null, enabled: true, onDirty() {}, onSaved() {}, onContinue() {}, onPreviewChange: value => { snapshot = value; } });
    while (effects.length) effects.shift()(); }
  render(); assert.match(snapshot.disabledReason, /Loading hook audio/);
  audioFailed = true; render(); assert.match(snapshot.disabledReason, /could not load/);
  audioLoaded = true; audioFailed = false; render(); assert.equal(snapshot.disabledReason, null);
  assert.equal(snapshot.segment.addedAudio.url, "/owned-music.mp3");
  assert.equal(snapshot.segment.addedAudio.timelineOffsetMs, 2000); assert.equal(snapshot.segment.addedAudio.mixDurationMs, 8000);
  assert.equal(snapshot.segment.editing.trimEndMs, 6000);
  sourceLoaded = false; render(); assert.match(snapshot.disabledReason, /Loading your hook settings/);
});

test("paired editor restores the saved volume before automatic save, locks its exact MP3 and saves volume-only edits", () => {
  let cursor = 0; const slots = []; let input;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect() {},
  };
  const asset = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4", url: "https://media.example/mixed.mp4", durationSeconds: 8,
    metadata: { referenceAudioPreview: { referenceId: "paired", title: "My exact MP3", audioUrl: "https://media.example/exact.mp3", cleanVideoUrl: "https://media.example/clean.mp4", volume: .35 } } };
  const mod = load("components/explore/format-video-editor.tsx", {
    react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery: options => ({ data: options.queryKey[0] === "explore-edit-source" ? asset : undefined }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: value => { input = value; return { action: { disabled: false } }; } },
  });
  const render = () => { cursor = 0; return mod.FormatVideoEditor({ format: "hook", video: { id: asset.id, mediaAssetId: asset.id, url: asset.url, title: "Paired", durationSeconds: 8, ratio: "9:16" }, active: true, controlsTarget: {}, resultsTarget: {}, enabled: true, onDirty() {}, onSaved() {}, onContinue() {} }); };
  let tree = render();
  assert.equal(input.editing.musicVolume, .35); assert.equal(input.reuseUnchangedSource, true);
  assert.equal(nodes(tree).find(node => node.type === "video").props.src, asset.metadata.referenceAudioPreview.cleanVideoUrl);
  assert.equal(nodes(tree).find(node => node.type === "audio").props.src, asset.metadata.referenceAudioPreview.audioUrl);
  assert.equal(nodes(tree).some(node => node.type === "WorkflowSavedAudioPicker"), false);
  nodes(tree).find(node => node.props?.["aria-label"] === "Reference music volume").props.onChange({ target: { value: "60" } });
  tree = render(); assert.equal(input.editing.musicVolume, .6); assert.equal(input.reuseUnchangedSource, false);
  assert.equal(nodes(tree).find(node => node.type === "audio").props.loop, true);
});
const fields = load("components/explore/format-video-text-fields.tsx", {});
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const editing = { version: 1, format: "hook", trimStartMs: 2000, trimEndMs: 8000, originalVolume: 1, musicVolume: .2, text: null };

test("clip draft readiness is independent of an earlier publishing render receipt", () => {
  let cursor = 0, state; const slots = [], effects = [];
  const source = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4", url: "/raw.mp4", durationSeconds: 5, metadata: {} };
  const draft = { loaded: true, dirty: false, saved: { revision: 1 }, busy: false, error: null };
  const action = { disabled: true, busy: false, cancel() {}, error: null };
  const audio = { loading: false, error: null };
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
    return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  const mod = load("components/explore/format-video-editor.tsx", { react, "react-dom": { createPortal: children => children },
    "@tanstack/react-query": { useQuery: options => ({ data: options.queryKey[0] === "explore-edit-source" ? source : undefined }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => audio },
    "@/components/explore/use-clip-draft-save": { useClipDraftSave: () => draft },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ output: null, action }) },
  });
  const render = () => { cursor = 0; mod.FormatVideoEditor({ format: "hook", video: { ...source, mediaAssetId: source.id, title: "Owned", ratio: "9:16" },
    active: false, controlsTarget: null, resultsTarget: null, enabled: true, onDirty() {}, onSaved() {}, onContinue() {}, onClipStateChange: next => { state = next; } });
    while (effects.length) effects.shift()(); };
  render(); assert.equal(state.busy, true); assert.equal(state.draftBusy, false); assert.equal(state.draftError, null);
  action.error = "Publishing render failed."; render(); assert.equal(state.error, action.error); assert.equal(state.draftError, null);
  draft.busy = true; render(); assert.equal(state.draftBusy, true);
  draft.busy = false; draft.error = "Could not save draft."; render(); assert.equal(state.draftError, draft.error);
  draft.error = null; draft.loaded = false; render(); assert.match(state.draftError, /Loading your saved clip edits/);
  draft.loaded = true;
  draft.error = null; audio.error = "Could not load audio."; render(); assert.equal(state.draftError, audio.error);
});

test("pending and failed soundtrack replacements block draft saves, rendering and schedule clip state", () => {
  let cursor = 0, input, clipState, renderCalls = 0;
  const slots = [], effects = [];
  const audio = { asset: { name: "previous", url: "blob:previous" }, loading: true, error: null };
  const source = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4", url: "/raw.mp4", durationSeconds: 5, metadata: {} };
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  const mod = load("components/explore/format-video-editor.tsx", { react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery: options => ({ data: options.queryKey[0] === "explore-edit-source" ? source : undefined }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => audio },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: value => { input = value; return { output: null, action: { disabled: false, busy: false, onAction() { renderCalls++; } } }; } },
  });
  const render = () => { cursor = 0; const tree = mod.FormatVideoEditor({ format: "hook", video: { id: source.id, mediaAssetId: source.id, url: source.url, title: "Owned", durationSeconds: 5, ratio: "9:16" },
    active: true, controlsTarget: {}, resultsTarget: {}, enabled: true, prepareRequest: 1, onDirty() {}, onSaved() {}, onContinue() {}, onClipStateChange: value => { clipState = value; } });
    while (effects.length) effects.shift()(); return tree; };
  let tree = render();
  assert.match(input.demoFramingError, /selected audio to finish loading/);
  assert.equal(clipState.busy, true);
  assert.equal(nodes(tree).find(n => n.type === "Button" && n.props.children === "Save edits").props.disabled, true);
  assert.equal(nodes(tree).find(n => n.type === "Button" && n.props.children === "Prepare final video").props.disabled, true);
  assert.equal(renderCalls, 0, "The saved preparation request waits instead of preparing with old audio");
  audio.loading = false; audio.error = "The selected soundtrack could not load.";
  tree = render();
  assert.equal(input.demoFramingError, audio.error); assert.equal(clipState.error, audio.error);
  assert.equal(nodes(tree).find(n => n.type === "Button" && n.props.children === "Save edits").props.disabled, true);
  assert.equal(renderCalls, 0);
  audio.error = null; render();
  assert.equal(renderCalls, 1, "An explicitly saved prepare request can continue after selection is resolved");
});

for (const format of ["hook", "wall_text"]) test(`${format}: Save edits saves the exact draft without submitting a render`, () => {
  let cursor = 0, saveCalls = 0, renderCalls = 0, draftInput;
  const slots = [], source = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4", url: "/raw.mp4", durationSeconds: 5, metadata: {} };
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn, useEffect() {} };
  const mod = load("components/explore/format-video-editor.tsx", { react, "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery: options => ({ data: options.queryKey[0] === "explore-edit-source" ? source : undefined }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
    "@/components/explore/use-clip-draft-save": { useClipDraftSave: input => { draftInput = input; return { loaded: true, dirty: true, saved: null, save() { saveCalls++; } }; } },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ output: null, action: { disabled: false, busy: false, onAction() { renderCalls++; } } }) },
  });
  const tree = mod.FormatVideoEditor({ format, video: { id: source.id, mediaAssetId: source.id, url: source.url, title: "Owned clip", durationSeconds: 5, ratio: "9:16" },
    active: true, controlsTarget: {}, resultsTarget: {}, enabled: true, onDirty() {}, onSaved() { throw new Error("A draft is not a ready video"); }, onContinue() {} });
  const save = nodes(tree).find(node => node.type === "Button" && node.props.children === "Save edits");
  assert.equal(save.props.disabled, false, "Incomplete text is a valid draft, not a render request");
  save.props.onClick(); assert.equal(saveCalls, 1); assert.equal(renderCalls, 0);
  assert.equal(draftInput.content.editing.format, format); assert.equal(draftInput.content.sourceAssetId, source.id);
  assert.equal(draftInput.owner, "owner"); assert.equal(draftInput.content.backgroundAssetId, null);
  const prepare = nodes(tree).find(node => node.type === "Button" && node.props.children === "Prepare final video");
  assert.ok(prepare, "Publishing/export remains a separate explicit operation"); prepare.props.onClick(); assert.equal(renderCalls, 1);
  cursor = 0; let backCalls = 0;
  const back = () => { backCalls++; };
  const focused = mod.FormatVideoEditor({ format, video: { id: source.id, mediaAssetId: source.id, url: source.url, title: "Owned clip", durationSeconds: 5, ratio: "9:16" },
    active: true, controlsTarget: {}, resultsTarget: {}, enabled: true, prepareInSequence: true, continueLabel: "Back to videos", onBackToPreview: back,
    onDirty() {}, onSaved() {}, onContinue() { throw new Error("The clip editor cannot advance a workflow stage"); } });
  const focusedButtons = nodes(focused).filter(node => node.type === "Button");
  assert.equal(focusedButtons.some(node => ["Prepare final video", "Refresh preparation status", "Continue to Demo"].includes(node.props.children)), false);
  assert.equal(focusedButtons.find(node => node.props.onClick === back).props.children.at(-1), format === "wall_text" ? "Back to Create" : "Back to videos");
  focusedButtons.find(node => node.props.onClick === back).props.onClick();
  assert.equal(backCalls, 1); assert.equal(renderCalls, 1, "Returning to videos does not render or advance a stage");
});

test("overview shows editable reference text immediately and keeps manual entry outside the remix box", () => {
  let cursor = 0, generationRequests = 0; const slots = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useId() { return `remix-${cursor++}`; }, useEffect() {},
  };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText,
    "@/lib/firebase/auth": { getCurrentUserIdToken() { generationRequests++; throw new Error("Opening remix details cannot generate text"); } } });
  const seed = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "An example hook", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
  const manual = { type: "manual-entry", props: { children: "Add text manually" } };
  const props = { owner: null, targetKey: "video:hook", format: "hook", overview: true, reference: { id: "hook-a", format: "hook" }, previewSource: seed, localPreview: true, children: manual, onUse() {} };
  const render = () => { cursor = 0; const control = mod.RemixTextSection(props); return control.type(control.props); };
  let tree = render();
  const generate = nodes(tree).find(node => node.type === "Button" && node.props.children === "Generate remix");
  assert.ok(generate);
  assert.equal(generate.props.disabled, true, "The local fixture cannot make an AI request");
  assert.equal(nodes(tree).filter(node => node.type === "Button" && node.props.children === "Generate remix").length, 1, "One visible Generate remix action");
  assert.equal(nodes(tree).find(node => node.props?.["data-remix-control"]).props.children[1].props.hidden, undefined);
  assert.equal(nodes(tree).find(node => node.props?.role === "status").props.children, "Preview");
  assert.ok(nodes(tree).indexOf(manual) < nodes(tree).findIndex(node => node.props?.["data-remix-control"]), "Manual editing sits above the remix box");
  assert.equal(nodes(tree).some(node => node.props?.["aria-label"] === "Remix options" || node.props?.["aria-label"] === "Remix instructions"), false, "Remix has one text input and no additional guidance controls");
  const field = nodes(tree).find(node => node.props?.["aria-label"] === "Reference text");
  assert.equal(field.props.value, "An example hook");
  field.props.onChange({ target: { value: "" } }); tree = render();
  assert.equal(nodes(tree).find(node => node.props?.["aria-label"] === "Reference text").props.value, "", "The reference can be cleared before entering an idea");
  field.props.onChange({ target: { value: "Introduce our planning app" } }); tree = render();
  assert.equal(nodes(tree).find(node => node.props?.["aria-label"] === "Reference text").props.value, "Introduce our planning app");
  generate.props.onClick(); tree = render();
  assert.equal(nodes(tree).some(node => node.type === "Button" && node.props.children === "Close"), false);
  assert.equal(generationRequests, 0);
});

test("overview Generate remix submits the edited hook seed only on click, then applies the reviewed result to its clip", async () => {
  let cursor = 0, applied; const slots = [], effects = [], calls = [];
  const source = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "An example hook", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useId() { return `remix-${cursor++}`; }, useEffect(fn) { effects.push(fn); },
  };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" } }, {
    AbortController, AbortSignal, URLSearchParams, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => options.method === "POST"
        ? { ok: true, source: { ...source, blocks: [{ ...source.blocks[0], text: "Introduce our planning app" }] }, output: { blocks: ["Plan your day in one place"], heading: "", body: "" } }
        : { ok: true, source, enabled: true, businessContext: { ready: true, name: "Planning app" } } };
    },
  });
  const props = { owner: "owner-a", targetKey: "video:hook", format: "hook", overview: true, reference: { id: "hook-a", format: "hook" }, onUse(output, original) { applied = { output, original }; } };
  const render = () => { cursor = 0; const control = mod.RemixTextSection(props); return control.type(control.props); };
  let tree = render();
  assert.equal(nodes(tree).find(n => n.props?.role === "status").props.children, "Loading…");
  assert.equal(nodes(tree).find(n => n.type === "Button" && n.props.children === "Generate remix").props.disabled, true);
  effects.splice(0).forEach(fn => fn()); await new Promise(setImmediate); tree = render();
  assert.equal(nodes(tree).find(n => n.props?.role === "status").props.children, "Ready");
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, undefined, "Mounting only loads reference and business details");
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.value, "An example hook");
  assert.equal(nodes(tree).some(n => n.type === "a" && n.props.children === "Review"), false, "Ready business context stays connected without the overview row");
  const combined = "Introduce our planning app. Use a friendly tone and avoid emojis";
  nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.onChange({ target: { value: combined } }); tree = render();
  const generate = nodes(tree).find(n => n.type === "Button" && n.props.children === "Generate remix");
  assert.equal(Boolean(generate.props.disabled), false); generate.props.onClick(); await new Promise(setImmediate); tree = render();
  assert.equal(calls.length, 2); assert.equal(calls[1].url, "/api/explore/remix-text");
  const payload = JSON.parse(calls[1].options.body);
  assert.deepEqual(payload.referenceBlocks, [combined]); assert.equal(payload.referenceId, "hook-a");
  assert.equal(payload.instructions, combined, "Edits in the single text box carry user copy and guidance to generation");
  assert.equal(calls[1].options.headers["Idempotency-Key"], payload.requestKey);
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Remixed text").props.value, "Plan your day in one place");
  nodes(tree).find(n => n.type === "Button" && n.props.children === "Apply to hook").props.onClick(); tree = render();
  assert.equal(applied.output.blocks[0], "Plan your day in one place"); assert.equal(applied.original.referenceId, "hook-a");
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.value, combined);
});

for (const scenario of [
  { enabled: false, ready: true, text: "An example hook", status: "Unavailable" },
  { enabled: true, ready: false, text: "An example hook", status: "Add business context" },
  { enabled: true, ready: true, text: "", status: "Add text" },
]) test(`overview keeps Generate remix visible while ${scenario.status.toLowerCase()}`, async () => {
  let cursor = 0, posts = 0; const slots = [], effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useId() { return `remix-${cursor++}`; }, useEffect(fn) { effects.push(fn); },
  };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" } }, {
    AbortController, URLSearchParams,
    fetch: async (_url, options) => {
      if (options.method === "POST") posts++;
      return { ok: true, json: async () => ({ ok: true, source: null, enabled: scenario.enabled, businessContext: { ready: scenario.ready, name: "Acme" } }) };
    },
  });
  const props = { owner: "owner-a", targetKey: "video:hook", format: "hook", overview: true, onUse() {} };
  const render = () => { cursor = 0; const control = mod.RemixTextSection(props); return control.type(control.props); };
  let tree = render(); effects.splice(0).forEach(fn => fn()); await new Promise(setImmediate); tree = render();
  const field = nodes(tree).find(n => n.props?.["aria-label"] === "Reference text");
  field.props.onChange({ target: { value: scenario.text } }); tree = render();
  assert.equal(nodes(tree).find(n => n.props?.role === "status").props.children, scenario.status);
  const generate = nodes(tree).find(n => n.type === "Button" && n.props.children === "Generate remix");
  assert.ok(generate); assert.equal(generate.props.disabled, true);
  generate.props.onClick(); await new Promise(setImmediate); assert.equal(posts, 0);
  assert.equal(Boolean(nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.disabled), false, "Starting text remains editable");
});

test("shared opening and demo text controls retain timing within the edited clip", () => {
  let next;
  const tree = fields.FormatVideoTextFields({ editing, onChange: value => { next = value; } });
  tree.props.onChange([{ value: "My own heading", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 6000 }]);
  assert.equal(next.textOverlays[0].endMs, 6000);
  assert.equal(parseExploreFormatEdit(next).textOverlays[0].value, "My own heading");
  next.textOverlays[0].startMs = 4000;
  const trimmed = fields.trimFormatVideoEdit(next, 3000, 5000);
  assert.equal(trimmed.textOverlays[0].startMs, 1999); assert.equal(trimmed.textOverlays[0].endMs, 2000);
  assert.doesNotThrow(() => parseExploreFormatEdit(trimmed));
  const clear = fields.FormatVideoTextFields({ editing: trimmed, onChange: value => { next = value; } });
  clear.props.onChange([]);
  assert.equal(next.text, null);
  assert.deepEqual(next.textOverlays, []);
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
    const render = (editingActive, extra = {}) => { cursor = 0; return mod.FormatVideoEditor({ format, video: { id: "local:clip", url: "blob:video", title: "My clip", durationSeconds: 8, ratio: "9:16", mediaAssetId: null }, active: true, editingActive, controlsTarget, resultsTarget, actionsTarget, enabled: false, onEdit() { opened++; }, onDirty() {}, onSaved() {}, onContinue() {}, ...extra }); };
    let tree = render(false);
    assert.equal(nodes(tree).some(n => n.type === "portal" && n.props.target === controlsTarget), false);
    nodes(tree).find(n => n.props?.["data-edit-clip"] === "opening").props.onClick();
    assert.equal(opened, 1); assert.equal(requests, 0);
    tree = render(true);
    nodes(tree).find(n => n.props?.["aria-label"] === "Trim start").props.onChange({ target: { value: "2" } });
    assert.equal(nodes(render(false)).some(n => n.type === "portal" && n.props.target === controlsTarget), false);
    assert.equal(nodes(render(true)).find(n => n.props?.["aria-label"] === "Trim start").props.value, 2);
    assert.equal(requests, 0);
    assert.equal(nodes(render(false)).some(n => n.type === "RemixTextSection"), false, "Overview cards have no duplicate Remix form");
    const editing = nodes(render(true));
    const remixes = editing.filter(n => n.type === "RemixTextSection");
    assert.equal(remixes.length, 1, "Remix appears once, inside the focused editor");
    assert.equal(remixes[0].props.expanded, false, "Manual clips keep Remix compact until opened");
    const seed = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format, status: "ready", blocks: [{ text: "An example hook", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
    assert.equal(remixes[0].props.onUse({ blocks: ["Our product hook"], heading: "", body: "" }, seed), true);
    render(false);
    const reopened = nodes(render(true));
    assert.equal(reopened.find(n => n.type === "FormatVideoTextOverlay").props.text.value, "Our product hook");
    assert.equal(reopened.find(n => n.props?.["aria-label"] === "Trim start").props.value, 2);
    assert.equal(render(false, { active: false }), null, "Inactive editors must not portal Remix into other steps");
    assert.equal(requests, 0);
  });
  test(`${format}: trimmed custom opening preview keeps the raw music clock and repeats from its original start`, () => {
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
    assert.equal(sound.currentTime, 2.5);
    nodes(tree).find(n => n.props?.["aria-label"] === "Music playback").props.onChange({ target: { value: "repeat" } });
    tree = render(); player.currentTime = 6.5; nodes(tree).find(n => n.type === "video").props.onSeeked();
    assert.equal(sound.currentTime, .5);
  });
}

test("paired clip preview updates edge fades every playback frame and stops audio on pause and unmount", () => {
  let cursor = 0, nextFrame = 0;
  const slots = [], effects = [], cleanups = [], frames = new Map();
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn,
    useEffect(fn) { effects.push(fn); },
  };
  const asset = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", mimeType: "video/mp4", url: "/mixed.mp4", durationSeconds: 2,
    metadata: { referenceAudioPreview: { referenceId: "paired", title: "Reference", audioUrl: "/reference.mp3", cleanVideoUrl: "/clean.mp4", volume: .8 } } };
  const stored = { editing: { version: 1, format: "hook", trimStartMs: 500, trimEndMs: 1500, originalVolume: 1, musicVolume: .8, text: null }, backgroundId: null, playback: "once" };
  const mod = load("components/explore/format-video-editor.tsx", {
    react, "react-dom": { createPortal: children => children },
    "@tanstack/react-query": { useQuery: options => ({ data: options.queryKey[0] === "explore-edit-source" ? asset : null }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ action: { disabled: false } }) },
  }, { window: {}, localStorage: { getItem: () => JSON.stringify(stored), setItem() {} },
    requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  const tree = mod.FormatVideoEditor({ format: "hook", video: { ...asset, mediaAssetId: asset.id, title: "Paired", ratio: "9:16" },
    active: true, controlsTarget: {}, resultsTarget: {}, enabled: true, onDirty() {}, onSaved() {}, onContinue() {} });
  const video = nodes(tree).find(node => node.type === "video"), audio = nodes(tree).find(node => node.type === "audio");
  const player = { currentTime: .5, paused: true, pause() { this.paused = true; } };
  const sound = { currentTime: 0, duration: 2, paused: true, volume: 0, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  video.props.ref.current = player; audio.props.ref.current = sound;
  for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  player.paused = false; video.props.onPlay({ currentTarget: player });
  assert.equal(sound.volume, 0); assert.equal(frames.size, 1);
  player.currentTime = .55;
  const [id, tick] = frames.entries().next().value; frames.delete(id); tick();
  assert.ok(Math.abs(sound.volume - .2) < .001, "50ms into the reference uses a quarter of its .8 gain");
  assert.equal(frames.size, 1);
  player.paused = true; video.props.onPause(); assert.equal(frames.size, 0); assert.equal(sound.paused, true);
  player.paused = false; video.props.onPlay({ currentTarget: player }); assert.equal(frames.size, 1);
  video.props.ref.current = null; audio.props.ref.current = null;
  for (const cleanup of cleanups) cleanup();
  assert.equal(frames.size, 0); assert.equal(sound.paused, true);
});


test("expanded Remix uses one entry and keeps the manual editor distinct", () => {
  const react = { useState: value => [typeof value === "function" ? value() : value, () => {}], useRef: value => ({ current: value }), useId: (() => { let id = 0; return () => `editor-${id++}`; })(), useEffect() {} };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText });
  const manual = { type: "manual-fields", props: {} };
  const wrapper = mod.RemixTextSection({ owner: null, targetKey: "demo:independent", format: "hook", expanded: true, editorNavigation: true, localPreview: true, children: manual, onUse() { throw Error("Navigation cannot apply a remix"); } });
  const tree = wrapper.type(wrapper.props);
  const all = nodes(tree);
  assert.equal(all.filter(n => n.props?.["data-remix-control"]).length, 1);
  assert.equal(all.filter(n => n.type === "Button" && n.props.children === "Remix text").length, 0, "The editor does not repeat Remix as a navigation shortcut");
  assert.equal(all.filter(n => n.type === "Button" && n.props.children === "Back to text").length, 0);
  assert.ok(all.includes(manual), "Manual edits remain mounted alongside the single Remix control");
});

test("opening optional editor Remix keeps manual text and styling accessible", () => {
  let cursor = 0; const slots = [];
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; }, useRef: value => ({ current: value }), useId: () => `manual-${cursor++}`, useEffect() {} };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText });
  const manual = { type: "manual-fields", props: {} };
  const render = () => { cursor = 0; const wrapper = mod.RemixTextSection({ owner: null, targetKey: "scratch", format: "hook", editorNavigation: true, localPreview: true, children: manual, onUse() { throw Error("Opening Remix must not apply text"); } }); return wrapper.type(wrapper.props); };
  const control = nodes(render()).find(node => node.props?.["data-remix-control"]);
  control.props.onToggle({ currentTarget: { open: true } });
  const tree = render();
  assert.equal(nodes(tree).find(node => node.props?.["data-remix-control"]).props.open, true);
  assert.equal(nodes(tree).find(node => node.props?.children === manual).props.hidden, false, "Opening Remix must not hide the user's existing text tools");
});

test("slideshow Remix identifies its source as a slide reference", () => {
  const react = { useState: value => [typeof value === "function" ? value() : value, () => {}], useRef: value => ({ current: value }), useId: () => "slide-source", useEffect() {} };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText });
  const wrapper = mod.RemixTextSection({ owner: null, targetKey: "slide:one", format: "slideshow", reference: { id: "slide-reference", format: "slideshow", slides: [{ id: "one" }] }, defaultSlideId: "one", expanded: true, editorNavigation: true, referenceFirst: true, localPreview: true, onUse() {} });
  const all = nodes(wrapper.type(wrapper.props));
  assert.ok(all.some(node => node.type === "span" && node.props.children === "Slide reference"));
  assert.equal(all.some(node => node.type === "span" && node.props.children === "Video reference"), false);
});

test("Remix business context never reports missing or loading context as saved", async () => {
  let cursor = 0; const slots = [], effects = [];
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; }, useRef: value => ({ current: value }), useId: () => `context-${cursor++}`, useEffect: fn => effects.push(fn) };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText, "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "token" } }, {
    AbortController, URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, source: null, enabled: true, businessContext: { ready: false, name: null } }) }),
  });
  const render = () => { cursor = 0; const wrapper = mod.RemixTextSection({ owner: "owner", targetKey: "scratch", format: "hook", expanded: true, editorNavigation: true, onUse() {} }); return wrapper.type(wrapper.props); };
  let tree = render();
  assert.equal(nodes(tree).find(node => node.type === "strong").props.children, "Loading…");
  effects.splice(0).forEach(fn => fn()); await new Promise(setImmediate); tree = render();
  assert.equal(nodes(tree).find(node => node.type === "strong").props.children, "Not set");
  assert.ok(nodes(tree).some(node => node.type === "a" && node.props.children === "Add context"));
  assert.equal(nodes(tree).find(node => node.type === "Button" && node.props.children === "Generate remix").props.disabled, true);
});


for (const format of ["hook", "wall_text"]) test(`${format}: reference-first editor follows the generated clip's original reference and rejects stale gallery selection`, () => {
  const original = { id: "original-reference", format, videoUrl: "/original.mp4" };
  const current = { id: "new-gallery-selection", format, videoUrl: "/different.mp4" };
  const source = { id: "00000000-0000-4000-8000-000000000001", status: "ready", collection: "video", url: "/generated.mp4", durationSeconds: 5, width: 720, height: 1280, metadata: { remixTextSource: { format, referenceId: original.id, sourceUrl: original.videoUrl } } };
  const react = { useState: value => [typeof value === "function" ? value() : value, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect() {} };
  const mod = load("components/explore/format-video-editor.tsx", { react,
    "react-dom": { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) },
    "@tanstack/react-query": { useQuery: options => options.queryKey[0] === "explore-edit-source" ? { data: source } : {} },
    "@/contexts/auth-context": { useAuth: () => ({ user: null }) },
    "@/components/explore/format-video-text-fields": fields,
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({}) },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: {}, useWorkflowFinishing: () => ({ action: { disabled: true, onAction() { throw Error("Changing layout cannot render a video"); } } }) },
  });
  const render = () => mod.FormatVideoEditor({ format, video: { ...source, mediaAssetId: source.id, ratio: "9:16", title: "Generated clip" }, remixReference: current, remixReferences: [original, current], active: true, controlsTarget: {}, resultsTarget: {}, enabled: false, onDirty() {}, onSaved() {}, onContinue() {} });
  let tree = render();
  let remix = nodes(tree).find(n => n.type === "RemixTextSection");
  assert.equal(remix.props.reference, original);
  assert.equal(remix.props.referenceFirst, true);
  assert.ok(nodes(tree).indexOf(remix) < nodes(tree).findIndex(n => n.props?.["data-editor-section"] === "trim"), "Reference text is the first editing task");
  source.metadata.remixTextSource = null;
  tree = render(); remix = nodes(tree).find(n => n.type === "RemixTextSection");
  assert.equal(remix.props.reference, null);
  assert.equal(remix.props.referenceFirst, false, "An uploaded or unlinked clip must not borrow today's gallery selection");
});

for (const linked of [true, false]) test(`expanded Remix ${linked ? "leads with the linked reference" : "keeps manual editing first without a reference"}`, () => {
  const react = { useState: value => [typeof value === "function" ? value() : value, () => {}], useRef: value => ({ current: value }), useId: (() => { let id = 0; return () => `priority-${id++}`; })(), useEffect() {} };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText });
  const manual = { type: "manual-fields", props: { children: "Keep my current caption" } };
  const seed = { referenceId: "wall-example", slideId: null, sourceSha256: "a".repeat(64), format: "wall_text", status: "ready", blocks: [{ text: "Original video caption", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-15T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
  const wrapper = mod.RemixTextSection({ owner: null, targetKey: "video:generated", format: "wall_text", reference: linked ? { id: seed.referenceId, format: seed.format } : null, previewSource: seed, expanded: true, editorNavigation: true, referenceFirst: true, localPreview: true, children: manual, onUse() { throw Error("Opening the editor cannot apply text"); } });
  const tree = wrapper.type(wrapper.props), all = nodes(tree);
  const panel = all.find(n => n.props?.["data-remix-control"]);
  assert.equal(Boolean(tree.props["data-remix-priority"]), linked);
  assert.equal(all.indexOf(panel) < all.indexOf(manual), linked);
  assert.ok(all.some(n => n.type === "Button" && n.props.children === "Generate remix"));
  assert.equal(panel.type, "div", "The full Remix form is expanded");
  if (linked) {
    assert.equal(all.find(n => n.props?.["aria-label"] === "Text to remix").props.value, "Original video caption");
    assert.equal(all.filter(n => n.type === "Button" && n.props.children === "Edit text manually").length, 0, "The direct text editor makes a second edit-text action unnecessary");
  }
});


for (const accepted of [false, true]) test(`single remix input ${accepted ? "recovers the exact accepted request" : "reveals legacy guidance in the editable box"}`, async () => {
  let cursor = 0, sent; const slots = [], effects = [];
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; }, useRef(value) { return slots[cursor++] ??= { current: value }; }, useId: () => `compact-${cursor++}`, useEffect: fn => effects.push(fn) };
  const saved = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: "hook-a", slideId: null, format: "hook", referenceBlocks: ["Saved source text"], instructions: "Keep it friendly", outcome: "uncertain" };
  const source = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "Saved source text", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-15T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
  const mod = load("components/explore/remix-text-section.tsx", { react, "@/lib/explore/reference-text": referenceText, "@/lib/explore/remix-text-draft": { readRemixTextDraft }, "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "token" } }, {
    AbortController, AbortSignal, URLSearchParams, crypto: { randomUUID: () => saved.requestKey },
    localStorage: { getItem: key => key.endsWith(":input") ? JSON.stringify({ seed: "Saved source text", instructions: "Keep it friendly" }) : accepted ? JSON.stringify(saved) : null, setItem() {}, removeItem() {} },
    fetch: async (_url, options) => { if (options.method === "POST") sent = JSON.parse(options.body); return { ok: true, json: async () => options.method === "POST" ? { ok: true, source, output: { blocks: ["Our source text"], heading: "", body: "" } } : { ok: true, source, enabled: true, businessContext: { ready: true, name: "Acme" } } }; },
  });
  const render = () => { cursor = 0; const wrapper = mod.RemixTextSection({ owner: "owner", targetKey: "clip", reference: { id: "hook-a", format: "hook" }, format: "hook", expanded: true, editorNavigation: true, onUse() {} }); return wrapper.type(wrapper.props); };
  let tree = render(); effects.splice(0).forEach(fn => fn()); await new Promise(setImmediate); tree = render();
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Text to remix").props.value, "Saved source text\n\nKeep it friendly");
  assert.equal(nodes(tree).some(n => n.props?.["aria-label"] === "Remix instructions"), false);
  const generate = nodes(tree).find(n => n.type === "Button" && n.props.children === (accepted ? "Check remix result" : "Generate remix"));
  generate.props.onClick(); await new Promise(setImmediate);
  assert.equal(sent.requestKey, saved.requestKey);
  assert.equal(sent.instructions, accepted ? "Keep it friendly" : "Saved source text\n\nKeep it friendly");
  assert.deepEqual(sent.referenceBlocks, accepted ? ["Saved source text"] : ["Saved source text\n\nKeep it friendly"]);
});
