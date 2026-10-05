import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const contract = load("worker/src/lib/explore-finishing-contract.ts");
const key = "11111111-1111-4111-8111-111111111111", jobId = "22222222-2222-4222-8222-222222222222";
const outputId = "33333333-3333-4333-8333-333333333333", sourceId = "44444444-4444-4444-8444-444444444444", owner = "owner-a";
const providerKey = "elevenlabs:scribe_v2:auto:en:word:v1";
const baseDraft = { version: 1, kind: "hook", sourceAssetId: sourceId, demoAssetId: null, demoAudioAssetId: null,
  demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: { language: "en", style: "clean", placement: "bottom" } };
class AuthError extends Error { constructor(message = "Sign in", status = 401) { super(message); this.status = status; } }

function harness(options = {}) {
  const calls = [], env = { EXPLORE_FINISHING_ENABLED: "true", EXPLORE_FINISHING_SUBTITLES_ENABLED: "true", ...options.env };
  let receipt, committed, record;
  const api = load("lib/explore/workflow-finishing-api.ts", {
    "server-only": {}, "node:crypto": { createHash },
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { calls.push("access"); if (options.authError) throw options.authError; return { uid: owner }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { calls.push("auth"); if (options.authError) throw options.authError; return { uid: owner }; } },
    "@/lib/jobs/background-jobs": {
      getMissingBackgroundJobStorageEnvVars: () => options.missingStorage ? ["private-env-name"] : [],
      getBackgroundJobForUser: async args => { calls.push("job"); assert.deepEqual(JSON.parse(JSON.stringify(args)), { jobId, userId: owner }); return options.changeJob ? options.changeJob(record) : record; },
    },
    "@/lib/jobs/background-job-service": { dispatchQueuedBackgroundJobForRecovery: async job => { calls.push("dispatch"); assert.equal(job, record); return options.dispatchResult ?? job; } },
    "@/lib/queues/job-queue": { getMissingJobQueueEnvVars: types => { assert.deepEqual(Array.from(types), ["render_demo_video"]); return options.missingQueue ? ["private-queue-env"] : []; } },
    "@/worker/src/lib/explore-finishing-contract": contract,
    "@/worker/src/subtitles/elevenlabs-contract": { SCRIBE_PROVIDER_KEY: providerKey },
    "./workflow-finishing-store": { ExploreFinishingRequestStore: class {
      async read(uid, requestKey) { calls.push("read"); assert.equal(uid, owner); assert.equal(requestKey, key); if (options.readError) throw options.readError; return options.prior ? receipt : committed ?? null; }
      async create(uid, requestKey, fingerprint, draft) { calls.push("create"); assert.equal(uid, owner); assert.equal(requestKey, key); assert.equal(fingerprint, receipt.fingerprint); assert.deepEqual(JSON.parse(JSON.stringify(draft)), receipt.draft); if (options.createError) throw options.createError; committed = receipt; return receipt; }
      async asset(uid, assetId, type) { calls.push("asset"); assert.equal(uid, owner); assert.equal(assetId, outputId); assert.equal(type, "video"); if (options.assetError) throw options.assetError; return { id: outputId }; }
    } },
  }, { Response, URL, Buffer, process: { env } });
  const draft = { ...baseDraft, ...options.draftChanges };
  receipt = { user_id: owner, request_key: key, job_id: jobId, output_asset_id: outputId, status: options.receiptStatus ?? "queued",
    fingerprint: api.fingerprintExploreFinish(contract.parseExploreFinishDraft(draft)), draft };
  record = { id: jobId, userId: owner, jobType: "render_demo_video", projectId: "explore", idempotencyKey: `explore-finish:${key}`,
    input: { version: 1, userId: owner, requestKey: key, fingerprint: receipt.fingerprint, outputAssetId: outputId },
    status: options.jobStatus ?? "queued", progress: options.progress ?? 35, errorCode: options.errorCode ?? null,
    errorMessage: "private-provider-details", output: { url: "https://private.example/video", storageKey: "private-storage-key" } };
  const start = (body = { requestKey: key, draft }, headers = {}) => api.handleWorkflowFinishingStart(new Request("https://www.getugcpilot.com/api/explore/finishes", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  return { api, receipt, record, calls, env, start, status: (query = `requestKey=${key}`) => api.handleWorkflowFinishingStatus(new Request(`https://www.getugcpilot.com/api/explore/finishes?${query}`)) };
}

test("queues only a verified committed owned job and acknowledges opaque identities, without exposing raw input/output", async () => {
  const h = harness(), response = await h.start(), body = await response.json();
  assert.equal(response.status, 202); assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.equal(response.headers.get("Vary"), "Authorization");
  assert.equal(body.outcome, "pending"); assert.equal(body.jobId, jobId); assert.equal(body.mediaAssetId, null);
  assert.ok(h.calls.indexOf("create") < h.calls.indexOf("dispatch"));
  assert.doesNotMatch(JSON.stringify(body), /owner-a|fingerprint|private-|storageKey|sourceAssetId|api-key|scribe_v2/);
});

test("both routes require verified owner identity; start also requires generation access", async () => {
  for (const status of [401, 403]) {
    const h = harness({ authError: new AuthError("Sign in", status) });
    assert.equal((await h.start()).status, status); assert.equal((await h.status()).status, status);
    assert.equal(h.calls.includes("read"), false); assert.equal(h.calls.includes("create"), false);
  }
});

test("compatibility gates fail closed before creating or dispatching unsupported work", async () => {
  for (const options of [{ env: { EXPLORE_FINISHING_ENABLED: "false" } }, { env: { EXPLORE_FINISHING_SUBTITLES_ENABLED: "false" } },
    { missingQueue: true }, { missingStorage: true }]) {
    const h = harness(options), response = await h.start(); assert.equal(response.status, 503);
    assert.equal(h.calls.includes("create"), false); assert.equal(h.calls.includes("dispatch"), false);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private-env|private-queue/);
  }
  const off = harness({ env: { EXPLORE_FINISHING_SUBTITLES_ENABLED: "false" }, draftChanges: { subtitles: null } });
  assert.equal((await off.start()).status, 202);
});

test("Editorial queues through the same owned durable finishing boundary", async () => {
  const h = harness({ draftChanges: { subtitles: { language: "en", style: "editorial", placement: "bottom" } } });
  assert.equal((await h.start()).status, 202);
  assert.ok(h.calls.indexOf("create") < h.calls.indexOf("dispatch"));
});

test("rejects client-chosen owners, URLs, outputs, fingerprints, request mismatch and unsupported draft fields", async () => {
  const bodies = [{ requestKey: key, draft: baseDraft, userId: "other" }, { requestKey: "bad", draft: baseDraft },
    { requestKey: key, draft: { ...baseDraft, sourceAssetId: "https://untrusted/video" } },
    { requestKey: key, draft: { ...baseDraft, outputAssetId: outputId } }, { requestKey: key, draft: { ...baseDraft, subtitles: { language: "hi", style: "clean", placement: "bottom" } } },
    { requestKey: key, draft: { ...baseDraft, demoAudioAssetId: sourceId } }, { requestKey: key, draft: { ...baseDraft, backgroundPlayback: "repeat" } }, [], null];
  const h = harness();
  for (const body of bodies) assert.equal((await h.start(body)).status, 400);
  assert.equal((await h.start(undefined, { "Idempotency-Key": outputId })).status, 400);
  assert.equal(h.calls.includes("create"), false); assert.equal(h.calls.includes("dispatch"), false);
});

test("request bodies are bounded even without Content-Length and malformed JSON never writes", async () => {
  const h = harness();
  assert.equal((await h.start("x".repeat(8193))).status, 413);
  assert.equal((await h.start(undefined, { "Content-Length": "8193" })).status, 413);
  assert.equal((await h.start(undefined, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await h.start("not json")).status, 400);
  assert.equal(h.calls.includes("create"), false);
});

test("same-identity replay keeps one receipt/job; changed edits conflict before dispatch", async () => {
  const h = harness(); await h.start(); await h.start();
  assert.equal(h.calls.filter(x => x === "create").length, 1);
  assert.equal((await h.start({ requestKey: key, draft: { ...baseDraft, kind: "phone" } })).status, 409);
  assert.equal(h.calls.filter(x => x === "create").length, 1);
});

test("cached receipt recovery works when subtitle creation is off; terminal and uncertain jobs are not re-dispatched", async () => {
  for (const [jobStatus, receiptStatus, outcome] of [["completed", "completed", "completed"], ["failed", "queued", "failed"], ["cancelled", "queued", "cancelled"], ["queued", "uncertain", "uncertain"]]) {
    const h = harness({ prior: true, jobStatus, receiptStatus, env: { EXPLORE_FINISHING_SUBTITLES_ENABLED: "false" } });
    const body = await (await h.start()).json(); assert.equal(body.outcome, outcome); assert.equal(h.calls.includes("create"), false); assert.equal(h.calls.includes("dispatch"), false);
    assert.equal(body.mediaAssetId, outcome === "completed" ? outputId : null);
  }
});

test("GET remains read-only when starts are off and returns unconfirmed, never not-started, for absent receipts", async () => {
  for (const prior of [false, true]) {
    const h = harness({ prior, env: { EXPLORE_FINISHING_ENABLED: "false" } }), response = await h.status(), body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.outcome, prior ? "pending" : "unconfirmed");
    assert.equal(h.calls.includes("access"), false); assert.equal(h.calls.includes("create"), false); assert.equal(h.calls.includes("dispatch"), false);
  }
});

test("recovery rejects owner overrides and duplicate or malformed identities without reading storage", async () => {
  const h = harness({ prior: true });
  for (const query of ["requestKey=bad", `requestKey=${key}&userId=other`, `requestKey=${key}&requestKey=${key}`, ""]) assert.equal((await h.status(query)).status, 400);
  assert.equal(h.calls.includes("read"), false);
});

test("foreign, stale, wrong-type and wrong-namespace jobs never dispatch or expose a saved output", async () => {
  const changes = [{ userId: "other" }, { id: sourceId }, { projectId: "other" }, { jobType: "final_render" }, { idempotencyKey: key },
    { input: { version: 1, userId: owner, requestKey: key, fingerprint: "wrong", outputAssetId: outputId } },
    { input: { version: 1, userId: "other", requestKey: key, fingerprint: "a".repeat(64), outputAssetId: outputId } }];
  for (const change of changes) {
    const h = harness({ prior: true, changeJob: job => ({ ...job, ...change }) });
    assert.equal((await h.status()).status, 409); assert.equal((await h.start()).status, 409); assert.equal(h.calls.includes("dispatch"), false);
  }
  const invalid = harness({ prior: true, jobStatus: "completed" }); assert.equal((await invalid.status()).status, 503);
});

test("completed recovery rechecks the ready saved asset and never treats a deleted output as usable", async () => {
  const h = harness({ prior: true, receiptStatus: "completed", jobStatus: "completed" });
  const body = await (await h.status()).json(); assert.equal(body.mediaAssetId, outputId); assert.equal(h.calls.includes("asset"), true);
  const missing = harness({ prior: true, receiptStatus: "completed", jobStatus: "completed", assetError: new contract.ExploreFinishError("Unavailable", 404) });
  assert.equal((await missing.status()).status, 404);
});

test("storage failures and uncertain provider outcomes are safe, bounded, and never start a replacement job", async () => {
  const privateError = new Error("private-key-in-database-error");
  for (const options of [{ readError: privateError }, { createError: privateError }]) {
    const h = harness(options), response = await h.start(); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /private-key/);
  }
  const uncertain = harness({ prior: true, jobStatus: "failed", errorCode: "PROVIDER_REQUEST_UNCERTAIN", progress: 200 });
  const body = await (await uncertain.status()).json(); assert.equal(body.outcome, "uncertain"); assert.equal(body.progress, 100);
  assert.doesNotMatch(JSON.stringify(body), /private-provider|private-storage/); assert.equal(uncertain.calls.includes("dispatch"), false);
  const unknownCode = harness({ prior: true, jobStatus: "failed", errorCode: "constructor" });
  assert.equal((await (await unknownCode.status()).json()).message, "Finishing did not complete. Your original media is unchanged.");
});

