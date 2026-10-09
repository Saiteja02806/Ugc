import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const key = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const videoId = "33333333-3333-4333-8333-333333333333";
const owner = "owner-a";
const batch = { userId: owner, requestKey: key, amountPerVideo: 4, inputs: [{ userId: owner, projectId: "ai-studio", promptMode: "direct", batchIndex: 1, batchSize: 1, videoId, hookIdea: "An original hook." }] };
const receipt = { requestKey: key, kind: "hook", quantity: 1, outcome: "accepted", jobIds: [jobId] };
const job = () => ({ id: jobId, userId: owner, jobType: "generate_hook_video", projectId: "ai-studio", idempotencyKey: `explore:${key}:1`, input: { ...batch.inputs[0], workflowRequestKey: key, workflowKind: "hook" } });
class AuthError extends Error { status = 401; }

function recoveryHarness({ record = job(), savedReceipt = receipt, error, signedIn = true } = {}) {
  const reads = [], resolutions = [], jobReads = [];
  const api = load("lib/explore/workflow-generation-recovery-api.ts", {
    "server-only": {},
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in"); return { uid: owner }; } },
    "@/lib/jobs/background-jobs": {
      getBackgroundJobForUser: async args => { jobReads.push(args); return record; },
      getBackgroundJobByIdempotencyKey: async () => { throw new Error("Legacy lookup not allowed for v2"); },
    },
    "./workflow-generation-receipts": {
      readWorkflowGenerationReceipt: async (...args) => { reads.push(args); if (error) throw error; return savedReceipt; },
      resolveWorkflowGenerationReceipt: async (...args) => { resolutions.push(args); if (error) throw error; return savedReceipt; },
    },
  }, { Response, URL });
  return { reads, resolutions, jobReads, invoke: (method = "GET", query = `requestKey=${key}&quantity=1&kind=hook&receipt=2`, body = { action: "resolve" }) => {
    const request = new Request(`https://www.getugcpilot.com/api/ai-studio/videos/recover?${query}`, method === "POST" ? { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {});
    return method === "GET" ? api.handleWorkflowGenerationRecovery(request) : api.handleWorkflowGenerationResolution(request);
  } };
}

test("atomic GET authenticates owner, verifies saved jobs and returns opaque IDs only", async () => {
  const h = recoveryHarness(); const response = await h.invoke(), body = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.outcome, "accepted"); assert.equal(body.quantity, 1); assert.equal(body.receiptVersion, 2);
  assert.deepEqual(plain(h.reads), [[owner, key]]); assert.deepEqual(plain(h.jobReads), [{ jobId, userId: owner }]);
  assert.deepEqual(body.jobs, [{ jobId, videoId }]); assert.equal(h.resolutions.length, 0);
  assert.doesNotMatch(JSON.stringify(body), /original hook|input|userId|fingerprint/);
});

test("missing receipt is never treated as proof of failure; GET is read-only", async () => {
  const h = recoveryHarness({ savedReceipt: null }); const body = await (await h.invoke()).json();
  assert.equal(body.resolved, false); assert.equal(body.canResolve, true); assert.deepEqual(body.jobs, []);
  assert.equal(h.resolutions.length, 0); assert.equal(h.jobReads.length, 0);
});

test("explicit POST only resolves the authenticated identity, with no-start or already accepted outcomes", async () => {
  for (const savedReceipt of [receipt, { ...receipt, outcome: "not_started", jobIds: [] }]) {
    const h = recoveryHarness({ savedReceipt }); const response = await h.invoke("POST"), body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.resolved, true); assert.equal(body.outcome, savedReceipt.outcome);
    assert.deepEqual(plain(h.resolutions), [[owner, key, "hook", 1]]); assert.equal(h.reads.length, 0);
  }
});

