import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { withReadDeadline } from "../lib/http/read-deadline.ts";
import { createInFlightAuthRequestCoalescer } from "../lib/firebase/in-flight-auth-requests.ts";

function fixture(fetch) {
  const exports = {};
  const source = readFileSync(new URL("../lib/firebase/server-auth.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, fetch, process: { env: { NODE_ENV: "production", NEXT_PUBLIC_FIREBASE_API_KEY: "fixture-key" } }, require(name) {
    if (name === "server-only") return {};
    if (name === "./in-flight-auth-requests") return { createInFlightAuthRequestCoalescer };
    if (name === "../http/read-deadline") return { withReadDeadline };
    throw Error(`Unexpected import ${name}`);
  } });
  return exports;
}
const request = token => new Request("https://fixture.invalid/api", { headers: { authorization: `Bearer ${token}` } });
const user = verified => Response.json({ users: [{ localId: "owner", emailVerified: verified }] });
const settle = () => new Promise(setImmediate);

for (const phase of ["headers", "body"]) {
  test(`a stalled Firebase ${phase} read releases shared requests and permits a fresh lookup`, async t => {
    const deadline = new AbortController();
    t.mock.method(AbortSignal, "timeout", () => deadline.signal);
    let calls = 0, capturedSignal;
    const auth = fixture(async (_url, init) => {
      calls++; capturedSignal = init.signal;
      if (calls > 1) return user(true);
      if (phase === "headers") return new Promise(() => {});
      return { ok: true, json: () => new Promise(() => {}) };
    });
    const pending = Promise.allSettled([auth.requireFirebaseUser(request("a")), auth.requireFirebaseUser(request("a"))]);
    await settle();
    assert.equal(calls, 1, "Concurrent checks share one authoritative lookup");
    deadline.abort();
    const results = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve(null), 50))]);
    assert.ok(results, "A stalled lookup must not keep all same-token requests pending");
    assert.equal(capturedSignal.aborted, true);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      assert.equal(result.reason.status, 503, "Timeout is unavailable, not invalid credentials");
    }
    t.mock.restoreAll();
    assert.equal((await auth.requireFirebaseUser(request("a"))).uid, "owner");
    assert.equal(calls, 2);
  });
}

test("invalid and unverified credentials still fail closed; successful lookups are not cached", async () => {
  let calls = 0;
  const auth = fixture(async () => { calls++; return user(true); });
  await auth.requireFirebaseUser(request("a"));
  await auth.requireFirebaseUser(request("a"));
  assert.equal(calls, 2);
  await assert.rejects(fixture(async () => Response.json({ error: { message: "INVALID_ID_TOKEN" } }, { status: 400 })).requireFirebaseUser(request("bad")), error => error.status === 401);
  await assert.rejects(fixture(async () => user(false)).requireFirebaseUser(request("unverified")), error => error.status === 403);
});

test("upstream outage and throttling are unavailable, not a false sign-out", async () => {
  for (const status of [429, 500, 503]) {
    await assert.rejects(fixture(async () => Response.json({ error: {} }, { status })).requireFirebaseUser(request("a")), error => error.status === 503);
  }
});
