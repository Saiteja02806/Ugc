import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type RunwayML from "@runwayml/sdk";
import { buildRunwaySeedanceRequest, generateRunwaySeedanceVideoBuffer } from "./runway-seedance-video.js";
import { ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

const base = { aspectRatio: "9:16" as const, durationSeconds: 5, resolution: "720p" as const, prompt: "A creator explains the product" };
const image = "https://storage.example.com/portrait.jpg";
const audio = "https://storage.example.com/voice.mp3";
const video = "https://storage.example.com/reference.mp4";

test("uses Runway Seedance 2.5 for prompt-only generation without truncating the prompt", () => {
  const request = buildRunwaySeedanceRequest({ ...base, prompt: "a".repeat(10_000) });
  assert.equal(request.kind, "text");
  assert.equal(request.input.model, "seedance2_5");
  assert.equal(request.input.promptText?.length, 10_000);
  assert.equal(request.input.duration, 5);
  assert.equal(request.input.audio, true);
});
test("preserves portrait/landscape 480p/720p choices", () => {
  for (const [resolution, aspectRatio, ratio] of [
    ["480p", "9:16", "480:854"], ["480p", "16:9", "854:480"],
    ["720p", "9:16", "720:1280"], ["720p", "16:9", "1280:720"],
  ] as const) assert.equal(buildRunwaySeedanceRequest({ ...base, resolution, aspectRatio }).input.ratio, ratio);
});
test("single image remains a first frame, multiple images remain references", () => {
  const single = buildRunwaySeedanceRequest({ ...base, referenceImageUrl: image });
  assert.equal(single.kind, "image");
  if (single.kind === "image") assert.deepEqual(single.input.promptImage, [{ uri: image, position: "first" }]);
  const images = Array.from({ length: 30 }, (_, i) => `${image}?${i}`);
  const multi = buildRunwaySeedanceRequest({ ...base, referenceImageUrls: images });
  assert.equal(multi.kind, "text");
  if (multi.kind === "text") assert.deepEqual(multi.input.references, images.map((uri) => ({ uri })));
});
test("audio alone and image plus audio retain all inputs", () => {
  for (const images of [[], [image]]) {
    const request = buildRunwaySeedanceRequest({ ...base, referenceImageUrls: images, referenceAudioUrls: [audio] });
    assert.equal(request.kind, "text");
    assert.deepEqual(request.input.referenceAudio, [{ type: "audio", uri: audio }]);
    if (request.kind === "text") assert.deepEqual(request.input.references ?? [], images.map((uri) => ({ uri })));
  }
});
test("video plus images and audio keeps selected duration and resolution", () => {
  const request = buildRunwaySeedanceRequest({ ...base, referenceVideoUrl: video, referenceVideoDurationSeconds: 3, referenceImageUrls: [image], referenceAudioUrls: [audio] });
  assert.equal(request.kind, "video");
  if (request.kind === "video") {
    assert.equal(request.input.mode, "reference");
    assert.equal(request.input.promptVideo, video);
    assert.deepEqual(request.input.references, [{ uri: image }]);
    assert.deepEqual(request.input.referenceAudio, [{ type: "audio", uri: audio }]);
    assert.equal(request.input.duration, 5);
    assert.equal(request.input.ratio, "720:1280");
  }
});
test("invalid requests are rejected before paid submission", () => {
  for (const input of [
    { durationSeconds: 3 }, { durationSeconds: 31 }, { resolution: "1080p" as const },
    { referenceImageUrl: "http://example.com/image.jpg" }, { prompt: "a".repeat(15_001) },
    { referenceAudioUrls: Array(11).fill(audio) }, { referenceImageUrls: Array(31).fill(image) },
    { referenceVideoUrl: video }, { referenceVideoUrl: video, referenceVideoDurationSeconds: 31 },
  ]) assert.throws(() => buildRunwaySeedanceRequest({ ...base, ...input }), ProviderRequestNotSubmittedError);
});

function fakeClient(events: string[], usedCredits = 0) {
  const create = async (input: { model: string }) => { events.push(`create:${input.model}`); return { id: "runway-task" }; };
  return {
    textToVideo: { create }, imageToVideo: { create }, videoToVideo: { create },
    organization: {
      retrieve: async () => { events.push("budget"); return { usage: { models: {} } }; },
      retrieveUsage: async () => ({ results: [{ usedCredits: [{ amount: usedCredits }] }] }),
    },
    tasks: { retrieve: async (id: string) => { events.push(`poll:${id}`); return { status: "SUCCEEDED", output: ["https://storage.example.com/result.mp4"] }; } },
  } as unknown as RunwayML;
}

test("persists the operation before polling and the output before downloading", async () => {
  const events: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async () => { events.push("download"); return new Response("video", { headers: { "Content-Type": "video/mp4" } }); });
  const previousLimit = process.env.RUNWAY_DAILY_CREDIT_LIMIT;
  process.env.RUNWAY_DAILY_CREDIT_LIMIT = "5000";
  try {
    await generateRunwaySeedanceVideoBuffer({ ...base,
      onOperationCreated: async () => { events.push("persist-task"); },
      onOperationSucceeded: async () => { events.push("persist-output"); },
    }, fakeClient(events));
    assert.deepEqual(events, ["budget", "create:seedance2_5", "persist-task", "poll:runway-task", "persist-output", "download"]);
  } finally {
    fetchMock.mock.restore();
    if (previousLimit === undefined) delete process.env.RUNWAY_DAILY_CREDIT_LIMIT; else process.env.RUNWAY_DAILY_CREDIT_LIMIT = previousLimit;
  }
});
test("resumes an accepted task without budget checks or another create call", async () => {
  const events: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("video", { headers: { "Content-Type": "video/mp4" } }));
  try {
    await generateRunwaySeedanceVideoBuffer({ ...base, providerOperationId: "accepted-task",
      onOperationCreated: async () => { throw new Error("Duplicate submission"); }, onOperationSucceeded: async () => {},
    }, fakeClient(events));
    assert.deepEqual(events, ["poll:accepted-task"]);
  } finally { fetchMock.mock.restore(); }
});
test("an exhausted budget is a known non-submission, not uncertain acceptance", async () => {
  const events: string[] = [];
  await assert.rejects(generateRunwaySeedanceVideoBuffer({ ...base,
    onOperationCreated: async () => {}, onOperationSucceeded: async () => {},
  }, fakeClient(events, 1_000_000)), ProviderRequestNotSubmittedError);
  assert.deepEqual(events, ["budget"]);
});