test("authentication, malformed identity and failed storage never acknowledge or dispatch", async () => {
  const h = recoveryHarness({ signedIn: false }); assert.equal((await h.invoke()).status, 401); assert.equal((await h.invoke("POST")).status, 401);
  assert.equal(h.reads.length + h.resolutions.length, 0);
  const invalid = recoveryHarness();
  for (const query of [`requestKey=${key}&quantity=1&kind=other&receipt=2`, `requestKey=bad&quantity=1&kind=hook&receipt=2`, `requestKey=${key}&quantity=3&kind=hook&receipt=2`]) {
    assert.equal((await invalid.invoke("GET", query)).status, 400); assert.equal((await invalid.invoke("POST", query)).status, 400);
  }
  assert.equal((await invalid.invoke("POST", undefined, { action: "start" })).status, 400);
  assert.equal(invalid.reads.length + invalid.resolutions.length, 0);
  const failed = recoveryHarness({ error: new Error("DB unavailable") });
  assert.equal((await failed.invoke()).status, 503); assert.equal((await failed.invoke("POST")).status, 503);
});

test("atomic recovery rejects foreign, reordered, wrong-namespace and mismatched jobs", async () => {
  for (const record of [null, { ...job(), id: key }, { ...job(), userId: "owner-b" }, { ...job(), projectId: "other" },
    { ...job(), idempotencyKey: key }, { ...job(), jobType: "generate_image" }, ...[
      { userId: "owner-b" }, { projectId: "other" }, { promptMode: "template" }, { workflowKind: "phone" },
      { workflowRequestKey: videoId }, { batchSize: 2 }, { batchIndex: 2 }, { videoId: "unsafe" },
    ].map(change => ({ ...job(), input: { ...job().input, ...change } }))]) {
    assert.equal((await recoveryHarness({ record }).invoke()).status, 409);
  }
  for (const savedReceipt of [{ ...receipt, kind: "phone" }, { ...receipt, quantity: 2 }]) assert.equal((await recoveryHarness({ savedReceipt }).invoke()).status, 409);
});

