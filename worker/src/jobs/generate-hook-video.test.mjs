import assert from "node:assert/strict";
import { mock, test } from "node:test";

const received = [];
const referenceAudioCalls = [];
mock.module(new URL("../../dist/lib/explore-generated-reference-audio.js", import.meta.url), { namedExports: {
  applyGeneratedReferenceAudio: async (video, reference) => { referenceAudioCalls.push({ video, reference }); return video; },
} });
const buffer = Buffer.from("fixture-video");
let outputBuffer = buffer;
const uploads = [];
function clip(seconds) {
  const bytes = Buffer.alloc(60);
  bytes.writeUInt32BE(24, 0); bytes.write("ftypmp42", 4);
  bytes.writeUInt32BE(36, 24); bytes.write("moov", 28);
  bytes.writeUInt32BE(28, 32); bytes.write("mvhd", 36);
  bytes.writeUInt32BE(1000, 52); bytes.writeUInt32BE(Math.round(seconds * 1000), 56);
  return bytes;
}
let providerError;
const generate = provider => async params => {
  received.push({ provider, ...params });
  if (providerError) throw providerError;
  await params.onOperationCreated?.("fixture-operation");
  await params.onOperationSucceeded?.("fixture-operation");
  return outputBuffer;
};
for (const [file, name, provider] of [
  ["runway-seedance-video", "generateRunwaySeedanceVideoBuffer", "runway"],
  ["runway-wan-video", "generateRunwayWanVideoBuffer", "runway"],
  ["openrouter-seedance-video", "generateOpenRouterSeedanceVideoBuffer", "openrouter"],
  ["openrouter-wan-video", "generateOpenRouterWanVideoBuffer", "openrouter"],
  ["kling-video", "generateKlingVideoBuffer", "kling"],
  ["gemini-omni-video", "generateGeminiOmniVideoBuffer", "gemini"],
  ["runway-video", "generateRunwayHookVideoBuffer", "runway"],
  ["higgsfield-video", "resumeLegacyHiggsfieldVideoBuffer", "higgsfield"],
  ["veo-video", "generateVeoHookVideoBuffer", "veo"],
]) {
  mock.module(new URL(`../../dist/lib/${file}.js`, import.meta.url), { namedExports: { [name]: generate(provider) } });
}
mock.module(new URL("../../dist/logger.js", import.meta.url), { namedExports: { logger: { info() {}, warn() {} } } });
mock.module(new URL("../../dist/lib/storage.js", import.meta.url), { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async params => { uploads.push(params); return { key: params.key, url: "https://owned-media.example.test/video.mp4" }; },
} });
mock.module(new URL("../../dist/lib/video-output.js", import.meta.url), { namedExports: { assertGeneratedMp4: value => value } });
const { ProviderRequestNotSubmittedError, ProviderSubmissionUncertainError } = await import("../../dist/lib/generation-provider.js");
const { runGenerateHookVideoJob } = await import("../../dist/jobs/generate-hook-video.js");

function fixture(input = {}, shouldSubmit = true) {
  const events = [];
  const record = name => async value => { events.push({ name, ...value }); };
  return {
    events,
    job: { id: "fixture-job", input_json: {
      aspectRatio: "9:16", durationSeconds: 5, hookIdea: "A creator smiles.",
      model: "google_omni", projectId: "ai-studio", userId: "fixture-user",
      videoId: "fixture-video", promptMode: "direct", ...input,
    } },
    context: { checkpoint: async () => {}, store: {
      reserveGenerationProviderOperation: async value => {
        events.push({ name: "reserve", ...value });
        return { shouldSubmit, operation: { status: "reserved", provider_operation_id: null } };
      },
      markGenerationProviderSubmitted: record("submitted"),
      markGenerationProviderSucceeded: record("succeeded"),
      markGenerationProviderFailed: record("failed"),
      markGenerationProviderSubmissionUncertain: record("uncertain"),
      markGenerationOutputPersisted: record("persisted"),
    } },
  };
}

test("WAN multimodal worker dispatch retains every reference and the selected output duration", async () => {
  const inputs = { model: "wan_3_0", provider: "runway", durationSeconds: 3,
    referenceImageUrls: ["https://owned-media.example.test/image.png"],
    referenceAudioUrls: ["https://owned-media.example.test/audio.mp3"], referenceAudioDurationSeconds: [5],
    referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 15 };
  const f = fixture(inputs);
  const output = await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(received.at(-1).provider, "runway"); assert.equal(received.at(-1).model, "wan_3_0");
  assert.deepEqual(received.at(-1).referenceImageUrls, inputs.referenceImageUrls);
  assert.deepEqual(received.at(-1).referenceAudioUrls, inputs.referenceAudioUrls);
  assert.deepEqual(received.at(-1).referenceAudioDurationSeconds, [5]);
  assert.equal(received.at(-1).referenceVideoUrl, inputs.referenceVideoUrl);
  assert.equal(output.durationSeconds, 3, "Input video duration must not replace the chosen output duration");
  const reservation = f.events.find(event => event.name === "reserve");
  assert.equal(reservation.operationKey, "primary-runway");
  const different = fixture({ ...inputs, referenceAudioDurationSeconds: [4] });
  await runGenerateHookVideoJob(different.job, different.context);
  assert.notEqual(different.events.find(event => event.name === "reserve").requestFingerprint, reservation.requestFingerprint);
});

