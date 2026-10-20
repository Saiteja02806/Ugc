import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { executeTool, oauthMetadata, principal, ToolFailure } from "../lib/mcp/read-tools.ts";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Buffer, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const fontMetrics = JSON.parse(readFileSync(new URL("../worker/src/lib/explore-text-font-metrics.json", import.meta.url), "utf8"));
const fonts = load("worker/src/lib/explore-text-fonts.ts", { "./explore-text-font-metrics.json": fontMetrics });
const edit = load("worker/src/lib/explore-format-edit.ts", { "./explore-inline-symbols.ts": load("worker/src/lib/explore-inline-symbols.ts"),
  "./edit-overlay-render-spec.ts": load("worker/src/lib/edit-overlay-render-spec.ts"),
  "./explore-text-fonts.ts": fonts,
});
const subtitleContracts = load("worker/src/subtitles/contracts.ts", { "./styles.ts": load("worker/src/subtitles/styles.ts") });
const corrections = load("worker/src/subtitles/corrections.ts", { "./contracts.ts": subtitleContracts });
const contract = load("worker/src/lib/explore-finishing-contract.ts", { "../subtitles/styles.ts": load("worker/src/subtitles/styles.ts"), "./explore-format-edit.ts": edit, "../subtitles/contracts.ts": subtitleContracts, "../subtitles/corrections.ts": corrections });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const key = id(1), source = id(2), demo = id(3), jobId = id(4), outputId = id(5);
const plain = value => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const env = { MCP_VIDEO_FINISHING_ENABLED: "true", EXPLORE_FINISHING_ENABLED: "true", EXPLORE_FORMAT_EDITING_ENABLED: "true", ...options.env };
  const calls = [], receipts = new Map(), records = new Map();
  let access = options.access ?? true;
  const service = load("lib/explore/workflow-finishing-service.ts", {
    "server-only": {}, "node:crypto": { createHash },
    "@/worker/src/lib/explore-format-edit": edit,
    "@/worker/src/lib/explore-finishing-contract": contract,
    "@/worker/src/subtitles/elevenlabs-contract": { SCRIBE_PROVIDER_KEY: "elevenlabs:scribe_v2:auto:en:word:v1" },
    "@/lib/jobs/background-jobs": {
      getMissingBackgroundJobStorageEnvVars: () => options.missingStorage ? ["private-env"] : [],
      getBackgroundJobForUser: async ({ userId, jobId: requested }) => {
        calls.push("job"); const job = records.get(requested);
        return job?.userId === userId ? options.changeJob ? options.changeJob(job) : job : null;
      },
    },
    "@/lib/queues/job-queue": { getMissingJobQueueEnvVars: () => options.missingQueue ? ["private-queue"] : [] },
    "@/lib/jobs/background-job-service": { dispatchQueuedBackgroundJobForRecovery: async job => { calls.push("dispatch"); return job; } },
    "./workflow-finishing-store": { ExploreFinishingRequestStore: class {
      async read(owner, requestKey) { calls.push("read"); if (options.storageError) throw new Error("private-database-secret"); return receipts.get(`${owner}:${requestKey}`) ?? null; }
      async create(owner, requestKey, fingerprint, draft) {
        calls.push("create");
        if (draft.sourceAssetId !== source || draft.demoAssetId && draft.demoAssetId !== demo) throw new contract.ExploreFinishError("A selected media file is no longer available.", 409);
        const receipt = { user_id: owner, request_key: requestKey, fingerprint, draft, job_id: jobId, output_asset_id: outputId, status: "queued" };
        receipts.set(`${owner}:${requestKey}`, receipt);
        records.set(jobId, { id: jobId, userId: owner, jobType: "render_demo_video", projectId: "explore", idempotencyKey: `explore-finish:${requestKey}`,
          input: { version: 1, userId: owner, requestKey, fingerprint, outputAssetId: outputId }, status: "queued", progress: 0, stage: "queued" });
        return receipt;
      }
      async asset(owner, assetId, collection) {
        calls.push("asset"); assert.equal(owner, "owner-a"); assert.equal(assetId, outputId); assert.equal(collection, "video");
        if (options.deletedOutput) throw new contract.ExploreFinishError("The finished video is unavailable.", 404);
      }
    } },
  }, { process: { env } });
  const tools = new Map();
  const toolModule = load("lib/mcp/finishing-tools.ts", {
    "server-only": {}, "zod": { z }, "@modelcontextprotocol/server": { requireScopes: (...scopes) => scopes },
    "@/lib/billing/subscription-db": { getUserSubscription: async (owner, flags) => {
      calls.push("access"); assert.ok(owner); assert.equal(flags.refreshCredits, false); assert.equal(flags.initializeFreeCredits, false);
      if (options.entitlementError) throw new Error("private-plan-secret");
      return { isActive: access, freeGenerationCredits: { granted: options.freeAllowance ?? 0 } };
    } },
    "@/lib/explore/workflow-finishing-service": service,
    "@/worker/src/lib/explore-finishing-contract": contract,
    "@/worker/src/lib/explore-format-edit": edit,
    "./read-tools": { executeTool, oauthMetadata, principal, ToolFailure },
  }, { process: { env } });
  toolModule.registerFinishingMcpTools({ registerTool(name, config, callback) { tools.set(name, { config, callback }); } });
  async function call(name, input = {}, owner = "owner-a", scopes = ["creative:write", "account:read", "jobs:read"]) {
    const tool = tools.get(name), parsed = tool.config.inputSchema.parse(input);
    const result = await tool.callback(parsed, { http: { authInfo: { scopes, extra: { firebaseUid: owner } } } });
    if (!result.isError) tool.config.outputSchema.parse(result.structuredContent);
    return plain(result);
  }
  return { calls, tools, call, env, receipts, records, service, accessOff: () => { access = false; } };
}
const input = { request_key: key, draft: { sourceAssetId: source, demoAssetId: demo } };
const errorCode = result => JSON.parse(result.content[0].text).code;