function creationHarness(changeRaw = row => row, changeRead = row => row, failure = null) {
  let committed; const calls = [];
  const api = load("lib/explore/workflow-generation-receipts.ts", {
    "server-only": {}, "node:crypto": { createHash },
    "@supabase/supabase-js": { createClient: () => ({ rpc: async (name, args) => {
      calls.push({ name, args }); committed = { ...job(), input: plain(args.p_inputs_json[0]) };
      return failure ? { data: null, error: { message: failure } } : { data: { created: true, jobs: [changeRaw({ id: jobId, user_id: owner, job_type: committed.jobType, project_id: committed.projectId, idempotency_key: committed.idempotencyKey, input_json: committed.input })] }, error: null };
    } }) },
    "@/lib/jobs/background-jobs": { getBackgroundJobForUser: async args => { assert.deepEqual(plain(args), { jobId, userId: owner }); return changeRead(committed); } },
  }, { process: { env: { SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-only" } } });
  return { api, calls, invoke: () => api.createWorkflowGenerationBatch(batch, "hook") };
}

test("atomic creator calls only the reviewed RPC with owner, cost and every validated input", async () => {
  const h = creationHarness(); const saved = await h.invoke();
  assert.equal(saved.length, 1); assert.equal(saved[0].id, jobId);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].name, "explore_create_reserved_generation_batch");
  assert.equal(h.calls[0].args.p_user_id, owner); assert.equal(h.calls[0].args.p_amount_per_video, 4);
  assert.equal(h.calls[0].args.p_inputs_json[0].workflowKind, "hook");
  assert.equal(h.api.fingerprintWorkflowGenerationBatch(batch, "hook"), h.api.fingerprintWorkflowGenerationBatch({ ...batch, inputs: [{ ...batch.inputs[0], videoId: key }] }, "hook"));
  assert.notEqual(h.api.fingerprintWorkflowGenerationBatch(batch, "hook"), h.api.fingerprintWorkflowGenerationBatch({ ...batch, amountPerVideo: 5 }, "hook"));
});

test("creator rejects inconsistent RPC rows and post-commit reads instead of dispatching unverified jobs", async () => {
  for (const change of [{ idempotency_key: "legacy" }, { user_id: "other" }, { project_id: "other" }, { job_type: "generate_image" }]) {
    await assert.rejects(creationHarness(row => ({ ...row, ...change })).invoke(), /could not be verified/);
  }
  for (const change of [{ userId: "other" }, { projectId: "other" }, { promptMode: "template" }, { batchIndex: 2 }, { batchSize: 2 }, { workflowKind: "phone" }, { workflowRequestKey: videoId }]) {
    await assert.rejects(creationHarness(row => ({ ...row, input_json: { ...row.input_json, ...change } })).invoke(), /could not be verified/);
    await assert.rejects(creationHarness(undefined, row => ({ ...row, input: { ...row.input, ...change } })).invoke(), /Could not confirm/);
  }
  await assert.rejects(creationHarness(undefined, row => ({ ...row, userId: "other" })).invoke(), /Could not confirm/);
  await assert.rejects(creationHarness(undefined, row => ({ ...row, input: { ...row.input, videoId: key } })).invoke(), /Could not confirm/);
});

test("credit, identity and database errors return bounded actionable messages", async () => {
  for (const [error, status] of [["insufficient_billing_credits", 403], ["paid_subscription_required", 403], ["request_closed", 409], ["idempotency_conflict", 409], ["database unavailable", 503]]) {
    await assert.rejects(creationHarness(undefined, undefined, error).invoke(), e => e.status === status);
  }
});

function startHarness({ enabled = true, failCreate = false, validationStatus = null } = {}) {
  const starts = [], dispatches = [], delegates = [];
  class ReceiptError extends Error { status = 409; }
  const api = load("lib/explore/workflow-generation-start-api.ts", {
    "server-only": {}, "./workflow-generation-receipts": { WorkflowGenerationReceiptError: ReceiptError, createWorkflowGenerationBatch: async (...args) => { starts.push(args); if (failCreate) throw new ReceiptError("Conflict"); return [job()]; } },
    "@/lib/jobs/background-job-service": { dispatchQueuedBackgroundJobForRecovery: async value => { dispatches.push(value); return value; } },
    "@/lib/ai-studio/video-generation-api": { handleAIStudioVideoGeneration: async (_request, options) => { delegates.push(true); return validationStatus ? Response.json({ ok: false }, { status: validationStatus }) : options.startBatch(batch); } },
  }, { Response, process: { env: { NODE_ENV: "production", EXPLORE_GENERATION_ENABLED: enabled ? "true" : "false" } } });
  return { starts, dispatches, delegates, invoke: (changes = {}, header = key) => api.handleWorkflowGenerationStart(new Request("https://www.getugcpilot.com/api/ai-studio/videos/workflow-start", {
    method: "POST", headers: { "Idempotency-Key": header, "Content-Type": "application/json" }, body: JSON.stringify({ workflowKind: "hook", quantity: 1, idempotencyKey: key, ...changes }),
  })) };
}

test("start remains gated, identity-validated and behind the existing generation validation", async () => {
  const disabled = startHarness({ enabled: false }); assert.equal((await disabled.invoke()).status, 503); assert.equal(disabled.delegates.length, 0);
  const invalid = startHarness();
  for (const change of [{ workflowKind: "other" }, { quantity: 3 }, { idempotencyKey: "invalid" }]) assert.equal((await invalid.invoke(change)).status, 400);
  assert.equal((await invalid.invoke({}, videoId)).status, 400); assert.equal(invalid.delegates.length, 0);
  for (const status of [401, 403, 400, 503]) {
    const h = startHarness({ validationStatus: status }); const response = await h.invoke();
    assert.equal(response.status, status); assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.equal(h.starts.length + h.dispatches.length, 0);
  }
});

test("start dispatches only verified committed jobs and returns a complete atomic receipt", async () => {
  const h = startHarness(); const response = await h.invoke(), body = await response.json();
  assert.equal(response.status, 202); assert.equal(body.receiptVersion, 2); assert.equal(body.requestKey, key); assert.equal(body.quantity, 1);
  assert.equal(body.kind, "hook"); assert.equal(body.outcome, "accepted"); assert.equal(body.partial, false);
  assert.deepEqual(body.jobs, [{ jobId, videoId }]); assert.equal(h.starts.length, 1); assert.equal(h.dispatches.length, 1);
  const failed = startHarness({ failCreate: true }); assert.equal((await failed.invoke()).status, 409); assert.equal(failed.dispatches.length, 0);
});
