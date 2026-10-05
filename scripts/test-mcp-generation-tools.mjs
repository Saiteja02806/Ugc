import assert from "node:assert/strict";
import { ONE_TIME_FREE_GENERATION_CREDITS } from "../lib/billing/free-generation-credit-policy.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local-mcp-generation.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-secret";
process.env.GCP_PROJECT_ID = "local-generation-test";
process.env.GCP_AI_GENERATION_TASK_URL = "https://worker.example.test/jobs";
process.env.GCP_STORAGE_BUCKET = "local-generation-test-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://local-mcp-storage.example.test";
process.env.VERCEL = "";
process.env.BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND = "4";

const { GoogleAuth } = await import("google-auth-library");
GoogleAuth.prototype.getRequestHeaders = async () => new Headers({ authorization: "Bearer local-cloud-tasks-token" });

const assetId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
// PostgREST preserves a timezone offset and microseconds on real rows.
const now = "2026-09-27T12:00:00.123456+00:00";
const jobs = new Map();
let plan = "growth";
let rpcMode = "existing";
let rpcCalls = 0;
let lastRpcArgs;
let queueFailure = false;
let queueCalls = 0;

const asset = {
  id: assetId, user_id: "owner-a", collection: "image", source_type: "upload",
  status: "ready", mime_type: "image/png", url: "https://local-mcp-storage.example.test/ref.png",
  storage_key: "assets/ref.png", title: "Reference", file_name: "ref.png",
  file_size_bytes: 1024, width: 640, height: 640, duration_seconds: null,
  ratio: "1:1", thumbnail_url: null, created_at: now, updated_at: now,
  deleted_at: null, metadata: {}, parent_asset_id: null, project_id: null, source_record_id: null,
};

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (url.hostname === "cloudtasks.googleapis.com") {
    queueCalls += 1;
    assert.equal(method, "POST");
    assert.equal(init.headers.Authorization, "Bearer local-cloud-tasks-token");
    return queueFailure
      ? Response.json({ message: "local queue outage" }, { status: 503 })
      : Response.json({ name: "local-task" });
  }
  if (url.pathname.endsWith("/rest/v1/rpc/mcp_create_reserved_generation_job")) {
    assert.equal(method, "POST");
    rpcCalls += 1;
    const args = JSON.parse(init.body);
    lastRpcArgs = args;
    assert.equal(args.p_user_id, "owner-a");
    assert.ok(["generate_image", "generate_hook_video"].includes(args.p_job_type));
    assert.match(args.p_idempotency_key, args.p_job_type === "generate_image" ? /^mcp:image:/ : /^mcp:video:/);
    assert.equal(args.p_queue_name, "ai-generation");
    assert.match(args.p_fingerprint, /^[0-9a-f]{64}$/);
    assert.equal(args.p_input_json.mcpRequestFingerprint, args.p_fingerprint);
    if (rpcMode === "insufficient" ||
        (rpcMode === "insufficient-on-second" && args.p_idempotency_key.endsWith(":2"))) {
      return Response.json({ message: "insufficient_billing_credits" }, { status: 400 });
    }
    if (rpcMode === "conflict") {
      return Response.json({ message: "mcp_generation_idempotency_conflict" }, { status: 400 });
    }
    const existing = jobs.get(args.p_idempotency_key);
    if (existing && existing.input_json.mcpRequestFingerprint !== args.p_fingerprint) {
      return Response.json({ message: "mcp_generation_idempotency_conflict" }, { status: 400 });
    }
    const row = existing ?? {
      id: `22222222-2222-4222-8222-${(0x222222222222 + jobs.size).toString(16).padStart(12, "0")}`,
      user_id: "owner-a", job_type: args.p_job_type, status: rpcMode === "queued" ? "queued" : "processing",
      input_json: args.p_input_json, output_json: null, idempotency_key: args.p_idempotency_key,
      queue_name: "ai-generation", queue_provider: "gcp", queue_message_id: rpcMode === "queued" ? null : "existing-cloud-task",
      attempt_count: 1, max_attempts: 3, progress: 15, stage: "generating",
      created_at: now, updated_at: now,
    };
    jobs.set(args.p_idempotency_key, row);
    return Response.json({ created: rpcMode === "queued" && !existing, job: row });
  }
  if (url.pathname.endsWith("/rest/v1/background_jobs")) {
    if (method === "PATCH") {
      const row = [...jobs.values()].find((candidate) => url.searchParams.get("id") === `eq.${candidate.id}`);
      if (!row) return Response.json(null);
      Object.assign(row, JSON.parse(init.body));
      return Response.json(row);
    }
    const id = url.searchParams.get("id")?.slice(3);
    const owner = url.searchParams.get("user_id")?.slice(3);
    return Response.json([...jobs.values()].find((row) => row.id === id && row.user_id === owner) ?? null);
  }
  if (url.pathname.endsWith("/rest/v1/media_assets")) {
    return Response.json(url.searchParams.get("id") === `eq.${assetId}` &&
      url.searchParams.get("user_id") === "eq.owner-a" ? asset : null);
  }
  if (url.pathname.endsWith("/rest/v1/billing_subscriptions")) {
    const paid = plan === "growth";
    const row = { plan_key: "growth", status: "active", last_event_at: now };
    return Response.json(paid ? [row] : []);
  }
  if (url.pathname.endsWith("/rest/v1/rpc/ensure_free_generation_credit_balance")) {
    assert.equal(JSON.parse(init.body).p_user_id, "owner-a");
    return Response.json({ granted: ONE_TIME_FREE_GENERATION_CREDITS,
      remaining: ONE_TIME_FREE_GENERATION_CREDITS, reserved: 0, used: 0 });
  }
  if (url.pathname.endsWith("/rest/v1/billing_credit_balances")) {
    return Response.json(plan === "growth" ? {
      credit_limit: 100, used_credits: 0, reserved_credits: 0,
      period_start: "2026-09-01T00:00:00.000Z", period_end: "2099-10-01T00:00:00.000Z",
    } : null);
  }
  if (url.pathname.endsWith("/rest/v1/subscription_entitlements")) return Response.json([]);
  if (url.pathname.endsWith("/rest/v1/complimentary_plan_grants")) return Response.json(null);
  if (url.pathname.endsWith("/rest/v1/free_trial_entitlements")) return Response.json(null);
  if (url.pathname.endsWith("/rest/v1/social_connections") ||
      url.pathname.endsWith("/rest/v1/free_trial_instagram_schedule_usage")) {
    return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  }
  throw new Error(`Unexpected local service request: ${url.pathname}`);
};

