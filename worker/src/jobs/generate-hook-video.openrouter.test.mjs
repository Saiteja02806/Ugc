import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";

const initialKey = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "worker-test-key";
const video = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
let uploaded;
mock.module("../../dist/lib/storage.js", { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async (input) => { uploaded = input; return { key: input.key, url: `https://storage.example.com/${input.key}` }; },
} });
const { runGenerateHookVideoJob } = await import("../../dist/jobs/generate-hook-video.js");
afterEach(() => mock.restoreAll());
after(() => { if (initialKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = initialKey; });
const job = { id: "job-1", input_json: {
  model: "seedance_2_5", provider: "openrouter", promptMode: "direct",
  hookIdea: "A cup beside a sunny window", aspectRatio: "9:16", durationSeconds: 5,
  resolution: "720p", projectId: "ai-studio", userId: "user-1", videoId: "video-1",
} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function context(existing = null) {
  let operation = existing;
  const events = [];
  const store = {
    getGenerationProviderOperation: async ({ operationKey }) => operationKey === "primary-higgsfield" ? null : operation,
    reserveGenerationProviderOperation: async (input) => {
      assert.equal(input.provider, "openrouter"); assert.equal(input.operationKey, "primary-openrouter");
      const shouldSubmit = !operation;
      operation ??= { provider: "openrouter", status: "reserved", provider_operation_id: null, output_url: null, metadata: input.metadata };
      return { operation, shouldSubmit };
    },
    markGenerationProviderSubmitted: async (input) => { events.push("save-id"); Object.assign(operation, { status: "submitted", provider_operation_id: input.providerOperationId }); },
    markGenerationProviderSucceeded: async (input) => { events.push("save-provider-output"); Object.assign(operation, { status: "provider_succeeded", output_url: input.outputUrl, metadata: input.metadata }); },
    markGenerationOutputPersisted: async (input) => { events.push("save-stored-output"); Object.assign(operation, { status: "output_persisted", output_url: input.outputUrl, metadata: input.metadata }); },
    markGenerationProviderFailed: async (input) => { events.push("failed"); Object.assign(operation, { status: "failed", last_error_code: input.errorCode, retry_allowed: input.retryAllowed }); },
  };
  return { store, checkpoint: async () => {}, operation: () => operation, events };
}

test("the real worker submits OpenRouter, validates MP4, stores output and retains provider usage", async () => {
  const ctx = context();
  const requests = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? "GET" });
    assert.ok(String(url).startsWith("https://openrouter.ai/api/v1/"));
    if (String(url).endsWith("/key")) return json({ data: { limit_remaining: 100 } });
    if (init?.method === "POST") return json({ id: "accepted-id" }, 202);
    if (String(url).includes("/content")) {
      assert.equal(ctx.operation().status, "provider_succeeded");
      return new Response(video, { headers: { "content-type": "video/mp4" } });
    }
    assert.equal(ctx.operation().provider_operation_id, "accepted-id");
    return json({ status: "completed", generation_id: "provider-generation", usage: { cost: 1.1556 } });
  });
  const result = await runGenerateHookVideoJob(job, ctx);
  assert.equal(result.provider, "openrouter"); assert.equal(result.durationSeconds, 5);
  assert.equal(result.url, "https://storage.example.com/videos/hooks/user-1/ai-studio/video-1.mp4");
  assert.deepEqual(uploaded.buffer, video);
  assert.deepEqual(ctx.events, ["save-id", "save-provider-output", "save-stored-output"]);
  assert.equal(ctx.operation().metadata.providerCostUsd, 1.1556);
  assert.equal(ctx.operation().metadata.generationId, "provider-generation");
  assert.equal(requests.filter((request) => request.method === "POST").length, 1);
});

test("a transient poll failure resumes the same accepted OpenRouter operation on worker retry", async () => {
  const ctx = context();
  let posts = 0;
  mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).endsWith("/key")) return json({ data: {} });
    if (init?.method === "POST") { posts++; return json({ id: "accepted-id" }, 202); }
    return json({ error: { message: "Temporarily unavailable" } }, 500);
  });
  for (let i = 0; i < 2; i++) {
    await assert.rejects(runGenerateHookVideoJob(job, ctx), (error) => error.code === "provider_operation_pending");
  }
  assert.equal(posts, 1); assert.equal(ctx.operation().provider_operation_id, "accepted-id");
});

test("worker moderation failures become non-retryable without falling back to a paid provider", async () => {
  const ctx = context({ provider: "openrouter", status: "submitted", provider_operation_id: "accepted-id", output_url: null, metadata: {} });
  let requests = 0;
  mock.method(globalThis, "fetch", async (_url, init) => { assert.notEqual(init?.method, "POST"); requests++; return json({ status: "failed", error: "Content policy violation" }); });
  await assert.rejects(runGenerateHookVideoJob(job, ctx), (error) => error.code === "PROVIDER_CONTENT_MODERATION");
  assert.equal(requests, 1); assert.equal(ctx.operation().last_error_code, "PROVIDER_CONTENT_MODERATION");
  assert.equal(ctx.operation().retry_allowed, false);
});
