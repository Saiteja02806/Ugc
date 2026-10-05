import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const load = (file, imports = {}, globals = {}) => {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals,
  });
  return exported;
};
const backend = load("lib/ai-studio/generation-settings.ts", {}, { process: { env: {} } });
const settings = load("lib/explore/workflow-generation-settings.ts", { "../ai-studio/generation-settings": backend }, { process: { env: {} } });
const client = load("lib/explore/workflow-generation-client.ts", {
  "../ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts"), "./workflow-generation-settings": settings,
});
const key = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const videoId = "33333333-3333-4333-8333-333333333333";
const batch = { ok: true, receiptVersion: 2, requestKey: key, kind: "hook", quantity: 1, outcome: "accepted", jobId, jobs: [{ jobId, videoId }], message: "Started", partial: false };
const response = (body, status = 200) => Response.json(body, { status });
const draft = (kind = "hook") => ({ kind, instructions: "A creator explains a useful app.", settings: settings.createWorkflowGenerationSettings(), creator: null, videoReference: null, audioReference: null });
const storage = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
const create = (store, fetch, overrides = {}) => client.createWorkflowGenerationClient({
  fetch, getOwnerToken: async () => "fixture-token", uploadImage: async () => { throw new Error("unexpected upload"); }, createIdempotencyKey: () => key, assertActive() {},
  recovery: { ownerId: "owner-a", kind: "hook", storage: () => store, onChange() {}, withLock: async (work) => work() }, ...overrides,
});
const recover = (store, fetch, overrides = {}) => client.recoverWorkflowGenerationRequest({ storage: store, ownerId: "owner-a", kind: "hook", getOwnerToken: async () => "fixture-token", fetch, assertActive() {}, ...overrides });

test("identity is persisted before POST; confirmed job IDs are persisted before its removal", async () => {
  const store = storage();
  const originalRemove = store.removeItem;
  store.removeItem = (key) => { assert.deepEqual(Array.from(client.readWorkflowGenerationJobs(store, "owner-a", "hook")), [jobId]); originalRemove(key); };
  await create(store, async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").requestKey, key);
    assert.doesNotMatch([...store.values.values()].join(""), /fixture-token|prompt|instructions|blob:|http/);
    return response(batch, 202);
  }).generate(draft());
  assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook"), null);
});

test("lost acknowledgement survives a recreated client; a changed draft cannot submit", async () => {
  const store = storage(); let posts = 0;
  await assert.rejects(create(store, async () => { posts++; throw new Error("lost acknowledgement"); }).generate(draft()), /lost acknowledgement/);
  const recreated = create(store, async () => { posts++; return response(batch); });
  await assert.rejects(recreated.generate({ ...draft(), instructions: "Different instructions" }), /previous request is not confirmed/);
  assert.equal(posts, 1);
  let gets = 0;
  const result = await recover(store, async (url, init) => {
    assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store"); assert.equal(init.body, undefined);
    assert.ok(url.includes(`requestKey=${key}`)); gets++;
    return response({ ...batch, requestKey: key, resolved: true });
  });
  assert.equal(result.resolved, true); assert.equal(gets, 1); assert.equal(posts, 1);
  assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook"), null);
  assert.deepEqual(Array.from(client.readWorkflowGenerationJobs(store, "owner-a", "hook")), [jobId]);
});

test("missing and partial jobs retain the marker and never invoke a POST", async () => {
  for (const jobs of [[], batch.jobs]) {
    const store = storage();
    store.setItem(client.workflowGenerationRequestStorageKey("owner-a", "hook"), JSON.stringify({ version: 1, ownerId: "owner-a", kind: "hook", requestKey: key, quantity: 2 }));
    const result = await recover(store, async (_url, init) => { assert.equal(init.method, "GET"); return response({ ok: true, requestKey: key, jobs, resolved: false }); });
    assert.equal(result.resolved, false);
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").requestKey, key);
  }
});