test("a resumed moderation failure retains its reason without creating or downloading another video", async () => {
  const events: string[] = [];
  const client = fakeClient(events);
  const task = {
    id: "rejected-task",
    status: "FAILED",
    failure: "Your request was blocked by this model provider's content moderation system.",
    failureCode: "INPUT_PREPROCESSING.SAFETY.THIRD_PARTY",
  };
  const retrieveMock = mock.method(client.tasks, "retrieve", async (id: string) => {
    events.push(`poll:${id}`);
    return task;
  });
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("A rejected task must not download an output");
  });
  try {
    await assert.rejects(generateRunwaySeedanceVideoBuffer({
      ...base,
      providerOperationId: task.id,
      onOperationCreated: async () => { throw new Error("Duplicate paid submission"); },
      onOperationSucceeded: async () => { throw new Error("A rejected task is not successful"); },
    }, client), (error) => {
      assert.ok(error instanceof ProviderOperationTerminalError);
      assert.equal(error.code, "PROVIDER_CONTENT_MODERATION");
      assert.equal(error.details, task);
      assert.match(error.message, /blocked by .*content moderation system/);
      return true;
    });
    assert.deepEqual(events, ["poll:rejected-task"]);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    retrieveMock.mock.restore();
    fetchMock.mock.restore();
  }
});
