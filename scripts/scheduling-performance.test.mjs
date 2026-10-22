import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createScheduleCacheFixture } from "./scheduling-cache-test-helpers.mjs";

const source = ts.createSourceFile("scheduling-workspace.tsx", readFileSync(new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SchedulingWorkspace");
const pollEffect = component.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useEffect" && node.getText(source).includes("function scheduleRefresh"));
assert.ok(pollEffect, "Exercise the real scheduling refresh effect");
const settle = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function pollingFixture({ visible = true, online = true } = {}) {
  const timers = new Map(), listeners = new Map();
  const page = { visibilityState: visible ? "visible" : "hidden" };
  const network = { onLine: online };
  let nextTimer = 0, cleanup, calls = 0, mediaCalls = 0, accountCalls = 0, nextRead;
  const addEventListener = (name, fn) => listeners.set(name, fn);
  const removeEventListener = (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); };
  vm.runInNewContext(ts.transpileModule(pollEffect.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    accountId: "owner", serverSchedules: [{ id: "pending-post" }], navigator: network,
    document: Object.assign(page, { addEventListener, removeEventListener }),
    window: { addEventListener, removeEventListener, setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) },
    useEffect: effect => { cleanup = effect(); }, getScheduleRefreshDelay: () => 5_000,
    loadSchedules: () => { calls++; return nextRead?.promise ?? Promise.resolve({ schedules: [{ id: "pending-post" }] }); },
    loadScheduleMedia: () => { mediaCalls++; }, loadSocialConnections: () => { accountCalls++; },
  });
  return {
    timers, listeners, get calls() { return calls; }, get mediaCalls() { return mediaCalls; }, get accountCalls() { return accountCalls; },
    holdRead() { nextRead = deferred(); return nextRead; },
    tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); },
    hide() { page.visibilityState = "hidden"; listeners.get("visibilitychange")(); },
    show() { page.visibilityState = "visible"; listeners.get("visibilitychange")(); },
    offline() { network.onLine = false; listeners.get("offline")(); },
    online() { network.onLine = true; listeners.get("online")(); },
    focus() { listeners.get("focus")(); }, stop: () => cleanup?.(),
  };
}

test("active schedule reads stop while hidden/offline and resume one read without replaying an action", async () => {
  const h = pollingFixture();
  assert.equal(h.timers.size, 1);
  h.hide(); assert.equal(h.timers.size, 0); assert.equal(h.calls, 0);
  h.offline(); h.show(); assert.equal(h.calls, 0);
  const read = h.holdRead();
  h.online(); h.focus(); h.show();
  assert.equal(h.calls, 1, "Resume and focus cannot overlap schedule reads");
  assert.ok(h.mediaCalls > 0 && h.accountCalls > 0, "Returning also revalidates stale catalogues");
  h.hide(); read.resolve({ schedules: [] }); await settle();
  assert.equal(h.timers.size, 0, "A completed hidden read cannot restart the timer");
  h.show(); await settle(); assert.equal(h.calls, 2); assert.equal(h.timers.size, 1);
  h.stop(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});

test("opening a background/offline calendar schedules no active-work reads", () => {
  for (const options of [{ visible: false }, { online: false }]) {
    const h = pollingFixture(options); assert.equal(h.calls, 0); assert.equal(h.timers.size, 0); h.stop();
  }
});

for (const loader of ["loadAccountSchedules", "loadAccountSocialConnections", "loadAccountScheduleConfig"]) {
  test(`${loader} bounds stalled authentication and does not fetch with a late token`, async () => {
    const auth = deferred(); let requests = 0;
    const cache = createScheduleCacheFixture("owner", async () => { requests++; return Response.json({ ok: true }); }, { timeoutMs: 15, getToken: expectedOwner => { assert.equal(expectedOwner, "owner"); return auth.promise; } });
    const keepAlive = setTimeout(() => {}, 1_000);
    try {
      await assert.rejects(cache.api[loader](cache.queryClient, "owner", { force: true }), /Loading took too long/);
      auth.resolve("late-owner-token"); await settle();
      assert.equal(requests, 0);
      assert.equal(cache.data().schedules.length, 0, "Prior cache stays available");
    } finally { clearTimeout(keepAlive); cache.queryClient.clear(); }
  });
}

test("a stalled HTTP read releases loading and an ignored late response cannot replace the calendar", async () => {
  const response = deferred(); let calls = 0;
  const cache = createScheduleCacheFixture("owner", () => { calls++; return calls === 1 ? response.promise : Promise.resolve(Response.json({ ok: true, schedules: [{ id: "fresh-post" }] })); }, { timeoutMs: 15 });
  const keepAlive = setTimeout(() => {}, 1_000);
  try {
    await assert.rejects(cache.api.loadAccountSchedules(cache.queryClient, "owner", { force: true }), /Loading took too long/);
    assert.equal(cache.queryClient.getQueryState(cache.key).fetchStatus, "idle");
    await cache.api.loadAccountSchedules(cache.queryClient, "owner", { force: true });
    response.resolve(Response.json({ ok: true, schedules: [{ id: "stale-post" }] })); await settle();
    assert.equal(cache.data().schedules[0].id, "fresh-post");
    assert.equal(cache.foreign().schedules[0].id, "foreign-post");
    assert.equal(calls, 2, "Retry is explicit; no background mutation or replay occurs");
  } finally { clearTimeout(keepAlive); cache.queryClient.clear(); }
});

test("stalled response parsing also times out and retains the existing calendar", async () => {
  const body = deferred();
  const cache = createScheduleCacheFixture("owner", async () => ({ ok: true, json: () => body.promise }), { timeoutMs: 15 });
  const keepAlive = setTimeout(() => {}, 1_000);
  try {
    await assert.rejects(cache.api.loadAccountSchedules(cache.queryClient, "owner", { force: true }), /Loading took too long/);
    body.resolve({ ok: true, schedules: [{ id: "late-parsed-post" }] }); await settle();
    assert.equal(cache.data().schedules.length, 0);
  } finally { clearTimeout(keepAlive); cache.queryClient.clear(); }
});

test("concurrent owner calendar reads share one HTTP request and a warm snapshot remains immediate", async () => {
  const response = deferred(); let calls = 0;
  const cache = createScheduleCacheFixture("owner", () => { calls++; return response.promise; });
  try {
    const first = cache.api.loadAccountSchedules(cache.queryClient, "owner", { force: true });
    const second = cache.api.loadAccountSchedules(cache.queryClient, "owner", { force: true });
    await settle(); assert.equal(calls, 1);
    response.resolve(Response.json({ ok: true, schedules: [{ id: "retained-post" }] }));
    await Promise.all([first, second]);
    const warm = await cache.api.loadAccountSchedules(cache.queryClient, "owner");
    assert.equal(warm.schedules[0].id, "retained-post"); assert.equal(calls, 1);
  } finally { cache.queryClient.clear(); }
});
