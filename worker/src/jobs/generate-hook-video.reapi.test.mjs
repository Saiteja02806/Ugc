import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";

const previousKey = process.env.REAPI_API_KEY;
process.env.REAPI_API_KEY = "reapi-worker-test-key";
after(() => { if (previousKey === undefined) delete process.env.REAPI_API_KEY; else process.env.REAPI_API_KEY = previousKey; });
afterEach(() => mock.restoreAll());
const video = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
mock.module("../../dist/lib/storage.js", { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async input => { assert.deepEqual(input.buffer, video); return { key: input.key, url: `https://storage.example.com/${input.key}` }; },
} });
const { runGenerateHookVideoJob } = await import("../../dist/jobs/generate-hook-video.js");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const job = { id: "reapi-job", input_json: {
  model: "seedance_2_5", provider: "reapi", promptMode: "direct", hookIdea: "Introduce the app using the supplied voice and appearance.",
  aspectRatio: "9:16", durationSeconds: 17, resolution: "720p", projectId: "ai-studio", userId: "user-1", videoId: "video-1",
  referenceImageUrls: ["https://storage.example.com/image.png"], referenceAudioUrls: ["https://storage.example.com/audio.mp3"],
  referenceAudioDurationSeconds: [8], referenceVideoUrl: "https://storage.example.com/source.mp4", referenceVideoDurationSeconds: 7.923,
} };
function context() {
  let operation;
  const events = [];
  return { events, operation: () => operation, checkpoint: async () => {}, store: {
    getGenerationProviderOperation: async ({ operationKey }) => operationKey === "primary-higgsfield" ? null : operation ?? null,
    reserveGenerationProviderOperation: async input => {
      assert.equal(input.provider, "reapi"); assert.equal(input.operationKey, "primary-reapi");
      const shouldSubmit = !operation;
      if (operation) assert.equal(operation.request_fingerprint, input.requestFingerprint);
      operation ??= { provider: input.provider, request_fingerprint: input.requestFingerprint, status: "reserved", provider_operation_id: null, metadata: input.metadata };
      return { shouldSubmit, operation };
    },
    markGenerationProviderSubmitted: async value => { events.push("save-id"); Object.assign(operation, { status: "submitted", provider_operation_id: value.providerOperationId }); },
    markGenerationProviderSucceeded: async value => { events.push("save-output"); Object.assign(operation, { status: "provider_succeeded", output_url: value.outputUrl, metadata: value.metadata }); },
    markGenerationOutputPersisted: async value => { events.push("persist-output"); Object.assign(operation, { status: "output_persisted", output_url: value.outputUrl, metadata: value.metadata }); },
    markGenerationProviderFailed: async value => Object.assign(operation, { status: "failed", last_error_code: value.errorCode, retry_allowed: value.retryAllowed }),
    markGenerationProviderSubmissionUncertain: async () => Object.assign(operation, { status: "submission_uncertain" }),
  } };
}

test("both real worker routes send every reference to reapi.ai, keep selected duration, and recover without another paid POST", async () => {
  for (const model of ["seedance_2_5", "wan_3_0"]) {
    const ctx = context(); let posts = 0;
    mock.method(globalThis, "fetch", async (url, init) => {
      const raw = String(url);
      assert.ok(raw.startsWith("https://reapi.ai/api/v1/") || raw.startsWith("https://cdn.reapi.ai/"), "No OpenRouter or Runway access");
      if (init?.method === "POST") {
        posts++; assert.equal(raw, "https://reapi.ai/api/v1/videos/generations");
        const body = JSON.parse(init.body);
        assert.equal(body.model, model === "seedance_2_5" ? "doubao-seedance-2.5-face" : "wan3.0-video");
        assert.equal(body.content_filter, model !== "seedance_2_5");
        assert.equal(body.duration, 17); assert.equal(body.prompt, job.input_json.hookIdea);
        assert.deepEqual(body.image_urls, job.input_json.referenceImageUrls);
        assert.deepEqual(body.audio_urls, job.input_json.referenceAudioUrls);
        assert.deepEqual(body.video_urls, [job.input_json.referenceVideoUrl]);
        return json({ id: "task-accepted", status: "processing" }, 202);
      }
      if (raw.includes("/tasks/")) {
        assert.equal(ctx.operation().provider_operation_id, "task-accepted");
        return json({ id: "task-accepted", status: "completed", output: { video_urls: ["https://cdn.reapi.ai/result.mp4"] }, usage: { credits: 189 } });
      }
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      assert.equal(ctx.operation().status, "provider_succeeded");
      return new Response(video, { headers: { "content-type": "video/mp4" } });
    });
    const withModel = { ...job, input_json: { ...job.input_json, model, referenceAudioDurationSeconds: [model === "seedance_2_5" ? 30 : 15] } };
    const result = await runGenerateHookVideoJob(withModel, ctx);
    assert.equal(result.provider, "reapi"); assert.equal(result.durationSeconds, 17);
    assert.equal(ctx.operation().metadata.durationSeconds, 17);
    assert.equal(ctx.operation().metadata.providerCostUsd, .189);
    assert.equal(ctx.operation().metadata.generationId, "task-accepted");
    assert.deepEqual(ctx.events, ["save-id", "save-output", "persist-output"]);
    await runGenerateHookVideoJob(withModel, ctx);
    assert.equal(posts, 1);
    mock.restoreAll();
  }
});