test("corrupt, oversized and foreign-owner markers fail closed instead of being discarded", async () => {
  for (const raw of ["broken JSON", "x".repeat(1025), JSON.stringify({ version: 1, ownerId: "owner-b", kind: "hook", requestKey: key, quantity: 1 }), JSON.stringify({ version: 1, ownerId: "owner-a", kind: "hook", requestKey: key, quantity: "1" })]) {
    const store = storage(); store.setItem(client.workflowGenerationRequestStorageKey("owner-a", "hook"), raw);
    let calls = 0;
    await assert.rejects(create(store, async () => { calls++; }).generate(draft()), /cannot be verified/);
    await assert.rejects(recover(store, async () => { calls++; }), /cannot be verified/);
    assert.equal(calls, 0); assert.equal(store.getItem(client.workflowGenerationRequestStorageKey("owner-a", "hook")), raw);
  }
});

test("storage failures before submission block spending; ACK storage failure retains the marker", async () => {
  let calls = 0;
  const store = storage(); store.setItem = () => { throw new Error("storage blocked"); };
  await assert.rejects(create(store, async () => { calls++; }).generate(draft()), /storage blocked/);
  assert.equal(calls, 0);
  const ackStore = storage(), set = ackStore.setItem;
  ackStore.setItem = (name, value) => { if (name.includes(".generation.")) throw new Error("full"); set(name, value); };
  await assert.rejects(create(ackStore, async () => response(batch)).generate(draft()), /browser recovery could not be confirmed/);
  assert.equal(client.readWorkflowGenerationRequest(ackStore, "owner-a", "hook").requestKey, key);
});

test("request identities are isolated by account and workflow", async () => {
  const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
  assert.equal(client.readWorkflowGenerationRequest(store, "owner-b", "hook"), null);
  assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "phone"), null);
  let calls = 0;
  const result = await recover(store, async () => { calls++; }, { ownerId: "owner-b" });
  assert.equal(result.resolved, true); assert.equal(calls, 0);
  await assert.rejects(create(storage(), async () => { calls++; }).generate(draft("phone")), /correct workflow/);
});

test("malformed recovery, changed identities and lost sign-in cannot clear a marker", async () => {
  for (const body of [null, { ...batch, requestKey: "wrong", resolved: true }, { ...batch, requestKey: key, resolved: "true" }, { ok: true, requestKey: key, jobs: [], resolved: true }]) {
    const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
    await assert.rejects(recover(store, async () => response(body)));
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").requestKey, key);
  }
  const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
  await assert.rejects(recover(store, async () => { throw new Error("must not fetch"); }, { getOwnerToken: async () => null }), /Sign in/);
});

test("a second tab is stopped by the lock or by the shared pending identity", async () => {
  const store = storage(); let unlock; let calls = 0;
  const first = create(store, async () => { calls++; return new Promise((resolve) => { unlock = () => resolve(response(batch)); }); }).generate(draft());
  await new Promise(setImmediate);
  await assert.rejects(create(store, async () => { calls++; }).generate(draft()), /previous request is not confirmed/);
  assert.equal(calls, 1); unlock(); await first;
  await assert.rejects(create(store, async () => { calls++; }, { recovery: { withLock: async () => { throw new Error("another tab owns the lock"); } } }).generate(draft()), /another tab/);
  assert.equal(calls, 1);
});

test("atomic submission verifies the entire receipt before clearing the pending marker", async () => {
  for (const changes of [{ receiptVersion: 1 }, { kind: "phone" }, { quantity: 2 }, { requestKey: "44444444-4444-4444-8444-444444444444" },
    { outcome: "not_started" }, { partial: true }, { jobs: [{ jobId: "opaque-job", videoId }] }]) {
    const store = storage();
    await assert.rejects(create(store, async () => response({ ...batch, ...changes })).generate(draft()), /could not be verified/);
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").requestKey, key);
    assert.deepEqual(Array.from(client.readWorkflowGenerationJobs(store, "owner-a", "hook")), []);
  }
});

