import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const calls = [];
let oidc = true;
let signature = false;
let job = { id: "source", userId: "owner", status: "completed" };
let claim = { sourceJobId: "source", userId: "owner" };
let outboxStatus = "completed";
let failure = false;
mock.module("../business-profiles/db.ts", { namedExports: { getMissingBusinessProfileEnvVars: () => [] } });
mock.module("../scheduling/internal-finalization-auth.ts", { namedExports: {
  getMissingInternalFinalizationEnvVars: () => [], verifyInternalFinalizationRequest: () => signature,
} });
mock.module("../scheduling/cloud-tasks-oidc-auth.ts", { namedExports: {
  verifyCloudTasksOidcRequest: async () => oidc,
} });
mock.module("../jobs/background-jobs.ts", { namedExports: {
  getBackgroundJobById: async () => job,
} });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  getMissingUnifiedTrendingFeedEnvVars: () => [],
  claimDueTrendingFeedReconciliations: async params => { calls.push(["claim", params]); return claim ? [claim] : []; },
  getTrendingFeedReconciliationStatus: async () => outboxStatus,
  completeTrendingFeedReconciliation: async params => { calls.push(["complete", params]); return true; },
  rescheduleTrendingFeedReconciliation: async params => { calls.push(["retry", params]); return true; },
} });
mock.module("./reconcile-completed-feed.ts", { namedExports: {
  reconcileCompletedTrendingFeedForUser: async owner => {
    calls.push(["reconcile", owner]);
    if (failure) throw new Error("Temporary database failure");
    return { feedId: "feed", skipped: false };
  },
} });
const { POST } = await import("../../app/api/internal/trending/reconcile/route.ts");
const request = (userId = "owner") => new Request("https://www.getugcpilot.com/api/internal/trending/reconcile", {
  method: "POST", body: JSON.stringify({ sourceJobId: "source", userId }),
});

test("independent delivery claims the owned terminal job before feed admission and acknowledgement", async () => {
  calls.length = 0;
  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(calls, [["claim", { sourceJobId: "source", limit: 1 }], ["reconcile", "owner"], ["complete", { sourceJobId: "source" }]]);
});
test("unsigned, foreign-owner and nonterminal deliveries cannot reconcile", async () => {
  calls.length = 0; oidc = false;
  assert.equal((await POST(request())).status, 401);
  oidc = true;
  assert.equal((await POST(request("foreign"))).status, 403);
  job.status = "processing";
  assert.equal((await POST(request())).status, 403);
  job.status = "completed";
  assert.deepEqual(calls, []);
});
test("busy or deferred outbox deliveries retry; completed or absent rows acknowledge safely", async () => {
  claim = null;
  try {
    for (const status of ["pending", "processing"]) {
      outboxStatus = status;
      assert.equal((await POST(request())).status, 503);
    }
    for (const status of ["completed", null]) {
      outboxStatus = status;
      assert.equal((await POST(request())).status, 200);
    }
  } finally { claim = { sourceJobId: "source", userId: "owner" }; }
});
test("temporary admission failure retains durable retry instead of acknowledging unfinished work", async () => {
  calls.length = 0; failure = true;
  const logger = mock.method(console, "error", () => {});
  try {
    assert.equal((await POST(request())).status, 500);
    assert.deepEqual(calls.at(-1), ["retry", { sourceJobId: "source", message: "Temporary database failure" }]);
    assert.ok(!calls.some(([name]) => name === "complete"));
  } finally { failure = false; logger.mock.restore(); }
});
test("legacy signed worker callbacks remain compatible", async () => {
  calls.length = 0; signature = true; oidc = false;
  try {
    assert.equal((await POST(request())).status, 200);
    assert.deepEqual(calls, [["reconcile", "owner"]]);
  } finally { signature = false; oidc = true; }
});
