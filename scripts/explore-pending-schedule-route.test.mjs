import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { ExploreFinishError, isExploreUuid } from "../worker/src/lib/explore-finishing-contract.ts";
import * as signatures from "../lib/scheduling/finalization-signature.ts";

const key = "00000000-0000-4000-8000-000000000010";
class AuthError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
class ScheduleError extends Error { constructor(message, status = 400, code = "schedule_error") { super(message); this.status = status; this.code = code; } }
function load(path, imports, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Response, Buffer, URL, console: { error() {} }, ...extra });
  return exports;
}
function routes(options = {}) {
  const events = [], deferred = [], result = { ok: true, version: 1, requestKey: key,
    schedule: options.prior ? { id: key } : null, preparation: { state: options.prior ? "preparing" : "unconfirmed" } };
  const service = {
    explorePendingSchedulingAvailable: async () => { events.push("capability"); return true; },
    getExplorePendingSchedule: async (owner, requestKey) => { assert.equal(owner, "owner-a"); assert.equal(requestKey, key); events.push("read"); return result; },
    reserveExplorePendingSchedule: async (owner, body, access) => { assert.equal(owner, "owner-a"); assert.equal(body.requestKey, key); assert.equal(access.allowTikTokTargets, false);
      events.push("committed"); return { created: true, result: { ...result, schedule: { id: key }, preparation: { state: "preparing" } } }; },
    reconcileExplorePendingSchedule: async (owner, requestKey) => { assert.equal(owner, "owner-a"); assert.equal(requestKey, key); events.push("dispatch"); return { inspected: 1, finalized: false }; },
  };
  const handlers = load("../app/api/explore/schedules/route.ts", {
    "next/server": { after: callback => { events.push("deferred"); deferred.push(callback); } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (options.unauthenticated) throw new AuthError("Sign in"); return { uid: "owner-a" }; } },
    "@/lib/ai-studio/server-access": { isAIStudioProUser: async () => !options.noPlan },
    "@/lib/social/tiktok-beta-access": { hasTikTokBetaAccess: () => false },
    "@/lib/social/youtube-beta-access": { hasYouTubeBetaAccess: () => false },
    "@/worker/src/lib/explore-finishing-contract": { ExploreFinishError, isExploreUuid },
    "@/lib/scheduling/errors": { SchedulingRequestError: ScheduleError },
    "@/lib/explore/pending-schedule-service": service,
  });
  return { handlers, events, deferred };
}
const post = (body = { requestKey: key }, headers = {}) => new Request("https://example.test/api/explore/schedules", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...headers }, body: JSON.stringify(body),
});
test("authenticated acceptance returns 202 after durable commit and before background dispatch", async () => {
  const h = routes(), response = await h.handlers.POST(post());
  assert.equal(response.status, 202); assert.deepEqual(h.events, ["read", "committed", "deferred"]);
  assert.equal((await response.json()).preparation.state, "preparing");
  await h.deferred[0](); assert.equal(h.events.at(-1), "dispatch");
});
test("GET capability and saved-request recovery are read-only; identity ambiguity is rejected", async () => {
  const h = routes();
  assert.equal((await h.handlers.GET(new Request("https://example.test/api/explore/schedules?configOnly=1"))).status, 200);
  assert.equal((await h.handlers.GET(new Request(`https://example.test/api/explore/schedules?requestKey=${key}`))).status, 200);
  assert.equal((await h.handlers.GET(new Request(`https://example.test/api/explore/schedules?requestKey=${key}&requestKey=${key}`))).status, 400);
  assert.deepEqual(h.events, ["capability", "read"]); assert.equal(h.deferred.length, 0);
});
test("auth, plan, identity and streamed size failures cannot acknowledge or dispatch", async () => {
  for (const [options, request, status] of [[{ unauthenticated: true }, post(), 401], [{ noPlan: true }, post(), 403],
    [{}, post({}, { "Idempotency-Key": "different" }), 400], [{}, post({ requestKey: key, huge: "x".repeat(280_000) }), 413]]) {
    const h = routes(options); assert.equal((await h.handlers.POST(request)).status, status);
    assert.ok(!h.events.includes("committed") && !h.events.includes("dispatch"));
  }
  const existing = routes({ prior: true, noPlan: true });
  assert.equal((await existing.handlers.POST(post())).status, 202);
});

test("worker callback checks exact signed bytes, bounded streams and owner/request identity", async () => {
  const secret = "s".repeat(40), events = [], body = JSON.stringify({ userId: "owner-a", requestKey: key }), timestamp = String(Date.now());
  const handler = load("../app/api/internal/schedules/explore-finalize/route.ts", {
    "@/lib/scheduling/finalization-signature": signatures,
    "@/lib/scheduling/internal-finalization-auth": { verifyInternalFinalizationRequest: input => signatures.verifyScheduleFinalizationSignature({ ...input, secret }) },
    "@/lib/explore/pending-schedule-service": { reconcileExplorePendingSchedule: async (owner, requestKey) => { events.push([owner, requestKey]); return { inspected: 1, finalized: true }; } },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid },
  });
  const signed = content => new Request("https://example.test/api/internal/schedules/explore-finalize", { method: "POST", body: content,
    headers: { [signatures.INTERNAL_FINALIZATION_TIMESTAMP_HEADER]: timestamp,
      [signatures.INTERNAL_FINALIZATION_SIGNATURE_HEADER]: signatures.createScheduleFinalizationSignature({ body, timestamp, secret }) } });
  assert.equal((await handler.POST(signed(body + " "))).status, 401);
  assert.equal((await handler.POST(signed("x".repeat(4097)))).status, 413);
  assert.deepEqual(events, []);
  assert.equal((await handler.POST(signed(body))).status, 200); assert.deepEqual(events, [["owner-a", key]]);
});
