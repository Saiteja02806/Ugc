import assert from "node:assert/strict";
import test from "node:test";
import RunwayML from "@runwayml/sdk";

import { buildSeedreamImageRequest, generateSeedreamImageBuffer } from "./seedream-image.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

const outputUrl = "https://seedream-output.example.test/generated.png";
const image = Buffer.from("offline-image-fixture");
process.env.RUNWAY_DAILY_CREDIT_LIMIT = "100";
const params = { aspectRatio: "9:16" as const, prompt: "A natural adult smartphone portrait.", referenceImageUrl: "https://media.example.test/owned-reference.png" };

function fixture(options: { taskStatus?: string; submitStatus?: number; pollStatus?: number; usedCredits?: number; downloadStatus?: number } = {}) {
  const requests: Array<{ path: string; method: string; headers: Headers; body: unknown }> = [];
  const events: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.body ? JSON.parse(await request.text()) : null;
    requests.push({ path: url.pathname, method: request.method, headers: request.headers, body });
    if (request.url === outputUrl) {
      events.push("download");
      return new Response(image, { status: options.downloadStatus ?? 200, headers: { "content-type": "image/png" } });
    }
    assert.equal(url.origin, "https://api.dev.runwayml.com", "Unexpected network destination");
    switch (url.pathname) {
      case "/v1/organization": return json({ usage: { models: {} } });
      case "/v1/organization/usage": return json({ results: [{ usedCredits: [{ amount: options.usedCredits ?? 0 }] }] });
      case "/v1/text_to_image":
        events.push("create");
        return options.submitStatus ? json({ error: "fixture rejection" }, options.submitStatus) : json({ id: "saved-task" });
      case "/v1/tasks/saved-task":
        events.push("poll");
        return options.pollStatus ? json({ error: "fixture polling failure" }, options.pollStatus) : json({ id: "saved-task", status: options.taskStatus ?? "SUCCEEDED", output: [outputUrl], failure: "fixture failure" });
      default: throw new Error(`Unexpected API request: ${url.pathname}`);
    }
  };
  const client = new RunwayML({ apiKey: "offline-test-key", maxRetries: 0, fetch: fetcher });
  return { client, requests, events, fetcher };
}

test("uses documented Seedream Pro 1K ratios and one output per job without truncating prompts", () => {
  const prompt = "Natural texture, facial asymmetry, relaxed expression. ".repeat(30);
  for (const [aspectRatio, expected] of Object.entries({ "1:1": "1024:1024", "4:5": "896:1184", "9:16": "768:1376", "16:9": "1376:768" })) {
    const request = buildSeedreamImageRequest({ ...params, aspectRatio: aspectRatio as typeof params.aspectRatio, prompt });
    assert.equal(request.model, "seedream5_pro");
    assert.equal(request.ratio, expected);
    assert.equal(request.promptText, prompt.trim());
    assert.equal(request.outputCount, 1);
    assert.equal(request.outputFormat, "png");
    assert.equal(request.grounding, false);
    assert.deepEqual(request.referenceImages, [{ uri: params.referenceImageUrl }]);
  }
  assert.equal("referenceImages" in buildSeedreamImageRequest({ ...params, referenceImageUrl: undefined }), false);
});

test("actual SDK submits Seedream's contract and saves the task before polling or downloading", async (t) => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", f.fetcher);
  const result = await generateSeedreamImageBuffer({ ...params,
    onOperationCreated: async id => { assert.equal(id, "saved-task"); f.events.push("saved"); },
    onOperationSucceeded: async id => { assert.equal(id, "saved-task"); f.events.push("succeeded"); },
  }, f.client);
  assert.deepEqual(result, image);
  assert.deepEqual(f.events, ["create", "saved", "poll", "succeeded", "download"]);
  const post = f.requests.find(request => request.path === "/v1/text_to_image");
  assert.equal(post?.method, "POST");
  assert.deepEqual(post?.body, buildSeedreamImageRequest(params));
  assert.equal(post?.headers.get("authorization"), "Bearer offline-test-key");
  assert.equal(post?.headers.get("x-runway-version"), "2024-11-06");
});

test("resumes a saved task without another credit check or paid POST", async (t) => {
  const f = fixture({ usedCredits: 100 });
  t.mock.method(globalThis, "fetch", f.fetcher);
  await generateSeedreamImageBuffer({ ...params, providerOperationId: "saved-task", onOperationCreated: async () => assert.fail("Task must not be recreated") }, f.client);
  assert.deepEqual(f.events, ["poll", "download"]);
  assert.equal(f.requests.some(request => request.path.startsWith("/v1/organization") || request.path === "/v1/text_to_image"), false);
});

test("invalid input and exhausted budget fail before a paid submission", async () => {
  const f = fixture({ usedCredits: 100 });
  await assert.rejects(generateSeedreamImageBuffer(params, f.client), ProviderRequestNotSubmittedError);
  assert.equal(f.events.length, 0);
  await assert.rejects(generateSeedreamImageBuffer({ ...params, prompt: "x".repeat(4001) }, f.client), ProviderRequestNotSubmittedError);
  await assert.rejects(generateSeedreamImageBuffer({ ...params, referenceImageUrl: "http://example.test/image.png" }, f.client), ProviderRequestNotSubmittedError);
});

test("SDK does not automatically repeat an ambiguous paid submission", async () => {
  const f = fixture({ submitStatus: 502 });
  await assert.rejects(generateSeedreamImageBuffer(params, f.client));
  assert.equal(f.requests.filter(request => request.path === "/v1/text_to_image").length, 1);
});

test("polling outages preserve the saved operation and failed tasks are terminal", async () => {
  const outage = fixture({ pollStatus: 503 });
  await assert.rejects(generateSeedreamImageBuffer({ ...params, providerOperationId: "saved-task" }, outage.client), ProviderOperationPollingError);
  for (const taskStatus of ["FAILED", "CANCELLED"]) {
    const f = fixture({ taskStatus });
    await assert.rejects(generateSeedreamImageBuffer({ ...params, providerOperationId: "saved-task" }, f.client), ProviderOperationTerminalError);
    assert.deepEqual(f.events, ["poll"]);
  }
});

test("a download failure can recover the same succeeded task", async (t) => {
  const f = fixture({ downloadStatus: 503 });
  t.mock.method(globalThis, "fetch", f.fetcher);
  await assert.rejects(generateSeedreamImageBuffer({ ...params, providerOperationId: "saved-task" }, f.client), /download failed/);
  assert.deepEqual(f.events, ["poll", "download"]);
});
