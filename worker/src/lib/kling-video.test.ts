import assert from "node:assert/strict";
import test from "node:test";
import type RunwayML from "@runwayml/sdk";
import { buildKlingVideoRequest, generateKlingVideoBuffer } from "./kling-video.js";
import { ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { resolveHookVideoProvider } from "./hook-video-provider.js";
import { estimateRunwayKlingCredits } from "./runway-credit-budget.js";

const input = { aspectRatio: "9:16" as const, durationSeconds: 3, prompt: "A product on a desk", resolution: "720p" as const };

test("new Kling jobs use Runway while paid legacy Higgsfield jobs retain recovery", () => {
  assert.equal(resolveHookVideoProvider({ model: "kling_3_0" }, null), "runway");
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5" }, null), "runway");
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5" }, { provider_operation_id: "legacy", status: "submitted" }), "higgsfield");
});

test("uses Runway Kling Standard with native audio and both selectable ratios", () => {
  const request = buildKlingVideoRequest(input);
  assert.equal(request.endpoint, "/v1/text_to_video");
  assert.deepEqual(request.input, { model: "kling3.0_standard", promptText: input.prompt, duration: 3, ratio: "720:1280", audio: true });
  assert.equal(buildKlingVideoRequest({ ...input, aspectRatio: "16:9", durationSeconds: 15 }).input.ratio, "1280:720");
  assert.equal(estimateRunwayKlingCredits(3), 39);
  assert.equal(estimateRunwayKlingCredits(15), 195);
});

test("maps one or two images to first and last frames", () => {
  const first = "https://example.com/first.png";
  const last = "https://example.com/last.png";
  assert.deepEqual(buildKlingVideoRequest({ ...input, referenceImageUrl: first }).input.promptImage, [{ uri: first, position: "first" }]);
  const request = buildKlingVideoRequest({ ...input, referenceImageUrls: [first, last] });
  assert.equal(request.endpoint, "/v1/image_to_video");
  assert.deepEqual(request.input.promptImage, [{ uri: first, position: "first" }, { uri: last, position: "last" }]);
});

test("rejects unsupported settings and invalid prompts before paid submission", () => {
  for (const invalid of [
    { durationSeconds: 2 }, { durationSeconds: 16 }, { durationSeconds: 3.5 }, { resolution: "480p" as const },
    { referenceVideoUrl: "https://example.com/video.mp4" }, { referenceAudioUrls: ["https://example.com/audio.wav"] },
    { referenceImageUrls: ["http://example.com/image.png"] },
    { referenceImageUrls: ["https://example.com/1", "https://example.com/2", "https://example.com/3"] },
    { prompt: "x" }, { prompt: "x".repeat(2501) },
  ]) assert.throws(() => buildKlingVideoRequest({ ...input, ...invalid }), ProviderRequestNotSubmittedError);
  assert.equal(buildKlingVideoRequest({ ...input, prompt: "x".repeat(2500) }).input.promptText.length, 2500);
});

function fakeClient(events: string[], usedCredits = 0) {
  return {
    organization: {
      retrieve: async () => { events.push("budget"); return { usage: { models: {} } }; },
      retrieveUsage: async () => ({ results: [{ usedCredits: [{ amount: usedCredits }] }] }),
    },
    post: async (endpoint: string, options: { body: { model: string } }) => { events.push(`submit:${endpoint}:${options.body.model}`); return { id: "paid-request" }; },
    tasks: { retrieve: async (id: string) => { events.push(`poll:${id}`); return { status: "SUCCEEDED", output: ["https://example.com/output.mp4"] }; } },
  } as unknown as RunwayML;
}

test("checks budget, persists the paid request ID before polling, and saves output before downloading", async (t) => {
  const events: string[] = [];
  t.mock.method(globalThis, "fetch", async () => { events.push("download"); return new Response("video", { headers: { "Content-Type": "video/mp4" } }); });
  await generateKlingVideoBuffer({ ...input, onOperationCreated: async () => { events.push("persist"); }, onOperationSucceeded: async () => { events.push("completed"); } }, fakeClient(events));
  assert.deepEqual(events, ["budget", "submit:/v1/text_to_video:kling3.0_standard", "persist", "poll:paid-request", "completed", "download"]);
});

test("resumes the same paid operation or stored output without another submission or budget check", async (t) => {
  const events: string[] = [];
  t.mock.method(globalThis, "fetch", async () => new Response("video", { headers: { "Content-Type": "video/mp4" } }));
  const callbacks = { onOperationCreated: async () => assert.fail("must not submit"), onOperationSucceeded: async () => { events.push("completed"); } };
  await generateKlingVideoBuffer({ ...input, ...callbacks, providerOperationId: "paid-request" }, fakeClient(events));
  assert.deepEqual(events, ["poll:paid-request", "completed"]);
  events.length = 0;
  await generateKlingVideoBuffer({ ...input, ...callbacks, providerOperationId: "paid-request", providerOutputUrl: "https://example.com/output.mp4" }, fakeClient(events));
  assert.deepEqual(events, []);
});

test("budget exhaustion is a known non-submission", async () => {
  const events: string[] = [];
  await assert.rejects(generateKlingVideoBuffer({ ...input, onOperationCreated: async () => {}, onOperationSucceeded: async () => {} }, fakeClient(events, 1_000_000)), ProviderRequestNotSubmittedError);
  assert.deepEqual(events, ["budget"]);
});

test("provider moderation remains terminal without another paid submission", async (t) => {
  const events: string[] = [];
  const client = fakeClient(events);
  t.mock.method(client.tasks, "retrieve", async () => ({ id: "paid-request", status: "FAILED", failure: "Provider content moderation", failureCode: "INPUT_PREPROCESSING.SAFETY.THIRD_PARTY" }));
  await assert.rejects(generateKlingVideoBuffer({ ...input, providerOperationId: "paid-request", onOperationCreated: async () => assert.fail("must not submit"), onOperationSucceeded: async () => assert.fail("must not complete") }, client), ProviderOperationTerminalError);
  assert.deepEqual(events, []);
});
