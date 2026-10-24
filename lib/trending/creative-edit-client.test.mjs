import assert from "node:assert/strict";
import { mock, test } from "node:test";
let owner = "owner", tokenGate;
mock.module("@/lib/firebase/auth", { namedExports: { getCurrentUserIdToken: async expected => {
  await tokenGate;
  assert.equal(expected, owner, "Never issue a request for a different signed-in account");
  return "token";
} } });
const { submitCreativeEdit, readCreativeEdit, readCarouselEditStatus } = await import("./creative-edit-client.ts");
const scope = { format: "carousel", creativeId: "creative", assignmentId: "assignment" };
const record = { ...scope, revision: 2, renderState: "queued" };

test("navigation joins the original save; duplicate clicks and remounts issue one PATCH", async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(init.method || "GET");
    assert.equal(init.headers.Authorization, "Bearer token");
    assert.equal(init.cache, "no-store");
    if (init.method === "PATCH") await gate;
    return Response.json({ ok: true, edit: record });
  });
  const first = submitCreativeEdit(owner, scope, { expectedRevision: 1 }, () => false);
  assert.equal(submitCreativeEdit(owner, scope, {}, () => false), first);
  const reopened = readCreativeEdit(owner, scope, "editor");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ["PATCH"]);
  release();
  assert.deepEqual(await first, record);
  assert.deepEqual(await reopened, record);
  assert.deepEqual(calls, ["PATCH", "GET"]);
  mock.restoreAll();
});

test("a lost save response recovers the committed revision without another mutation", async () => {
  const calls = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(init.method || "GET");
    if (init.method === "PATCH") throw new TypeError("Network lost after commit");
    return Response.json({ ok: true, edit: record });
  });
  assert.deepEqual(await submitCreativeEdit(owner, scope, {}, edit => edit.revision === 2), record);
  assert.deepEqual(calls, ["PATCH", "GET"]);
  await assert.rejects(submitCreativeEdit(owner, scope, {}, () => false), /Network lost/);
  assert.deepEqual(calls, ["PATCH", "GET", "PATCH", "GET"]);
  mock.restoreAll();
});

test("cancelled status reads cannot issue a late authenticated request", async () => {
  let release; tokenGate = new Promise(resolve => { release = resolve; });
  mock.method(globalThis, "fetch", () => assert.fail("Cancelled navigation must not send HTTP"));
  const controller = new AbortController();
  const read = readCarouselEditStatus(owner, scope, controller.signal);
  controller.abort();
  await assert.rejects(read, { name: "AbortError" });
  release(); tokenGate = undefined;
  await new Promise(resolve => setTimeout(resolve, 0));
  mock.restoreAll();
});