test("new tools have dedicated scopes and read-only recovery annotations", () => {
  const h = harness();
  assert.deepEqual(h.tools.get("finish_video").config.scopeChallenge, ["creative:write"]);
  assert.deepEqual(h.tools.get("get_video_finish").config.scopeChallenge, ["jobs:read"]);
  assert.equal(h.tools.get("get_video_finish").config.annotations.readOnlyHint, true);
  assert.equal(h.tools.get("get_video_finishing_capabilities").config.annotations.readOnlyHint, true);
});

test("owned generic hook and demo compose through the real shared service and preserve one receipt on replay", async () => {
  const h = harness(), first = (await h.call("finish_video", input)).structuredContent;
  assert.equal(first.outcome, "pending"); assert.equal(first.job_id, jobId); assert.deepEqual(first.output_asset_ids, []);
  const receipt = h.receipts.get(`owner-a:${key}`);
  assert.equal(receipt.draft.sourceAssetId, source); assert.equal(receipt.draft.demoAssetId, demo); assert.equal(receipt.draft.subtitles, null);
  assert.deepEqual((await h.call("finish_video", input)).structuredContent, first);
  assert.equal(h.calls.filter(call => call === "create").length, 1);
  assert.equal(errorCode(await h.call("finish_video", { ...input, draft: { sourceAssetId: source } })), "FINISH_CONFLICT");
  assert.equal(h.calls.filter(call => call === "create").length, 1);
});

test("new connector subtitles use modern audio preparation while omitted-version replays preserve their receipt", async () => {
  const options = { env: { EXPLORE_FINISHING_SUBTITLES_ENABLED: "true" } };
  const h = harness(options), request = { ...input, draft: { sourceAssetId: source, subtitles: { language: "en", style: "serif-box" } } };
  assert.equal((await h.call("finish_video", request)).isError, undefined);
  assert.equal(h.receipts.get(`owner-a:${key}`).draft.subtitles.version, 2);
  const accepted = plain(h.receipts.get(`owner-a:${key}`));
  await h.call("finish_video", request);
  assert.deepEqual(plain(h.receipts.get(`owner-a:${key}`)), accepted);
  assert.equal(h.calls.filter(call => call === "create").length, 1);
  assert.equal(errorCode(await h.call("finish_video", { ...request, draft: { ...request.draft, subtitles: { ...request.draft.subtitles, placement: "top" } } })), "FINISH_CONFLICT");
  const legacy = harness(options);
  await legacy.service.startWorkflowFinishingForOwner("owner-a", key, legacy.tools.get("finish_video").config.inputSchema.parse(request).draft);
  const before = plain(legacy.receipts.get(`owner-a:${key}`));
  assert.equal(before.draft.subtitles.version, undefined);
  assert.equal((await legacy.call("finish_video", request)).isError, undefined);
  assert.deepEqual(plain(legacy.receipts.get(`owner-a:${key}`)), before);
  assert.equal(errorCode(await legacy.call("finish_video", { ...request, draft: { ...request.draft, subtitles: { ...request.draft.subtitles, version: 2 } } })), "FINISH_CONFLICT");
});

test("old generation permission cannot authorize finishing, and rollout/access failures never write", async () => {
  const h = harness();
  assert.equal(errorCode(await h.call("finish_video", input, "owner-a", ["generation:write", "jobs:read"])), "INSUFFICIENT_SCOPE");
  assert.deepEqual(h.calls, []);
  for (const options of [{ env: { MCP_VIDEO_FINISHING_ENABLED: "false" } }, { env: { EXPLORE_FINISHING_ENABLED: "false" } }, { access: false }, { missingStorage: true }, { missingQueue: true }]) {
    const failed = harness(options), result = await failed.call("finish_video", input);
    assert.equal(result.isError, true); assert.equal(failed.calls.includes("create"), false); assert.equal(failed.calls.includes("dispatch"), false);
    assert.doesNotMatch(JSON.stringify(result), /private-env|private-queue/);
  }
  assert.equal((await harness({ access: false, freeAllowance: 12 }).call("finish_video", input)).isError, undefined);
});

