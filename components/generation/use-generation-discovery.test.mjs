import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as generation from "../../lib/ai-studio/pending-generation.ts";
import { withReadDeadline } from "../../lib/http/read-deadline.ts";

const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const requestKey = randomUUID(), jobs = [{ jobId: randomUUID(), generationId: randomUUID() }], store = new Map(), calls = [], acknowledgments = [];
  const saved = { version: 1, ownerId: "owner", kind: "image", scope: "slideshow", requestKey, input: { prompt: "original", quantity: 2, aspectRatio: "4:5", exploreFormat: "slideshow", idempotencyKey: requestKey } };
  const key = generation.generationDiscoveryKey("owner", "image", "slideshow"); store.set(key, JSON.stringify([saved]));
  const states = [], refs = [], callbacks = [], dependencies = [], cleanups = [], pendingEffects = [], listeners = new Map();
  let cursor = 0, refCursor = 0, callbackCursor = 0, effectCursor = 0;
  let network = async (url, init) => { calls.push({ url, ...init }); assert.equal(init.method, undefined, "Archived recovery can only GET"); return Response.json({ ok: true, requestKey, outcome: "confirmed", jobs }); };
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const imports = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], next => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; },
      useRef(value) { return refs[refCursor++] ??= { current: value }; },
      useCallback(fn, deps) { const i = callbackCursor++, old = callbacks[i]; if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
      useEffect(fn, deps) { const i = effectCursor++, old = dependencies[i]; if (!old || deps.some((value, j) => !Object.is(value, old[j]))) { dependencies[i] = deps; pendingEffects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
    },
    "@/lib/ai-studio/pending-generation": generation,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "token" },
    "@/lib/http/read-deadline": { withReadDeadline },
  };
  const exports = {}, code = ts.transpileModule(readFileSync(new URL("./use-generation-discovery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name], localStorage: storage, navigator: { locks: { request: async (_key, _options, fn) => fn({}) } }, fetch: (...args) => network(...args), Event,
    window: { addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); }, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn), dispatchEvent: event => { for (const fn of listeners.get(event.type) ?? []) fn(); } },
  });
  const props = { ownerId: "owner", kind: "image", scope: "slideshow", enabled: true, onRecovered: (result, input) => acknowledgments.push({ result, input }) };
  const render = () => { cursor = refCursor = callbackCursor = effectCursor = 0; return exports.useGenerationDiscovery(props); };
  return { render, props, calls, store, key, jobs, requestKey, acknowledgments, network: fn => { network = fn; }, flush: async () => { pendingEffects.splice(0).forEach(fn => fn()); await tick(); await tick(); }, unmount: () => cleanups.forEach(fn => fn?.()) };
}

test("hydration only GETs archived requests once and explicit checks discover later children without polling", async () => {
  const h = harness(); h.render(); await h.flush();
  assert.equal(h.calls.length, 1); assert.equal(h.acknowledgments[0].input.prompt, "original");
  let view = h.render(); assert.equal(view.available, true); await h.flush();
  assert.equal(h.calls.length, 1, "State updates do not restart hydration or poll");
  h.jobs.push({ jobId: randomUUID(), generationId: randomUUID() });
  await view.check(); view = h.render(); assert.equal(view.available, false);
  assert.equal(h.calls.length, 2); assert.equal(h.acknowledgments.at(-1).result.jobs.length, 2);
  assert.deepEqual(JSON.parse(h.store.get(h.key)), []); h.unmount();
});

test("an account change during an archived GET cannot acknowledge its result into the new account", async () => {
  const h = harness(); h.render(); await h.flush();
  const count = h.acknowledgments.length;
  let release;
  h.network(() => new Promise(resolve => { release = resolve; }));
  const checking = h.render().check(); await tick();
  h.props.ownerId = "other-owner"; h.render(); await h.flush();
  release(Response.json({ ok: true, requestKey: h.requestKey, jobs: h.jobs, outcome: "confirmed" }));
  await checking; const view = h.render();
  assert.equal(h.acknowledgments.length, count); assert.equal(view.available, false); assert.equal(view.error, null);
  assert.equal(JSON.parse(h.store.get(h.key)).length, 1); h.unmount();
});

test("inactive and local-preview callers do not read account generations", async () => {
  const h = harness(); h.props.enabled = false; h.render(); await h.flush();
  await h.render().check(); assert.equal(h.calls.length, 0); assert.equal(h.acknowledgments.length, 0); h.unmount();
});
