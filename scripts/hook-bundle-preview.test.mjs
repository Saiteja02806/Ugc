import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the component directly; no application build or browser bundle.
const source = readFileSync(new URL("../components/marketing/hook-video-bundle.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const available = { count: 2, limit: 100, exhausted: false, started: false, videoCount: 104 };
function harness(status = available) {
  const states = [status, null, false, false, false];
  let stateIndex, refIndex, loads = 0, fetches = 0;
  const refs = [{ current: { load() { loads++; }, play() { return Promise.resolve(); } } }, { current: { value: "" } }, { current: null }, { current: false }, { current: null }];
  const exports = {};
  const element = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, { exports, AbortSignal, crypto: { randomUUID: () => "preview-test-request" }, fetch() { fetches++; throw new Error("Preview must not call the download API"); }, require(name) {
    if (name === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "fragment" };
    if (name === "react") return { useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; }, useRef() { return refs[refIndex++]; }, useEffect() {}, useCallback: callback => callback };
    if (name === "next/link") return { default: "link" };
    if (name === "lucide-react") return { Download: "download-icon", Film: "film-icon" };
    if (name.endsWith("/button")) return { Button: "button" };
    if (name.endsWith("/batch-notification-form")) return { BatchNotificationForm: "notification-form" };
    if (name.endsWith("/hook-bundle-copy")) return { BATCH_ONE_COMPLETE: "Batch 1 complete" };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return { states, refs, get loads() { return loads; }, get fetches() { return fetches; }, render(compact = false) { stateIndex = 0; refIndex = 0; return exports.HookVideoBundle({ compact }); } };
}
function all(node, type) {
  if (Array.isArray(node)) return node.flatMap(child => all(child, type));
  if (!node || typeof node !== "object") return [];
  return [...(node.type === type ? [node] : []), ...all(node.props?.children, type)];
}
function download(tree) { return all(tree, "button").find(node => node.props.type === "submit"); }

test("only the standalone page loads a full-bleed, autoplaying video preview without controls", () => {
  const h = harness(), standalone = h.render(), compact = h.render(true);
  const videos = all(standalone, "video");
  assert.equal(videos.length, 1);
  assert.match(videos[0].props.src, /^https:\/\/storage\.googleapis\.com\/ugcsaas-media\/marketing\/hook-video-library\/v1\/.+\.mp4$/);
  assert.equal(videos[0].props.controls, undefined);
  assert.equal(videos[0].props.playsInline, true);
  assert.equal(videos[0].props.preload, "auto");
  assert.equal(videos[0].props.autoPlay, true);
  assert.equal(videos[0].props.loop, true);
  assert.equal(videos[0].props.muted, true);
  assert.match(videos[0].props.className, /object-cover/);
  assert.equal(all(compact, "video").length, 0);
  assert.match(download(compact).props.className, /min-h-\[52px\] rounded-full/);
  assert.equal(all(standalone, "form")[0].props.action, "/api/resources/hook-video-bundle");
  assert.equal(all(standalone, "form")[0].props.method, "post");
  assert.equal(all(standalone, "form")[0].props.target, "hook-bundle-download");
});

test("a failed preview and its retry never lock, claim or reset a library download", () => {
  const h = harness();
  all(h.render(), "video")[0].props.onError();
  const failed = h.render();
  assert.equal(download(failed).props.disabled, false);
  assert.equal(all(failed, "p").some(node => node.props.role === "alert"), true);
  const retry = all(failed, "button").find(node => node.props.children === "Retry preview");
  retry.props.onClick();
  assert.equal(h.loads, 1);
  assert.equal(h.states[4], false);
  assert.equal(h.states[0], available);
  assert.equal(h.fetches, 0);
  assert.equal(download(h.render()).props.disabled, false);
});

test("preview playback preserves loading, exhausted and already-started download gates", () => {
  for (const [status, started] of [[null, false], [{ ...available, count: 100, exhausted: true }, false], [available, true]]) {
    const h = harness(status); h.states[3] = started;
    all(h.render(), "video")[0].props.onError();
    assert.equal(download(h.render()).props.disabled, true);
    assert.equal(h.states[3], started);
    assert.equal(h.fetches, 0);
  }
});
