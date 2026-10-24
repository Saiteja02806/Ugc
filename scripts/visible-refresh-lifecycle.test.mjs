import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture(refresh) {
  const exported = {}, timers = new Map(), page = new EventTarget(), events = new EventTarget();
  page.visibilityState = "visible";
  const connection = { onLine: true }; let effect, next = 0;
  const code = ts.transpileModule(readFileSync(new URL("../components/hooks/use-visible-refresh.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, require: () => ({ useEffect: fn => { effect = fn; }, useEffectEvent: fn => fn }),
    document: page, window: events, navigator: connection,
    setTimeout: fn => { const id = ++next; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
  });
  exported.useVisibleRefresh({ refresh, intervalMs: 1000, maxPolls: 3 }); const cleanup = effect();
  return { timers, page, events, connection, cleanup,
    tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(run => run()); } };
}
const settle = () => new Promise(setImmediate);

test("shared Content/Demo/Assets refresh suspends hidden/offline, coalesces resume and cleans up", async () => {
  let reads = 0, finish;
  const h = fixture(async () => { reads++; await new Promise(resolve => { finish = resolve; }); });
  assert.equal(h.timers.size, 1);
  h.connection.onLine = false; h.events.dispatchEvent(new Event("offline")); h.tick(); assert.equal(reads, 0);
  h.events.dispatchEvent(new Event("focus")); assert.equal(reads, 0);
  h.page.visibilityState = "hidden"; h.connection.onLine = true; h.events.dispatchEvent(new Event("online")); assert.equal(reads, 0);
  h.page.visibilityState = "visible"; h.page.dispatchEvent(new Event("visibilitychange")); assert.equal(reads, 1);
  h.events.dispatchEvent(new Event("focus")); h.events.dispatchEvent(new Event("online")); assert.equal(reads, 1);
  finish(); await settle(); assert.equal(h.timers.size, 1);
  h.tick(); assert.equal(reads, 2);
  h.cleanup(); finish(); await settle(); assert.equal(h.timers.size, 0);
  h.events.dispatchEvent(new Event("online")); h.events.dispatchEvent(new Event("focus")); h.page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(reads, 2);
});

test("failed status reads recover without overlapping or running beyond the polling budget", async () => {
  let reads = 0;
  const h = fixture(async () => { reads++; throw Error("Temporary network error"); });
  for (let index = 0; index < 3; index++) { h.tick(); await settle(); }
  assert.equal(reads, 3); assert.equal(h.timers.size, 0);
  h.events.dispatchEvent(new Event("focus")); await settle();
  assert.equal(reads, 4, "An explicit return check is allowed after the background polling budget");
  assert.equal(h.timers.size, 0); h.cleanup();
});
