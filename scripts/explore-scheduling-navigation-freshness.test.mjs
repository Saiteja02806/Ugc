import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createScheduleCacheFixture } from "./scheduling-cache-test-helpers.mjs";

// Execute Scheduling's actual entry effect with the real React Query loader.
// This reproduces revisiting a warm calendar after a workflow saved a new post.
const source = ts.createSourceFile("scheduling-workspace.tsx", readFileSync(new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SchedulingWorkspace");
const entryEffect = component.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useEffect" && node.getText(source).includes("void loadScheduleMedia()"));
assert.ok(entryEffect, "Use the real scheduling entry effect");

function enterScheduling(accountId, loadSchedules) {
  const timers = new Map();
  let cleanup;
  vm.runInNewContext(ts.transpileModule(entryEffect.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    accountId, loadSchedules, loadScheduleMedia() {}, loadSocialConnections() {},
    useEffect: effect => { cleanup = effect(); },
    window: { setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) },
  });
  return { run: () => { for (const fn of timers.values()) fn(); timers.clear(); }, cleanup: () => cleanup?.() };
}

for (const sourceKind of ["media_asset", "library_item"]) {
  test(`returning from ${sourceKind === "media_asset" ? "Hook Video" : "slideshow"} refreshes a fresh cached calendar without a page reload`, async () => {
    const post = { id: "new-saved-post", sourceKind, status: "scheduled" };
    let requests = 0;
    const cache = createScheduleCacheFixture("account-a", async (url, options) => {
      assert.equal(url, "/api/schedules");
      assert.equal(options.headers.Authorization, "Bearer fixture-owner-token");
      assert.equal(options.cache, "no-store");
      requests++;
      return Response.json({ ok: true, schedules: [post], minimumScheduleLeadMinutes: 5 });
    });
    let displayed = cache.data();
    assert.equal(displayed.schedules.length, 0);
    let finished;
    const entry = enterScheduling("account-a", options => {
      finished = cache.api.loadAccountSchedules(cache.queryClient, "account-a", options).then(data => { displayed = data; });
      return finished;
    });
    try {
      entry.run(); await finished;
      assert.equal(requests, 1, "A warm cached list must still be reconciled with the server");
      assert.equal(displayed.schedules[0].id, post.id);
      assert.equal(cache.data().schedules[0].sourceKind, sourceKind);
      assert.equal(cache.foreign().schedules[0].id, "foreign-post");
    } finally { entry.cleanup(); cache.queryClient.clear(); }
  });
}

test("signed-out and abandoned calendar entries do not start authenticated reads", () => {
  let requests = 0;
  const signedOut = enterScheduling("signed-out", () => { requests++; });
  signedOut.run(); signedOut.cleanup();
  const abandoned = enterScheduling("account-a", () => { requests++; });
  abandoned.cleanup(); abandoned.run();
  assert.equal(requests, 0);
});