test("both Explore formats apply their selected MP3 to the completed provider result and persist its reference identity", async () => {
  const { getExplorePairedReferences } = await import("../../dist/lib/explore-reference-soundtrack.js");
  for (const format of ["hook", "wall_text"]) {
    const reference = getExplorePairedReferences(format)[0], before = referenceAudioCalls.length;
    const f = fixture({ referenceId: reference.id, referenceType: format, exploreFormat: format });
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(referenceAudioCalls.length, before + 1);
    assert.equal(referenceAudioCalls.at(-1).video, buffer);
    assert.equal(referenceAudioCalls.at(-1).reference.audioSha256, reference.audioSha256);
    assert.deepEqual(output.referenceSoundtrack, { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 });
    assert.equal(f.events.filter(e => e.name === "submitted").length, 1);
  }
});

test("each new eligible Hook reaches the generation soundtrack postprocessor with its exact registered MP3", async () => {
  const { getHookReferenceGalleryItems } = await import("../../dist/lib/explore-hook-reference-release.js");
  const references = getHookReferenceGalleryItems(); assert.equal(references.length, 76);
  for (const reference of references) {
    const before = referenceAudioCalls.length;
    const f = fixture({ referenceId: reference.id, referenceType: "hook", exploreFormat: "hook" });
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(referenceAudioCalls.length, before + 1);
    assert.equal(referenceAudioCalls.at(-1).reference.audioStorageKey, reference.audioStorageKey);
    assert.deepEqual(output.referenceSoundtrack, { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 });
  }
});

test("the actual worker preserves long Omni prompts and their final narration", async () => {
  const prompt = "Describe the complete cinematic scene. ".repeat(500) + 'The creator says: "Keep the final dialogue."';
  for (const avatarImageUrl of [undefined, "https://owned-media.example.test/image.png"]) {
    const f = fixture({ hookIdea: prompt, avatarImageUrl });
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(output.provider, "gemini");
    assert.equal(received.at(-1).prompt, prompt);
    assert.equal(received.at(-1).referenceImageUrl, avatarImageUrl);
    assert.equal(f.events.find(event => event.name === "submitted").providerOperationId, "fixture-operation");
    assert.equal(f.events.at(-1).name, "persisted");
  }
});

test("explicit source-video edits route both inputs to Gemini without changing legacy video routing", async () => {
  const f = fixture({ referenceVideoMode: "edit", referenceVideoUrl: "https://owned-media.example.test/source.mp4",
    referenceVideoDurationSeconds: 6.25, avatarImageUrl: "https://owned-media.example.test/identity.png",
    referenceImageUrls: ["https://owned-media.example.test/identity.png"], hookIdea: "Remove text. ".repeat(150) + "Copy the actions.", durationSeconds: 7 });
  outputBuffer = clip(6.25);
  let output;
  try { output = await runGenerateHookVideoJob(f.job, f.context); }
  finally { outputBuffer = buffer; }
  assert.equal(output.provider, "gemini"); assert.equal(output.durationSeconds, 6.25);
  const submitted = received.at(-1);
  assert.equal(submitted.referenceVideoMode, "edit"); assert.equal(submitted.referenceVideoUrl, f.job.input_json.referenceVideoUrl);
  assert.deepEqual(submitted.referenceImageUrls, f.job.input_json.referenceImageUrls);
  assert.equal(submitted.prompt, f.job.input_json.hookIdea);
  assert.equal(f.events.filter(event => event.name === "reserve").length, 1);
  assert.equal(f.events.find(event => event.name === "reserve").operationKey, "primary-gemini");
});

test("a ten-second source produces a verified ten-second Omni edit and a short result is terminal before storage", async () => {
  const input = { referenceVideoMode: "edit", referenceVideoUrl: "https://owned-media.example.test/source.mp4",
    referenceVideoDurationSeconds: 10, durationSeconds: 10, avatarImageUrl: "https://owned-media.example.test/identity.png" };
  try {
    outputBuffer = clip(10);
    const f = fixture(input);
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(output.durationSeconds, 10);
    assert.equal(f.events.find(event => event.name === "persisted").metadata.durationSeconds, 10);
    assert.equal(received.at(-1).provider, "gemini");
    outputBuffer = clip(3);
    const before = uploads.length, failed = fixture(input);
    await assert.rejects(runGenerateHookVideoJob(failed.job, failed.context), /could not preserve.*duration/);
    assert.equal(uploads.length, before);
    assert.equal(failed.events.find(event => event.name === "failed").retryAllowed, false);
    assert.equal(failed.events.filter(event => event.name === "submitted").length, 1);
  } finally { outputBuffer = buffer; }
});

test("other direct paths reject excess text before reserving a provider operation", async () => {
  const before = received.length;
  for (const input of [
    { model: "seedance_2_5", hookIdea: "x".repeat(10001) },
    { referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 2.8 },
  ]) {
    const f = fixture({ hookIdea: "x".repeat(1001), ...input });
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), /too long for the selected model/);
    assert.deepEqual(f.events, []);
  }
  assert.equal(received.length, before);
});

test("valid video guidance keeps the complete prompt and routes to Runway", async () => {
  const prompt = "x".repeat(1000);
  const f = fixture({ hookIdea: prompt, referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 2.8 });
  const output = await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(output.provider, "runway");
  assert.equal(received.at(-1).prompt, prompt);
});

test("Omni over-limit rejection is recorded as a known failure, not an uncertain paid request", async () => {
  const f = fixture();
  providerError = new ProviderRequestNotSubmittedError("Shorten your prompt.");
  try {
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderRequestNotSubmittedError);
    assert.equal(f.events.find(event => event.name === "failed").retryAllowed, false);
    assert.equal(f.events.some(event => event.name === "uncertain" || event.name === "submitted"), false);
  } finally { providerError = undefined; }
});

test("uncertain provider operations still cannot submit duplicate videos", async () => {
  const f = fixture({}, false);
  const before = received.length;
  await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderSubmissionUncertainError);
  assert.equal(received.length, before);
});