const { mcpHandler } = await import("../lib/mcp/server.ts");
const resource = new URL("https://mcp.getugcpilot.com/mcp");
let callId = 0;
async function call(name, args, owner = "owner-a", scopes = ["generation:write", "jobs:read"]) {
  const response = await mcpHandler.fetch(new Request(resource, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++callId, method: "tools/call", params: { name, arguments: args } }),
  }), { authInfo: { token: "local", clientId: "local", scopes, resource, extra: { firebaseUid: owner } } });
  const raw = await response.text();
  const line = raw.split("\n").find((part) => part.startsWith("data: "));
  const body = JSON.parse(line ? line.slice(6) : raw);
  return body.result ?? body;
}
function errorCode(result) {
  return JSON.parse(result.content[0].text).code;
}

const input = { prompt: "Product photo", aspect_ratio: "9:16", client_request_id: "request-1" };
const forbidden = await call("generate_image", input, "owner-a", ["jobs:read"]);
assert.ok(forbidden._meta?.["mcp/www_authenticate"] || forbidden.isError || forbidden.error);
plan = "free";
assert.equal(errorCode(await call("generate_image", input)), "PLAN_REQUIRED");
assert.equal(rpcCalls, 0);
plan = "growth";
const initial = await call("generate_image", input);
assert.deepEqual(initial.structuredContent, { jobs: [{ job_id: jobId, status: "processing" }], partial: false });
const retry = await call("generate_image", { ...input, prompt: " Product photo " });
assert.deepEqual(retry.structuredContent, initial.structuredContent);
assert.equal(jobs.size, 1);
assert.equal(errorCode(await call("generate_image", { ...input, prompt: "Different product" })), "IDEMPOTENCY_CONFLICT");
rpcMode = "insufficient";
assert.equal(errorCode(await call("generate_image", { ...input, client_request_id: "request-2" })), "INSUFFICIENT_CREDITS");
rpcMode = "existing";
rpcMode = "insufficient-on-second";
const partial = await call("generate_image", { ...input, client_request_id: "request-batch", count: 2 });
assert.equal(partial.structuredContent.jobs.length, 1);
assert.equal(partial.structuredContent.partial, true);
rpcMode = "existing";
const resumed = await call("generate_image", { ...input, client_request_id: "request-batch", count: 2 });
assert.equal(resumed.structuredContent.jobs.length, 2);
assert.equal(resumed.structuredContent.partial, false);
assert.equal(errorCode(await call("generate_image", {
  ...input, client_request_id: "request-3", reference_asset_id: "33333333-3333-4333-8333-333333333333",
})), "REFERENCE_NOT_FOUND");
const withReference = await call("generate_image", {
  ...input, client_request_id: "request-4", reference_asset_id: assetId,
});
assert.equal(withReference.structuredContent.jobs.length, 1);
assert.equal(lastRpcArgs.p_input_json.referenceImageUrl, asset.url);
rpcMode = "queued";
queueFailure = true;
const deliveryInput = { ...input, client_request_id: "request-delivery" };
const undelivered = await call("generate_image", deliveryInput);
assert.equal(undelivered.structuredContent.jobs[0].status, "queued");
assert.equal(queueCalls, 1);
queueFailure = false;
rpcMode = "existing";
const redelivered = await call("generate_image", deliveryInput);
assert.deepEqual(redelivered.structuredContent, undelivered.structuredContent);
assert.equal(queueCalls, 2);
assert.ok([...jobs.values()].find((row) => row.id === redelivered.structuredContent.jobs[0].job_id).queue_message_id);
assert.equal(errorCode(await call("get_job", { job_id: jobId }, "owner-b")), "NOT_FOUND");
const active = await call("get_job", { job_id: jobId });
assert.equal(active.structuredContent.status, "processing");
assert.equal(active.structuredContent.created_at, "2026-09-27T12:00:00.123Z");
assert.equal(active.structuredContent.updated_at, "2026-09-27T12:00:00.123Z");
assert.deepEqual(active.structuredContent.output_asset_ids, []);
const job = jobs.values().next().value;
job.updated_at = "2026-09-27T17:30:00.123456+05:30";
assert.equal((await call("get_job", { job_id: jobId })).structuredContent.updated_at, "2026-09-27T12:00:00.123Z");
job.status = "completed";
job.output_json = { mediaAssetId: assetId };
const completed = await call("get_job", { job_id: jobId });
assert.deepEqual(completed.structuredContent.output_asset_ids, [assetId]);
job.status = "failed";
job.output_json = null;
job.error_code = "PROVIDER_TIMEOUT";
const failed = await call("get_job", { job_id: jobId });
assert.equal(failed.structuredContent.error.code, "PROVIDER_TIMEOUT");
assert.ok(!JSON.stringify(failed).includes("local-test-secret"));

