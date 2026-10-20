import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type RunwayML from "@runwayml/sdk";
import { buildRunwayWanRequest, generateRunwayWanVideoBuffer } from "./runway-wan-video.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { estimateRunwayWanCredits } from "./runway-credit-budget.js";

const base = { aspectRatio: "9:16" as const, durationSeconds: 3, resolution: "720p" as const, prompt: "Use the portrait, movement and voice references together." };
const image = "https://storage.example.com/image.png", audio = "https://storage.example.com/audio.mp3", video = "https://storage.example.com/video.mp4";
const references = { referenceImageUrls: [image], referenceAudioUrls: [audio], referenceAudioDurationSeconds: [15], referenceVideoUrl: video, referenceVideoDurationSeconds: 15 };
const callbacks = { onOperationCreated: async () => {}, onOperationSucceeded: async () => {} };

test("WAN reference mode preserves all three modalities together without converting images into keyframes", () => {
  const request = buildRunwayWanRequest({ ...base, ...references });
  assert.equal(request.model, "wan3"); assert.equal(request.duration, 3); assert.equal(request.audio, true);
  assert.equal(request.promptText, base.prompt); assert.equal(request.ratio, "720:1280");
  assert.deepEqual(request.references, [{ uri: image }]);
  assert.deepEqual(request.referenceAudio, [{ type: "audio", uri: audio }]);
  assert.deepEqual(request.referenceVideos, [{ type: "video", uri: video }]);
  assert.equal("promptImage" in request, false);
  assert.equal(buildRunwayWanRequest({ ...base, ...references, durationSeconds: 30 }).duration, 30);
});

test("WAN output duration and all portrait/landscape quality choices are honored", () => {
  for (const [resolution, aspectRatio, ratio] of [
    ["480p", "9:16", "480:832"], ["480p", "16:9", "832:480"],
    ["720p", "9:16", "720:1280"], ["720p", "16:9", "1280:720"],
    ["1080p", "9:16", "1080:1920"], ["1080p", "16:9", "1920:1080"],
  ] as const) for (const durationSeconds of [2, 3, 30]) {
    const request = buildRunwayWanRequest({ ...base, ...references, resolution, aspectRatio, durationSeconds });
    assert.equal(request.ratio, ratio); assert.equal(request.duration, durationSeconds);
  }
  assert.equal(estimateRunwayWanCredits("480p", 3), 15);
  assert.equal(estimateRunwayWanCredits("720p", 3), 30);
  assert.equal(estimateRunwayWanCredits("1080p", 30), 600);
});

test("invalid WAN references fail before any budget read or paid submission", async () => {
  const client = fakeClient([]);
  const read = mock.method(client.organization, "retrieve", async () => assert.fail("No provider access for invalid references"));
  try {
    for (const patch of [{ durationSeconds: 1 }, { durationSeconds: 31 }, { durationSeconds: 3.5 }, { prompt: " " },
      { resolution: "4K" }, { aspectRatio: "1:1" }, { referenceVideoDurationSeconds: 15.01 },
      { referenceVideoDurationSeconds: undefined }, { referenceAudioDurationSeconds: [] },
      { referenceAudioDurationSeconds: [15.01] }, { referenceAudioDurationSeconds: [0] },
      { referenceImageUrls: Array.from({ length: 5 }, (_, i) => `${image}?${i}`) },
      { referenceImageUrls: [image, image] }, { referenceAudioUrls: ["http://example.com/audio.mp3"] },
    ]) {
      await assert.rejects(generateRunwayWanVideoBuffer({ ...base, ...references, ...patch, ...callbacks } as Parameters<typeof generateRunwayWanVideoBuffer>[0], client), ProviderRequestNotSubmittedError);
    }
    assert.equal(read.mock.callCount(), 0);
  } finally { read.mock.restore(); }
});

function fakeClient(events: string[], usedCredits = 0) {
  return {
    organization: { retrieve: async () => { events.push("budget"); return { usage: { models: {} } }; },
      retrieveUsage: async () => ({ results: [{ usedCredits: [{ amount: usedCredits }] }] }) },
    textToVideo: { create: async (request: { model: string }) => { events.push(`create:${request.model}`); return { id: "wan-task" }; } },
    tasks: { retrieve: async (id: string) => { events.push(`poll:${id}`); return { status: "SUCCEEDED", output: ["https://storage.example.com/result.mp4"] }; } },
  } as unknown as RunwayML;
}

test("WAN persists its task before polling and its output before downloading", async () => {
  const events: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async () => { events.push("download"); return new Response("video", { headers: { "content-type": "video/mp4" } }); });
  try {
    await generateRunwayWanVideoBuffer({ ...base, ...references,
      onOperationCreated: async () => { events.push("persist-task"); },
      onOperationSucceeded: async () => { events.push("persist-output"); },
    }, fakeClient(events));
    assert.deepEqual(events, ["budget", "create:wan3", "persist-task", "poll:wan-task", "persist-output", "download"]);
  } finally { fetchMock.mock.restore(); }
});

test("accepted WAN tasks resume without budget checks, reference validation or a duplicate submission", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("video", { headers: { "content-type": "video/mp4" } }));
  try {
    for (const providerOutputUrl of [undefined, "https://storage.example.com/result.mp4"]) {
      const events: string[] = [];
      await generateRunwayWanVideoBuffer({ ...base, ...callbacks, providerOperationId: "accepted-wan", providerOutputUrl,
        onOperationCreated: async () => assert.fail("Do not submit twice"),
      }, fakeClient(events));
      assert.deepEqual(events, providerOutputUrl ? [] : ["poll:accepted-wan"]);
    }
  } finally { fetchMock.mock.restore(); }
});

test("exhausted budget does not create a WAN task", async () => {
  const events: string[] = [];
  await assert.rejects(generateRunwayWanVideoBuffer({ ...base, ...references, ...callbacks }, fakeClient(events, 1_000_000)), ProviderRequestNotSubmittedError);
  assert.deepEqual(events, ["budget"]);
});

test("transient polling and moderation errors keep the accepted WAN task without another generation", async () => {
  for (const failure of ["poll", "moderation"] as const) {
    const events: string[] = [], client = fakeClient(events);
    const taskMock = mock.method(client.tasks, "retrieve", async () => {
      events.push("poll");
      if (failure === "poll") throw new Error("Temporary outage");
      return { id: "accepted-wan", status: "FAILED", failure: "Content policy violation", failureCode: "INPUT_PREPROCESSING.SAFETY.THIRD_PARTY" } as never;
    });
    try {
      await assert.rejects(generateRunwayWanVideoBuffer({ ...base, ...callbacks, providerOperationId: "accepted-wan" }, client), failure === "poll" ? ProviderOperationPollingError : ProviderOperationTerminalError);
      assert.deepEqual(events, ["poll"]);
    } finally { taskMock.mock.restore(); }
  }
});
