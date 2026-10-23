import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("visible reference videos start without hover, unload offscreen and resume after tab return", async () => {
  const listeners = new Map(), events = new Map();
  let intersect, timer, cleanup, source;
  const link = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const video = { plays: 0, pauses: 0, closest: () => link, hasAttribute: () => Boolean(source), removeAttribute: () => { source = undefined; }, load() {},
    set src(value) { source = value; }, play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; }, addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const preference = { matches: false, addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const document = { visibilityState: "visible", addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/use-cover-playback.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: exported, document, window: { matchMedia: () => preference }, setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = undefined; },
    IntersectionObserver: class { constructor(fn) { intersect = fn; } observe() {} disconnect() {} },
    require: () => ({ useRef: () => ({ current: video }), useEffect: fn => { cleanup = fn(); } }) });
  exported.useCoverPlayback("https://media.test/clip.mp4", "button", true);
  assert.equal(source, undefined);
  intersect([{ isIntersecting: true }]); timer(); assert.equal(video.plays, 1);
  intersect([{ isIntersecting: false }]); assert.equal(source, undefined);
  intersect([{ isIntersecting: true }]); timer(); assert.equal(video.plays, 2);
  document.visibilityState = "hidden"; listeners.get("visibilitychange")(); assert.equal(source, undefined);
  document.visibilityState = "visible"; listeners.get("visibilitychange")(); timer(); assert.equal(video.plays, 3);
  preference.matches = true; events.get("change")(); assert.equal(source, undefined);
  cleanup();
});