test("mutated browser receipts cannot change the captured quantity or acknowledge an incomplete atomic batch", async () => {
  const store = storage(); const set = store.setItem;
  store.setItem = (name, raw) => set(name, JSON.stringify({ ...JSON.parse(raw), quantity: 2 }));
  let calls = 0;
  await assert.rejects(create(store, async () => { calls++; return response(batch); }).generate(draft()), /Could not save request recovery/);
  assert.equal(calls, 0);
  const incomplete = storage(); client.persistWorkflowGenerationRequest(incomplete, "owner-a", "hook", key, 2);
  assert.throws(() => client.acknowledgeWorkflowGenerationRequest(incomplete, "owner-a", "hook", key, { jobs: batch.jobs, partial: false, message: "" }), /complete saved request/);
  assert.equal(client.readWorkflowGenerationRequest(incomplete, "owner-a", "hook").quantity, 2);
});

const unreceived = { ok: true, requestKey: key, jobs: [], resolved: false, canResolve: true };
const notStarted = { ...batch, jobs: [], outcome: "not_started", resolved: true };
test("automatic atomic recovery is read-only; explicit resolution removes only a verified no-start receipt", async () => {
  const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
  let calls = [];
  const fetch = async (_url, init) => { calls.push(init.method); return response(init.method === "GET" ? unreceived : notStarted); };
  assert.equal((await recover(store, fetch)).resolved, false);
  assert.deepEqual(calls, ["GET"]);
  assert.equal((await recover(store, fetch, { resolveUnreceived: true })).resolved, true);
  assert.deepEqual(calls, ["GET", "GET", "POST"]);
  assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook"), null);
});

test("explicit resolution recovers a batch that commits after the lookup, without submitting generation", async () => {
  const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
  const calls = [];
  const result = await recover(store, async (_url, init) => { calls.push(init.method); return response(init.method === "GET" ? unreceived : { ...batch, resolved: true }); }, { resolveUnreceived: true });
  assert.equal(result.resolved, true); assert.deepEqual(calls, ["GET", "POST"]);
  assert.deepEqual(Array.from(client.readWorkflowGenerationJobs(store, "owner-a", "hook")), [jobId]);
});

test("explicit resolution cannot write an old identity after another tab changes it", async () => {
  for (const when of ["lookup", "token"]) {
    const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
    let tokens = 0; const methods = [];
    const changeMarker = () => store.setItem(client.workflowGenerationRequestStorageKey("owner-a", "hook"), JSON.stringify({ version: 2, ownerId: "owner-a", kind: "hook", requestKey: key, quantity: 2 }));
    await assert.rejects(recover(store, async (_url, init) => { methods.push(init.method); if (when === "lookup") changeMarker(); return response(unreceived); }, {
      resolveUnreceived: true, getOwnerToken: async () => { if (++tokens === 2 && when === "token") changeMarker(); return "fixture-token"; },
    }), /changed in another tab/);
    assert.deepEqual(methods, ["GET"]);
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").quantity, 2);
  }
});

test("atomic recovery rejects partial, mismatched and duplicate output receipts without discarding identity", async () => {
  for (const changes of [{ kind: "phone" }, { quantity: 2 }, { receiptVersion: 1 }, { outcome: "not_started" }, { resolved: false }, { partial: true },
    { jobs: [{ jobId: "unsafe", videoId }] }, { jobs: [], outcome: "not_started", quantity: 2 }]) {
    const store = storage(); client.persistWorkflowGenerationRequest(store, "owner-a", "hook", key, 1);
    await assert.rejects(recover(store, async () => response({ ...batch, resolved: true, ...changes })));
    assert.equal(client.readWorkflowGenerationRequest(store, "owner-a", "hook").requestKey, key);
  }
  assert.throws(() => client.parseWorkflowGenerationBatch({ ...batch, jobs: [{ jobId, videoId }, { jobId: key, videoId }] }, 2), /could not be confirmed/);
});