const videoInput = { prompt: "Orange slowly rotating", duration_seconds: 3, client_request_id: "video-1" };
const callsBeforeInvalid = rpcCalls;
for (const invalid of [
  { ...videoInput, duration_seconds: undefined }, { ...videoInput, duration_seconds: 2 },
  { ...videoInput, duration_seconds: 11 }, { ...videoInput, duration_seconds: 3.5 },
  { ...videoInput, aspect_ratio: "1:1" }, { ...videoInput, count: 3 },
  { ...videoInput, prompt: "x".repeat(1001) }, { ...videoInput, user_id: "owner-b" },
  { ...videoInput, reference_video_url: asset.url }, { ...videoInput, model: "arbitrary" },
]) {
  const result = await call("generate_video", invalid);
  assert.ok(result.isError || result.error, `Invalid video input accepted: ${JSON.stringify(invalid)}`);
}
assert.equal(rpcCalls, callsBeforeInvalid);
const forbiddenVideo = await call("generate_video", videoInput, "owner-a", ["jobs:read"]);
assert.ok(forbiddenVideo._meta?.["mcp/www_authenticate"] || forbiddenVideo.isError || forbiddenVideo.error);
plan = "free";
assert.equal(errorCode(await call("generate_video", videoInput)), "PLAN_REQUIRED");
plan = "growth";
rpcMode = "existing";
const video = await call("generate_video", videoInput);
assert.equal(video.structuredContent.jobs.length, 1);
assert.equal(lastRpcArgs.p_amount, 12);
assert.equal(lastRpcArgs.p_input_json.durationSeconds, 3);
assert.equal(lastRpcArgs.p_input_json.hookIdea, videoInput.prompt);
assert.equal(lastRpcArgs.p_input_json.model, "google_omni");
assert.equal(lastRpcArgs.p_input_json.promptMode, "direct");
assert.equal(lastRpcArgs.p_input_json.userId, "owner-a");
assert.equal(lastRpcArgs.p_input_json.projectId, "ai-studio");
assert.match(lastRpcArgs.p_input_json.videoId, /^[0-9a-f-]{36}$/);
assert.equal(lastRpcArgs.p_input_json.referenceVideoUrl, undefined);
assert.deepEqual((await call("generate_video", { ...videoInput, prompt: ` ${videoInput.prompt} ` })).structuredContent, video.structuredContent);
assert.equal(errorCode(await call("generate_video", { ...videoInput, duration_seconds: 4 })), "IDEMPOTENCY_CONFLICT");
// The same caller request ID is independently scoped to image/video operations.
assert.equal((await call("generate_image", { ...input, client_request_id: "video-1" })).structuredContent.jobs.length, 1);
rpcMode = "insufficient";
assert.equal(errorCode(await call("generate_video", { ...videoInput, client_request_id: "video-no-credit" })), "INSUFFICIENT_CREDITS");
rpcMode = "insufficient-on-second";
assert.equal((await call("generate_video", { ...videoInput, client_request_id: "video-batch", count: 2 })).structuredContent.partial, true);
rpcMode = "existing";
assert.equal((await call("generate_video", { ...videoInput, client_request_id: "video-batch", count: 2 })).structuredContent.jobs.length, 2);
assert.equal(errorCode(await call("generate_video", { ...videoInput, client_request_id: "video-reference-missing", reference_asset_id: "33333333-3333-4333-8333-333333333333" })), "REFERENCE_NOT_FOUND");
await call("generate_video", { ...videoInput, client_request_id: "video-ref", reference_asset_id: assetId });
assert.equal(lastRpcArgs.p_input_json.avatarImageUrl, asset.url);
asset.collection = "video";
asset.mime_type = "video/mp4";
assert.equal(errorCode(await call("generate_video", { ...videoInput, client_request_id: "video-ref-unsupported", reference_asset_id: assetId })), "UNSUPPORTED_REFERENCE");
const videoId = video.structuredContent.jobs[0].job_id;
assert.equal(errorCode(await call("get_job", { job_id: videoId }, "owner-b")), "NOT_FOUND");
const videoJob = [...jobs.values()].find(row => row.id === videoId);
videoJob.status = "completed";
videoJob.output_json = { mediaAssetId: assetId };
const completedVideo = await call("get_job", { job_id: videoId });
assert.equal(completedVideo.structuredContent.type, "video_generation");
assert.deepEqual(completedVideo.structuredContent.output_asset_ids, [assetId]);
asset.collection = "image";
assert.equal(errorCode(await call("get_job", { job_id: videoId })), "INTERNAL_ERROR");
rpcMode = "queued";
queueFailure = true;
const queuedVideoInput = { ...videoInput, client_request_id: "video-delivery" };
const queuedVideo = await call("generate_video", queuedVideoInput);
assert.equal(queuedVideo.structuredContent.jobs[0].status, "queued");
queueFailure = false;
rpcMode = "existing";
assert.deepEqual((await call("generate_video", queuedVideoInput)).structuredContent, queuedVideo.structuredContent);
assert.ok([...jobs.values()].find(row => row.id === queuedVideo.structuredContent.jobs[0].job_id).queue_message_id);

console.log("MCP image/video tools: scope, strict inputs, duration pricing, model mapping, retry/conflict, partial batches, references, queue recovery, ownership, completion, and safe failures passed.");
