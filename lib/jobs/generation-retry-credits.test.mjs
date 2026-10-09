import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

process.env.SUPABASE_URL = "https://retry-credits-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture";
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
let authFailure = false, rpcFailure = null, queueFailure = false;
let row, dispatchCalls = 0, patches = [], rpcCalls = [];
const id = "11111111-1111-4111-8111-111111111111";
mock.module("../../lib/firebase/server-auth.ts", {
  namedExports: { requireFirebaseUser: async () => {
    if (authFailure) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    return { uid: "owner" };
  } },
});
mock.module("../../lib/jobs/gcp-cloud-tasks.ts", {
  namedExports: {
    getMissingBackgroundJobCloudTasksEnvVars: () => [],
    enqueueBackgroundJobCloudTask: async () => {
      dispatchCalls += 1;
      if (queueFailure) throw new Error("Queue unavailable");
      return { messageId: "fixture-task" };
    },
  },
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.hostname, "retry-credits-fixture.invalid", "No live requests are permitted");
  const method = init?.method ?? input.method ?? "GET";
  if (url.pathname.endsWith("/rpc/retry_background_job")) {
    rpcCalls.push(JSON.parse(init.body));
    if (rpcFailure) return response({ message: rpcFailure, code: "P0001" }, 400);
    row = { ...row, status: "queued", stage: "queued", error_code: null, error_message: null };
    return response([row]);
  }
  assert.ok(url.pathname.endsWith("/background_jobs"));
  if (method === "PATCH") {
    const patch = JSON.parse(init.body);
    patches.push(patch); row = { ...row, ...patch };
  }
  return response(row);
};
const { POST } = await import("../../app/api/jobs/[jobId]/retry/route.ts");
const { retryBackgroundJob } = await import("../../lib/jobs/background-jobs.ts");
const { BillingAccessError } = await import("../../lib/billing/subscription-db.ts");
function reset() {
  authFailure = false; rpcFailure = null; queueFailure = false;
  dispatchCalls = 0; patches = []; rpcCalls = [];
  row = {
    id, user_id: "owner", idempotency_key: "original-generation", job_type: "generate_image",
    status: "failed", stage: "failed", error_code: "OUTPUT_UPLOAD_FAILED", error_message: "Upload unavailable",
    attempt_count: 1, max_attempts: 3, input_json: {}, output_json: null,
    queue_name: "image", queue_provider: "gcp", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}
const request = () => POST(new Request(`https://example.com/api/jobs/${id}/retry`, { method: "POST" }), { params: Promise.resolve({ jobId: id }) });

test("real retry RPC maps exhausted credits to a 402 without dispatch or a misleading sign-in message", async () => {
  reset(); rpcFailure = "insufficient_billing_credits";
  const result = await request();
  assert.equal(result.status, 402);
  assert.match((await result.json()).error, /enough AI credits/u);
  assert.equal(dispatchCalls, 0); assert.equal(patches.length, 0);
  assert.deepEqual(rpcCalls, [{ p_job_id: id, p_user_id: "owner" }]);
  assert.equal(row.status, "failed");
});

test("inactive paid or revoked complimentary source returns a billing action as 402", async () => {
  for (const failure of ["paid_subscription_required", "complimentary_generation_access_required"]) {
    reset(); rpcFailure = failure;
    const result = await request();
    assert.equal(result.status, 402);
    const body = await result.json();
    assert.match(body.error, /Update billing/u); assert.doesNotMatch(body.error, /Sign in/u);
    assert.equal(dispatchCalls, 0);
  }
});

test("committed or mismatched reservations fail with 409 and missing ledgers fail with 503", async () => {
  for (const [failure, status] of [
    ["billing_retry_already_committed", 409], ["billing_retry_reservation_conflict", 409],
    ["free_generation_credit_balance_missing", 503], ["complimentary_credit_balance_missing", 503],
  ]) {
    reset(); rpcFailure = failure;
    await assert.rejects(retryBackgroundJob({ jobId: id, userId: "owner" }), (error) => error instanceof BillingAccessError && error.status === status);
    const result = await request();
    assert.equal(result.status, status); assert.doesNotMatch((await result.json()).error, /Sign in/u);
    assert.equal(dispatchCalls, 0);
  }
});

test("funded retry keeps the existing 202 response and dispatches the same job", async () => {
  reset();
  const result = await request();
  assert.equal(result.status, 202);
  const body = await result.json();
  assert.equal(body.ok, true); assert.equal(body.job.id, id); assert.equal(body.job.status, "queued");
  assert.equal(dispatchCalls, 1); assert.equal(row.queue_message_id, "fixture-task");
});

test("failed dispatch marks the retried job failed so the SQL settlement trigger refunds its reservation", async () => {
  reset(); queueFailure = true;
  const errorLog = mock.method(console, "error", () => {});
  try {
    const result = await request();
    assert.equal(result.status, 409); assert.equal(dispatchCalls, 1);
    assert.equal(row.status, "failed"); assert.equal(row.error_code, "QUEUE_DELIVERY_FAILED");
    assert.equal(row.attempt_count, 2);
    assert.equal(patches.filter((patch) => patch.status === "failed").length, 1);
  } finally { errorLog.mock.restore(); }
});

test("unauthenticated retries retain the 401 response and do not access billing", async () => {
  reset(); authFailure = true;
  const result = await request();
  assert.equal(result.status, 401); assert.match((await result.json()).error, /Sign in/u);
  assert.equal(rpcCalls.length, 0); assert.equal(dispatchCalls, 0);
});