test("lost POST responses stay uncertain and cannot be resubmitted through any provider", async () => {
  const ctx = context(); let posts = 0;
  mock.method(globalThis, "fetch", async (_url, init) => { assert.equal(init?.method, "POST"); posts++; throw new Error("connection lost after acceptance"); });
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(runGenerateHookVideoJob(job, ctx), error => error.code === "provider_submission_uncertain");
  assert.equal(posts, 1); assert.equal(ctx.operation().status, "submission_uncertain");
});

test("poll failures preserve the accepted ReAPI ID and never submit again", async () => {
  const ctx = context(); let posts = 0;
  mock.method(globalThis, "fetch", async (_url, init) => {
    if (init?.method === "POST") { posts++; return json({ task_id: "accepted" }, 202); }
    return json({ error: { message: "temporarily unavailable" } }, 500);
  });
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(runGenerateHookVideoJob(job, ctx), error => error.code === "provider_operation_pending");
  assert.equal(posts, 1); assert.equal(ctx.operation().provider_operation_id, "accepted");
});

test("WAN collection failure preserves completion and recovers the same task from the production output host", async () => {
  const ctx = context(); let posts = 0; let recovered = false;
  mock.method(globalThis, "fetch", async (url, init) => {
    if (init?.method === "POST") { posts++; return json({ id: "existing-wan" }, 202); }
    if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
      assert.equal(String(url), "https://reapi.ai/api/v1/tasks/existing-wan");
      return json({ id: "existing-wan", status: "completed", output: {
        video_urls: [recovered ? "https://file.deepytb.com/wan.mp4" : "https://untrusted.example/private-token"],
      }, usage: { credits: 495 } });
    }
    assert.equal(String(url), "https://file.deepytb.com/wan.mp4");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    assert.equal(init?.redirect, "error");
    return new Response(video, { headers: { "content-type": "video/mp4" } });
  });
  const wanJob = { ...job, input_json: { ...job.input_json, model: "wan_3_0" } };
  await assert.rejects(runGenerateHookVideoJob(wanJob, ctx), error =>
    error.code === "PROVIDER_OUTPUT_COLLECTION_FAILED" && /output link was not accepted/.test(error.message) && !/private-token/.test(error.message));
  assert.equal(ctx.operation().status, "provider_succeeded");
  assert.equal(ctx.operation().output_url, undefined);
  assert.equal(ctx.operation().metadata.providerCostUsd, .495);
  recovered = true;
  const result = await runGenerateHookVideoJob(wanJob, ctx);
  assert.equal(result.provider, "reapi");
  assert.equal(posts, 1);
  assert.equal(ctx.operation().provider_operation_id, "existing-wan");
  assert.equal(ctx.operation().status, "output_persisted");
  assert.equal(ctx.operation().metadata.providerCostUsd, .495);
});

test("Seedance collection recovery persists the isolated CDN result and original cost using the same paid task", async () => {
  const ctx = context(); let posts = 0; let recovered = false;
  const outputUrl = "https://reapiflexible.b-cdn.net/seedance.mp4?token=private-signed-token";
  mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(init?.redirect, "error");
    if (init?.method === "POST") {
      posts++; assert.equal(JSON.parse(init.body).content_filter, false);
      return json({ id: "existing-seedance" }, 202);
    }
    if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
      assert.equal(String(url), "https://reapi.ai/api/v1/tasks/existing-seedance");
      return json({ id: "existing-seedance", status: "completed", output: {
        video_urls: [recovered ? outputUrl : "https://untrusted.example/private-token"],
      }, usage: { credits: 1281 } });
    }
    assert.equal(String(url), outputUrl);
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return new Response(video, { headers: { "content-type": "video/mp4" } });
  });
  await assert.rejects(runGenerateHookVideoJob(job, ctx), error => error.code === "PROVIDER_OUTPUT_COLLECTION_FAILED");
  assert.equal(ctx.operation().status, "provider_succeeded");
  assert.equal(ctx.operation().metadata.providerCostUsd, 1.281);
  recovered = true;
  const result = await runGenerateHookVideoJob(job, ctx);
  assert.equal(result.provider, "reapi"); assert.equal(posts, 1);
  assert.equal(ctx.operation().provider_operation_id, "existing-seedance");
  assert.equal(ctx.operation().status, "output_persisted");
  assert.equal(ctx.operation().metadata.providerCostUsd, 1.281);
});


test("ReAPI credit and moderation rejections are terminal without provider fallback", async () => {
  for (const [status, errorCode, expectedCode] of [[402, 20001, "PROVIDER_INSUFFICIENT_CREDITS"], [400, 80006, "PROVIDER_CONTENT_MODERATION"]]) {
    const ctx = context(); let posts = 0;
    mock.method(globalThis, "fetch", async (_url, init) => { assert.equal(init?.method, "POST"); posts++; return json({ error: { code: errorCode, message: "private-secret" } }, status); });
    await assert.rejects(runGenerateHookVideoJob(job, ctx), error => error.code === expectedCode);
    assert.equal(posts, 1); assert.equal(ctx.operation().last_error_code, expectedCode); assert.equal(ctx.operation().retry_allowed, false);
    mock.restoreAll();
  }
});