test("fingerprints normalize draft key order and bind style, audio playback, kind and transcription policy", () => {
  const h = harness(), fp = h.api.fingerprintExploreFinish(contract.parseExploreFinishDraft(baseDraft));
  assert.equal(fp, h.api.fingerprintExploreFinish(contract.parseExploreFinishDraft(Object.fromEntries(Object.entries(baseDraft).reverse()))));
  for (const change of [{ kind: "phone" }, { subtitles: null }, { subtitles: { language: "en", style: "bold-box", placement: "bottom" } }, { backgroundAssetId: sourceId, backgroundPlayback: "repeat" }]) assert.notEqual(fp, h.api.fingerprintExploreFinish(contract.parseExploreFinishDraft({ ...baseDraft, ...change })));
  assert.match(fp, /^[0-9a-f]{64}$/);
});

test("Next route delegates both methods to the authenticated server-only boundary", () => {
  const route = readFileSync(new URL("../app/api/explore/finishes/route.ts", import.meta.url), "utf8");
  assert.match(route, /runtime = "nodejs"/); assert.match(route, /POST[\s\S]*handleWorkflowFinishingStart/); assert.match(route, /GET[\s\S]*handleWorkflowFinishingStatus/);
  assert.doesNotMatch(route, /createScribe|ffmpeg|ELEVENLABS_API_KEY/);
});
