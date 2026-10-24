import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("reference videos stay still until hover, stop on leave and respect visibility and reduced motion", async () => {
  const listeners = new Map(), events = new Map();
  let intersect, timer, cleanup, source;
  const link = { matches: () => false, addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const video = { plays: 0, pauses: 0, closest: () => link, hasAttribute: () => Boolean(source), removeAttribute: () => { source = undefined; }, load() {},
    set src(value) { source = value; }, play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; }, addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const preference = { matches: false, addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} };
  const document = { visibilityState: "visible", addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/use-cover-playback.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: exported, document, window: { matchMedia: () => preference }, setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = undefined; },
    IntersectionObserver: class { constructor(fn) { intersect = fn; } observe() {} disconnect() {} },
    require: () => ({ useRef: () => ({ current: video }), useEffect: fn => { cleanup = fn(); } }) });
  exported.useCoverPlayback("https://media.test/clip.mp4", "button");
  assert.equal(source, undefined);
  intersect([{ isIntersecting: true }]); assert.equal(timer, undefined); assert.equal(video.plays, 0);
  events.get("pointerenter")({ pointerType: "touch" }); assert.equal(timer, undefined);
  events.get("pointerenter")({ pointerType: "mouse" }); timer(); assert.equal(video.plays, 1);
  events.get("pointerleave")(); assert.equal(source, undefined);
  document.visibilityState = "hidden"; listeners.get("visibilitychange")();
  document.visibilityState = "visible"; listeners.get("visibilitychange")(); assert.equal(source, undefined); assert.equal(video.plays, 1);
  events.get("focus")(); timer(); assert.equal(video.plays, 2);
  intersect([{ isIntersecting: false }]); assert.equal(source, undefined);
  intersect([{ isIntersecting: true }]); timer(); assert.equal(video.plays, 3);
  document.visibilityState = "hidden"; listeners.get("visibilitychange")(); assert.equal(source, undefined);
  document.visibilityState = "visible"; listeners.get("visibilitychange")(); timer(); assert.equal(video.plays, 4);
  preference.matches = true; events.get("change")(); assert.equal(source, undefined);
  cleanup();
});

test("a private blob resolving under an already hovered card starts without requiring a second pointer enter", () => {
  let intersect, timer, source;
  const link = { matches: selector => selector === ":hover", addEventListener() {}, removeEventListener() {} };
  const video = { closest: () => link, hasAttribute: () => Boolean(source), removeAttribute() {}, load() {}, pause() {},
    set src(value) { source = value; }, play: () => Promise.resolve(), addEventListener() {}, removeEventListener() {} };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/use-cover-playback.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: exported,
    document: { visibilityState: "visible", activeElement: null, addEventListener() {}, removeEventListener() {} },
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {},
    IntersectionObserver: class { constructor(fn) { intersect = fn; } observe() {} disconnect() {} },
    require: () => ({ useRef: () => ({ current: video }), useEffect: fn => fn() }),
  });
  exported.useCoverPlayback("blob:private-authenticated", "button");
  intersect([{ isIntersecting: true }]); assert.equal(typeof timer, "function"); timer();
  assert.equal(source, "blob:private-authenticated");
});