class AuthError extends Error { status = 401; }
function apiHarness({ ownerId = "owner-a", record, fail = false, signedIn = true } = {}) {
  const reads = [];
  const api = load("lib/explore/workflow-generation-recovery-api.ts", {
    "server-only": {}, "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in"); return { uid: ownerId }; } },
    "@/lib/jobs/background-jobs": { getBackgroundJobForUser: async () => null, getBackgroundJobByIdempotencyKey: async (key, scope) => { reads.push({ key, scope }); if (fail) throw new Error("DB unavailable"); return typeof record === "function" ? record(key, scope) : record ?? null; } },
    "./workflow-generation-receipts": { readWorkflowGenerationReceipt: async () => null, resolveWorkflowGenerationReceipt: async () => { throw new Error("unexpected resolution"); } },
  }, { Response, URL });
  return { reads, invoke: (query = `requestKey=${key}&quantity=1`) => api.handleWorkflowGenerationRecovery(new Request(`https://www.getugcpilot.com/api/ai-studio/videos/recover?${query}`)) };
}
const savedJob = (overrides = {}) => ({ id: jobId, userId: "owner-a", jobType: "generate_hook_video", projectId: "ai-studio", input: { batchSize: 1, batchIndex: 1, videoId }, ...overrides });

test("actual recovery handler reads only the authenticated owner's generation jobs and returns IDs only", async () => {
  const actual = apiHarness({ record: savedJob({ input: { batchSize: 1, batchIndex: 1, videoId, hookIdea: "private prompt", secret: "not returned" } }) });
  const response = await actual.invoke(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(JSON.parse(JSON.stringify(actual.reads)), [{ key, scope: { userId: "owner-a", jobType: "generate_hook_video" } }]);
  assert.equal(body.resolved, true); assert.deepEqual(body.jobs, batch.jobs);
  assert.doesNotMatch(JSON.stringify(body), /private prompt|secret|input|userId/);
});

test("actual recovery handler authenticates and validates before any database access", async () => {
  const out = apiHarness({ signedIn: false }); assert.equal((await out.invoke()).status, 401); assert.equal(out.reads.length, 0);
  const invalid = apiHarness();
  for (const query of ["requestKey=bad&quantity=1", `requestKey=${key}&quantity=3`, `requestKey=${key}`]) assert.equal((await invalid.invoke(query)).status, 400);
  assert.equal(invalid.reads.length, 0);
});

test("actual recovery handler rejects foreign, malformed and mismatched batch records", async () => {
  for (const record of [savedJob({ userId: "owner-b" }), savedJob({ jobType: "generate_image" }), savedJob({ projectId: "other" }), savedJob({ input: { batchSize: 2, batchIndex: 1, videoId } }), savedJob({ input: { batchSize: 1, batchIndex: 1, videoId: "unsafe" } })]) {
    assert.equal((await apiHarness({ record }).invoke()).status, 409);
  }
  assert.equal((await apiHarness({ fail: true }).invoke()).status, 503);
});

test("actual recovery handler derives the exact existing child identities, without creating missing children", async () => {
  const actual = apiHarness({ record: (child) => child.endsWith(":1") ? savedJob({ input: { batchSize: 4, batchIndex: 1, videoId } }) : null });
  const body = await (await actual.invoke(`requestKey=${key}&quantity=4`)).json();
  assert.equal(body.resolved, false); assert.equal(body.jobs.length, 1);
  assert.deepEqual(actual.reads.map((item) => item.key), [1, 2, 3, 4].map((index) => `${key}:${index}`));
  assert.doesNotMatch(read("lib/explore/workflow-generation-recovery-api.ts"), /reserveBilling|createAndDispatch|retry\(/);
});