test("capabilities follow actual account/gates/configuration and never mutate", async () => {
  for (const [options, reason] of [[{}, "available"], [{ access: false }, "access_required"], [{ missingQueue: true }, "not_configured"], [{ env: { MCP_VIDEO_FINISHING_ENABLED: "false" } }, "not_enabled"]]) {
    const h = harness(options), result = (await h.call("get_video_finishing_capabilities")).structuredContent;
    assert.equal(result.reason, reason); assert.equal(result.available, reason === "available");
    assert.equal(result.subtitles, false); assert.deepEqual(h.calls, ["access"]);
  }
});

test("polling remains read-only across rollout/plan changes and returns only verified completed assets", async () => {
  const h = harness(); await h.call("finish_video", input);
  h.env.MCP_VIDEO_FINISHING_ENABLED = "false"; h.env.EXPLORE_FINISHING_ENABLED = "false"; h.accessOff(); h.calls.length = 0;
  const pending = await h.call("get_video_finish", { request_key: key }); assert.equal(pending.structuredContent.outcome, "pending");
  assert.deepEqual(h.calls, ["read", "job"]);
  h.receipts.get(`owner-a:${key}`).status = "completed"; h.records.get(jobId).status = "completed";
  const complete = (await h.call("get_video_finish", { request_key: key })).structuredContent;
  assert.equal(complete.outcome, "completed"); assert.deepEqual(complete.output_asset_ids, [outputId]);
  assert.doesNotMatch(JSON.stringify(complete), /owner-a|fingerprint|sourceAssetId/);
});

test("foreign owner lookups are unconfirmed and foreign selected inputs cannot create a job", async () => {
  const h = harness(); await h.call("finish_video", input);
  h.calls.length = 0;
  const other = (await h.call("get_video_finish", { request_key: key }, "other")).structuredContent;
  assert.equal(other.outcome, "unconfirmed"); assert.equal(other.job_id, null); assert.deepEqual(other.output_asset_ids, []);
  assert.deepEqual(h.calls, ["read"]);
  assert.equal(errorCode(await harness().call("finish_video", { ...input, draft: { sourceAssetId: id(99) } })), "FINISH_CONFLICT");
});

test("strict schemas and canonical worker policy reject owner/URL overrides and incompatible edit stages", async () => {
  const h = harness();
  for (const bad of [{ ...input, userId: "other" }, { ...input, draft: { sourceAssetId: "https://untrusted/video" } }, { ...input, draft: { ...input.draft, outputAssetId: outputId } }]) {
    await assert.rejects(h.call("finish_video", bad));
  }
  const editing = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 5000, originalVolume: 1, musicVolume: 0, text: null };
  assert.equal(errorCode(await h.call("finish_video", { ...input, draft: { ...input.draft, editing } })), "INVALID_INPUT");
  assert.equal(errorCode(await h.call("finish_video", { ...input, draft: { sourceAssetId: source, editing: { ...editing, trimStartMs: 4800 } } })), "INVALID_INPUT");
  assert.equal(h.calls.includes("create"), false);
  const text = { value: "Keep these exact words\nSecond line", width: .8, y: .1, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 3000 };
  assert.equal((await h.call("finish_video", { ...input, draft: { sourceAssetId: source, editing: { ...editing, text } } })).isError, undefined);
  assert.equal(h.receipts.get(`owner-a:${key}`).draft.editing.text.value, text.value);
});

test("wrong job receipts, deleted output and uncertain provider outcomes cannot masquerade as completion", async () => {
  const wrong = harness({ changeJob: job => ({ ...job, userId: "other" }) });
  assert.equal(errorCode(await wrong.call("finish_video", input)), "FINISH_CONFLICT"); assert.equal(wrong.calls.includes("dispatch"), false);
  const deleted = harness({ deletedOutput: true }); await deleted.call("finish_video", input);
  deleted.records.get(jobId).status = "completed"; deleted.receipts.get(`owner-a:${key}`).status = "completed";
  assert.equal(errorCode(await deleted.call("get_video_finish", { request_key: key })), "NOT_FOUND");
  const h = harness(); await h.call("finish_video", input); h.calls.length = 0;
  h.records.get(jobId).status = "failed"; h.records.get(jobId).errorCode = "PROVIDER_REQUEST_UNCERTAIN";
  assert.equal((await h.call("get_video_finish", { request_key: key })).structuredContent.outcome, "uncertain");
  assert.equal(h.calls.includes("dispatch"), false);
});

test("storage and entitlement exceptions expose no secrets and missing receipt never proves no submission", async () => {
  for (const options of [{ storageError: true }, { entitlementError: true }]) {
    const h = harness(options), failed = await h.call("finish_video", input);
    assert.equal(failed.isError, true); assert.doesNotMatch(JSON.stringify(failed), /private-.*secret/); assert.equal(h.calls.includes("create"), false);
  }
  const h = harness(), absent = (await h.call("get_video_finish", { request_key: key })).structuredContent;
  assert.equal(absent.outcome, "unconfirmed"); assert.deepEqual(h.calls, ["read"]);
});
