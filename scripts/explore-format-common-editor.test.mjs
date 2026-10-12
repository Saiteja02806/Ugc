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
import { isExploreUuid } from "../worker/src/lib/explore-finishing-contract.ts";

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, ...globals, require(name) {
    if (name === "@/lib/explore/format-edit-draft") return editDraft;
    if (name === "@/lib/explore/unchanged-hook-source") return unchangedHook;
    if (name === "@/lib/explore/reference-audio-preview") return referenceAudio;
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
  const generate = nodes(tree).find(node => node.type === "Button" && node.props.children === "Generate");
  assert.ok(generate);
  assert.equal(generate.props.disabled, true, "The local fixture cannot make an AI request");
  assert.equal(nodes(tree).some(node => node.type === "Button" && node.props.children === "Generate remix"), false, "One visible Generate action");
  assert.equal(nodes(tree).find(node => node.props?.["data-remix-control"]).props.children[1].props.hidden, undefined);
  assert.equal(nodes(tree).find(node => node.props?.role === "status").props.children, "Available");
  assert.ok(nodes(tree).indexOf(manual) < nodes(tree).findIndex(node => node.props?.["data-remix-control"]), "Manual editing sits above the remix box");
  const options = nodes(tree).find(node => node.props?.["aria-label"] === "Remix options");
  assert.equal(options.props["aria-expanded"], false, "Optional guidance starts out of the main view");
  options.props.onClick(); tree = render();
  assert.equal(nodes(tree).find(node => node.props?.id === options.props["aria-controls"]).props.hidden, false);
  nodes(tree).find(node => node.props?.["aria-label"] === "Remix instructions").props.onChange({ target: { value: "Keep it conversational" } });
  tree = render(); nodes(tree).find(node => node.props?.["aria-label"] === "Remix options").props.onClick(); tree = render();
  assert.equal(nodes(tree).find(node => node.props?.id === options.props["aria-controls"]).props.hidden, true);
  assert.equal(nodes(tree).find(node => node.props?.["aria-label"] === "Remix instructions").props.value, "Keep it conversational", "Closing Options preserves guidance");
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

test("overview Generate submits the edited hook seed only on click, then applies the reviewed result to its clip", async () => {
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
  let tree = render(); effects.splice(0).forEach(fn => fn()); await new Promise(setImmediate); tree = render();
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, undefined, "Mounting only loads reference and business details");
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.value, "An example hook");
  assert.equal(nodes(tree).some(n => n.type === "a" && n.props.children === "Review"), false, "Ready business context stays connected without the overview row");
  nodes(tree).find(n => n.props?.["aria-label"] === "Remix options").props.onClick(); tree = render();
  nodes(tree).find(n => n.props?.["aria-label"] === "Remix instructions").props.onChange({ target: { value: "Use a friendly tone and avoid emojis" } }); tree = render();
  nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.onChange({ target: { value: "Introduce our planning app" } }); tree = render();
  const generate = nodes(tree).find(n => n.type === "Button" && n.props.children === "Generate");
  assert.equal(Boolean(generate.props.disabled), false); generate.props.onClick(); await new Promise(setImmediate); tree = render();
  assert.equal(calls.length, 2); assert.equal(calls[1].url, "/api/explore/remix-text");
  const payload = JSON.parse(calls[1].options.body);
  assert.deepEqual(payload.referenceBlocks, ["Introduce our planning app"]); assert.equal(payload.referenceId, "hook-a");
  assert.equal(payload.instructions, "Use a friendly tone and avoid emojis", "Optional guidance still reaches generation");
  assert.equal(calls[1].options.headers["Idempotency-Key"], payload.requestKey);
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Remixed text").props.value, "Plan your day in one place");
  nodes(tree).find(n => n.type === "Button" && n.props.children === "Apply to hook").props.onClick(); tree = render();
  assert.equal(applied.output.blocks[0], "Plan your day in one place"); assert.equal(applied.original.referenceId, "hook-a");
  assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Reference text").props.value, "Introduce our planning app");
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
    if (format === "hook") {
      const remixOverviewTarget = {};
      const overview = nodes(render(false, { remixOverviewTarget }));
      assert.equal(overview.filter(n => n.type === "RemixTextSection").length, 1);
      const manual = overview.find(n => n.type === "RemixTextSection").props.children;
      assert.ok(manual.props.children.includes("Add text manually"));
      manual.props.onClick();
      assert.equal(opened, 2, "Manual text opens the same clip editor as Edit hook video");
      assert.ok(overview.some(n => n.type === "portal" && n.props.target === remixOverviewTarget));
      const seed = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "An example hook", startMs: 0, endMs: 5000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
      assert.equal(overview.find(n => n.type === "RemixTextSection").props.onUse({ blocks: ["Our product hook"], heading: "", body: "" }, seed), true);
      const editing = nodes(render(true, { remixOverviewTarget }));
      assert.equal(editing.filter(n => n.type === "RemixTextSection").length, 1, "Clip tools do not duplicate the overview remix");
      assert.equal(editing.find(n => n.type === "FormatVideoTextOverlay").props.text.value, "Our product hook");
      assert.equal(editing.find(n => n.props?.["aria-label"] === "Trim start").props.value, 2);
      assert.ok(nodes(render(false, { remixOverviewTarget, active: false })).some(n => n.type === "RemixTextSection"), "The scoped remix stays mounted when viewing the Demo");
      assert.equal(requests, 0);
    }
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
