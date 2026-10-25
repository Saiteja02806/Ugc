import assert from "node:assert/strict";
import { mock, test } from "node:test";
import newBatch from "../lib/explore-hook-reference-new-batch-release.json" with { type: "json" };
mock.module(new URL("../../dist/lib/explore-hook-reference-new-batch-release.json", import.meta.url), { defaultExport: { ...newBatch, mediaStatus: "published", activation: "active" } });

const received = [];
const automaticTextCalls = [];
let automaticTextResult = { blocks: ["Your next video is already drafted"], heading: "", body: "" };
mock.module(new URL("../../dist/lib/automatic-hook-text-worker.js", import.meta.url), { namedExports: {
  generateAutomaticHookText: async (owner, plan) => { automaticTextCalls.push({ owner, plan }); return automaticTextResult; },
} });
const privateReads = [];
mock.module(new URL("../../dist/lib/private-media.js", import.meta.url), { namedExports: {
  resolveOwnedPrivateMediaUrl: async (url, owner) => {
    privateReads.push({ url, owner });
    return url.includes("/approved-start.png") ? `${url}?signed-read=${privateReads.length}` : url;
  },
} });
const referenceAudioCalls = [];
const silenceCalls = [];
mock.module(new URL("../../dist/lib/explore-generated-reference-audio.js", import.meta.url), { namedExports: {
  applyGeneratedReferenceAudio: async (video, reference) => { referenceAudioCalls.push({ video, reference }); return video; },
  silenceGeneratedVideo: async video => { silenceCalls.push(video); return video; },
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
  ["reapi-video", "generateReapiVideoBuffer", "reapi"],
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
const { createGenerationRequestFingerprint, ProviderRequestNotSubmittedError, ProviderSubmissionUncertainError } = await import("../../dist/lib/generation-provider.js");
const { hookKeyframeGenerationInputKey } = await import("../../dist/lib/hook-keyframe-generation-contract.js");
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
      getGenerationProviderOperation: async () => null,
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

function startingFrameInput(patch = {}) {
  const receipt = {
    version: 1, purpose: "hook_starting_frame", ownerId: "fixture-user", draftId: "00000000-0000-4000-8000-000000000001",
    referenceId: "hook-fixture", sourceSha256: "a".repeat(64),
    sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) },
    personImageAssetIds: ["00000000-0000-4000-8000-000000000002"], instructions: "Keep the scene.",
    promptVersion: 1, promptSha256: "c".repeat(64),
  };
  receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
  return { model: "seedance_2_5", provider: "reapi", exploreFormat: "hook", referenceType: "hook", referenceId: "hook-fixture",
    generationIntent: "animate_starting_frame", durationSeconds: 8,
    startingFrameImageUrl: "https://owned-media.example.test/approved-start.png",
    startingFrameAssetId: "00000000-0000-4000-8000-000000000003",
    startingFrameJobId: "00000000-0000-4000-8000-000000000004", startingFrameReceipt: receipt,
    hookIdea: "Animate the approved starting image into an 8-second video. Raise the eyebrows and hold a smile.", ...patch };
}

test("first-frame worker dispatch preserves one owned frame, fixed duration and silence without replaying portrait or source inputs", async () => {
  const beforeMusic = referenceAudioCalls.length, beforeSilence = silenceCalls.length, beforeReads = privateReads.length;
  const f = fixture(startingFrameInput());
  const output = await runGenerateHookVideoJob(f.job, f.context);
  const request = received.at(-1);
  assert.equal(request.provider, "reapi"); assert.equal(request.model, "seedance_2_5");
  assert.match(request.startingFrameImageUrl, /\/approved-start\.png\?signed-read=/);
  assert.deepEqual(privateReads.slice(beforeReads), [{ url: f.job.input_json.startingFrameImageUrl, owner: "fixture-user" }]);
  assert.equal(request.durationSeconds, 8); assert.equal(output.durationSeconds, 8);
  assert.equal(request.generateAudio, false); assert.equal(output.generateAudio, false);
  assert.equal(request.referenceImageUrl, undefined); assert.deepEqual(request.referenceImageUrls, []);
  assert.deepEqual(request.referenceAudioUrls, []); assert.equal(request.referenceVideoUrl, undefined);
  assert.equal(request.referenceVideoMode, undefined); assert.equal(request.prompt, f.job.input_json.hookIdea);
  assert.equal(referenceAudioCalls.length, beforeMusic); assert.equal(silenceCalls.length, beforeSilence + 1);
  assert.equal(f.events.filter(event => event.name === "reserve").length, 1);
  assert.equal(f.events.find(event => event.name === "reserve").operationKey, "primary-reapi");
});

test("Omni and WAN starting-frame jobs dispatch only to their frozen provider and recover without another paid submission", async () => {
  for (const [model, provider] of [["google_omni", "gemini"], ["wan_3_0", "reapi"]]) {
    const input = startingFrameInput({ model, provider, generateAudio: false });
    const f = fixture(input); await runGenerateHookVideoJob(f.job, f.context);
    const sent = received.at(-1);
    assert.equal(sent.provider, provider); assert.equal(sent.model, model);
    assert.ok(sent.startingFrameImageUrl); assert.deepEqual(sent.referenceImageUrls, []); assert.equal(sent.referenceVideoUrl, undefined);
    const fingerprint = f.events.find(event => event.name === "reserve").requestFingerprint;
    const recovering = fixture(input, false), reads = privateReads.length;
    recovering.context.store.reserveGenerationProviderOperation = async value => {
      recovering.events.push({ name: "reserve", ...value });
      return { shouldSubmit: false, operation: { status: "submitted", provider_operation_id: `${model}-existing-task` } };
    };
    await runGenerateHookVideoJob(recovering.job, recovering.context);
    assert.equal(received.at(-1).providerOperationId, `${model}-existing-task`);
    assert.equal(privateReads.length, reads);
    assert.equal(recovering.events.find(event => event.name === "reserve").requestFingerprint, fingerprint);
  }
});

test("three-second starting-frame jobs reach Omni and WAN without changing the frozen request length", async () => {
  for (const [model, provider] of [["google_omni", "gemini"], ["wan_3_0", "reapi"]]) {
    const f = fixture(startingFrameInput({ model, provider, durationSeconds: 3 }));
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(received.at(-1).durationSeconds, 3); assert.equal(output.durationSeconds, 3);
  }
});

test("first-frame operations fingerprint canonical input and recover accepted tasks without refreshing private references", async () => {
  const input = startingFrameInput({ generateAudio: true });
  const initial = fixture(input), repeated = fixture(input);
  await runGenerateHookVideoJob(initial.job, initial.context);
  const initialSigned = received.at(-1).startingFrameImageUrl;
  await runGenerateHookVideoJob(repeated.job, repeated.context);
  assert.notEqual(received.at(-1).startingFrameImageUrl, initialSigned);
  const fingerprint = events => events.find(event => event.name === "reserve").requestFingerprint;
  assert.equal(fingerprint(initial.events), fingerprint(repeated.events));
  const beforeReads = privateReads.length, beforeSilence = silenceCalls.length;
  const recovering = fixture(input, false);
  recovering.context.store.reserveGenerationProviderOperation = async value => {
    recovering.events.push({ name: "reserve", ...value });
    return { shouldSubmit: false, operation: { status: "provider_succeeded", provider_operation_id: "existing-frame-task", output_url: "https://cdn.reapi.ai/completed.mp4" } };
  };
  await runGenerateHookVideoJob(recovering.job, recovering.context);
  assert.equal(fingerprint(recovering.events), fingerprint(initial.events));
  assert.equal(received.at(-1).providerOperationId, "existing-frame-task");
  assert.equal(received.at(-1).providerOutputUrl, "https://cdn.reapi.ai/completed.mp4");
  assert.equal(received.at(-1).startingFrameImageUrl, input.startingFrameImageUrl);
  assert.equal(received.at(-1).generateAudio, true);
  assert.equal(privateReads.length, beforeReads); assert.equal(silenceCalls.length, beforeSilence);
});

test("Omni starting-frame face references preserve order, private ownership and frozen recovery fingerprints", async () => {
  const photos = ["https://owned-media.example.test/main.png", "https://owned-media.example.test/support.png"];
  const input = startingFrameInput({ model: "google_omni", provider: "gemini", durationSeconds: 3, referenceImageUrls: photos,
    personReference: { version: 1, mainImageUrl: photos[0], supportingImageUrls: photos.slice(1) } });
  const beforeReads = privateReads.length, initial = fixture(input);
  initial.job.user_id = "fixture-user";
  await runGenerateHookVideoJob(initial.job, initial.context);
  assert.deepEqual(received.at(-1).referenceImageUrls, photos); assert.equal(received.at(-1).durationSeconds, 3);
  assert.deepEqual(privateReads.slice(beforeReads).map(read => read.owner), ["fixture-user", "fixture-user", "fixture-user"]);
  const fingerprint = initial.events.find(event => event.name === "reserve").requestFingerprint;
  const reversed = fixture({ ...input, referenceImageUrls: photos.toReversed(), personReference: { version: 1, mainImageUrl: photos[1], supportingImageUrls: [photos[0]] } });
  reversed.job.user_id = "fixture-user";
  await runGenerateHookVideoJob(reversed.job, reversed.context);
  assert.notEqual(reversed.events.find(event => event.name === "reserve").requestFingerprint, fingerprint);
  const recovering = fixture(input, false), reads = privateReads.length;
  recovering.job.user_id = "fixture-user";
  recovering.context.store.reserveGenerationProviderOperation = async value => {
    recovering.events.push({ name: "reserve", ...value });
    return { shouldSubmit: false, operation: { status: "submitted", provider_operation_id: "existing-omni-faces" } };
  };
  await runGenerateHookVideoJob(recovering.job, recovering.context);
  assert.equal(received.at(-1).providerOperationId, "existing-omni-faces"); assert.deepEqual(received.at(-1).referenceImageUrls, photos);
  assert.equal(privateReads.length, reads); assert.equal(recovering.events.find(event => event.name === "reserve").requestFingerprint, fingerprint);
});

test("starting-frame face roles and model compatibility are checked before reserving provider operations", async () => {
  const photos = ["https://owned-media.example.test/main.png"];
  for (const patch of [
    { model: "wan_3_0", provider: "reapi" }, { model: "seedance_2_5", provider: "reapi" },
    { personReference: undefined }, { personReference: { version: 1, mainImageUrl: photos[0], supportingImageUrls: [photos[0]] } },
    { referenceImageUrls: ["https://owned-media.example.test/approved-start.png"], personReference: { version: 1, mainImageUrl: "https://owned-media.example.test/approved-start.png", supportingImageUrls: [] } },
    { referenceImageUrls: Array.from({ length: 6 }, (_, i) => `https://owned.test/face-${i}.png`) },
  ]) {
    const f = fixture(startingFrameInput({ model: "google_omni", provider: "gemini", referenceImageUrls: photos,
      personReference: { version: 1, mainImageUrl: photos[0], supportingImageUrls: [] }, ...patch }));
    f.job.user_id = "fixture-user";
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderRequestNotSubmittedError);
    assert.deepEqual(f.events, []);
  }
  const missingOwner = fixture(startingFrameInput({ model: "google_omni", provider: "gemini", referenceImageUrls: photos,
    personReference: { version: 1, mainImageUrl: photos[0], supportingImageUrls: [] } }));
  await assert.rejects(runGenerateHookVideoJob(missingOwner.job, missingOwner.context), ProviderRequestNotSubmittedError);
  assert.deepEqual(missingOwner.events, []);
});

test("malformed or mixed first-frame worker input rejects before reserving a paid operation", async () => {
  const before = received.length;
  for (const patch of [
    { provider: "runway" }, { model: "google_omni" }, { model: "wan_3_0", provider: "gemini" }, { exploreFormat: "unsupported" }, { generationIntent: "replace_face" },
    { startingFrameAssetId: undefined }, { startingFrameJobId: undefined }, { startingFrameReceipt: null },
    { referenceId: "another-hook" }, { durationSeconds: 16 }, { durationSeconds: 3 },
    { avatarImageUrl: "https://owned-media.example.test/portrait.png" },
    { referenceImageUrls: ["https://owned-media.example.test/portrait.png"] },
    { referenceAudioUrls: ["https://owned-media.example.test/music.mp3"] },
    { referenceVideoUrl: "https://owned-media.example.test/source.mp4" },
    { personReference: { mainImageUrl: "https://owned-media.example.test/portrait.png" } },
    { generateAudio: "false" },
  ]) {
    const f = fixture(startingFrameInput(patch));
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderRequestNotSubmittedError, JSON.stringify(patch));
    assert.deepEqual(f.events, [], JSON.stringify(patch));
  }
  const wrongOwner = fixture(startingFrameInput());
  wrongOwner.job.user_id = "another-owner";
  await assert.rejects(runGenerateHookVideoJob(wrongOwner.job, wrongOwner.context), ProviderRequestNotSubmittedError);
  assert.deepEqual(wrongOwner.events, []);
  assert.equal(received.length, before);
});

test("first-frame jobs never silently migrate to a legacy provider operation", async () => {
  const f = fixture(startingFrameInput()), before = received.length;
  f.context.store.getGenerationProviderOperation = async () => ({ status: "submitted", provider_operation_id: "legacy-task" });
  await assert.rejects(runGenerateHookVideoJob(f.job, f.context), /cannot change its saved model\/provider route/);
  assert.equal(received.length, before); assert.deepEqual(f.events, []);
});

test("legacy direct jobs keep their established request fingerprint without new first-frame fields", async () => {
  const f = fixture();
  await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(f.events.find(event => event.name === "reserve").requestFingerprint, createGenerationRequestFingerprint({
    aspectRatio: "9:16", durationSeconds: 5, model: "google_omni", prompt: "A creator smiles.", provider: "gemini", resolution: "720p",
    referenceImageUrl: undefined, referenceImageUrls: [], referenceVideoDurationSeconds: null, referenceVideoUrl: null, videoId: "fixture-video",
  }));
});

test("WAN multimodal worker dispatch retains every reference and the selected output duration", async () => {
  const inputs = { model: "wan_3_0", provider: "reapi", durationSeconds: 3,
    referenceImageUrls: ["https://owned-media.example.test/image.png"],
    referenceAudioUrls: ["https://owned-media.example.test/audio.mp3"], referenceAudioDurationSeconds: [5],
    referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 15 };
  const f = fixture(inputs);
  const output = await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(received.at(-1).provider, "reapi"); assert.equal(received.at(-1).model, "wan_3_0");
  assert.deepEqual(received.at(-1).referenceImageUrls, inputs.referenceImageUrls);
  assert.deepEqual(received.at(-1).referenceAudioUrls, inputs.referenceAudioUrls);
  assert.deepEqual(received.at(-1).referenceAudioDurationSeconds, [5]);
  assert.equal(received.at(-1).referenceVideoUrl, inputs.referenceVideoUrl);
  assert.equal(output.durationSeconds, 3, "Input video duration must not replace the chosen output duration");
  const reservation = f.events.find(event => event.name === "reserve");
  assert.equal(reservation.operationKey, "primary-reapi");
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

test("explicit sound controls supersede gallery music and distinguish provider operations", async () => {
  const { getExplorePairedReferences } = await import("../../dist/lib/explore-reference-soundtrack.js");
  for (const format of ["hook", "wall_text"]) {
    const reference = getExplorePairedReferences(format)[0];
    const fingerprints = [];
    for (const generateAudio of [undefined, false, true]) {
      const priorSilence = silenceCalls.length, priorMusic = referenceAudioCalls.length;
      const f = fixture({ referenceId: reference.id, referenceType: format, exploreFormat: format, ...(generateAudio === undefined ? {} : { generateAudio }) });
      const output = await runGenerateHookVideoJob(f.job, f.context);
      assert.equal(received.at(-1).generateAudio, generateAudio);
      assert.equal(output.generateAudio, generateAudio);
      assert.equal(silenceCalls.length - priorSilence, generateAudio === false ? 1 : 0);
      assert.equal(referenceAudioCalls.length - priorMusic, generateAudio === undefined ? 1 : 0);
      if (generateAudio !== undefined) assert.equal(output.referenceSoundtrack, undefined);
      fingerprints.push(f.events.find(event => event.name === "reserve").requestFingerprint);
    }
    assert.equal(new Set(fingerprints).size, 3);
  }
});

test("each eligible Hook reaches audio postprocessing and silent references omit automatic soundtrack receipts", async () => {
  const { getHookReferenceGalleryItems } = await import("../../dist/lib/explore-hook-reference-release.js");
  const references = getHookReferenceGalleryItems(); assert.equal(references.length, 104);
  for (const reference of references) {
    const before = referenceAudioCalls.length;
    const f = fixture({ referenceId: reference.id, referenceType: "hook", exploreFormat: "hook" });
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(referenceAudioCalls.length, before + 1);
    assert.equal(referenceAudioCalls.at(-1).reference.audioStorageKey, reference.audioStorageKey);
    if (reference.audioPolicy === "silent") {
      assert.ok(["explore-paired-hook-ef59f4b5e69bc9e125f8ada7", "explore-paired-hook-4f4ca22ed141ee115d1eb913", "explore-paired-hook-bfd6368d9fc52f44c6422a2b"].includes(reference.id));
      assert.equal(referenceAudioCalls.at(-1).reference.audioPolicy, "silent");
      assert.equal(output.referenceSoundtrack, undefined);
    } else assert.deepEqual(output.referenceSoundtrack, { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 });
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

test("decimal Hook and Wall edit outputs keep measured source length and reject rounded replacements", async () => {
  try {
    for (const [exploreFormat, seconds] of [["hook", 3.7], ["wall_text", 6.7]]) {
      const input = { exploreFormat, referenceVideoMode: "edit", referenceVideoUrl: "https://owned-media.example.test/source.mp4",
        referenceVideoDurationSeconds: seconds, durationSeconds: Math.ceil(seconds),
        hookIdea: "Reference actions.\n\nUser instructions.", avatarImageUrl: "https://owned-media.example.test/identity.png" };
      outputBuffer = clip(seconds);
      const f = fixture(input), result = await runGenerateHookVideoJob(f.job, f.context);
      assert.equal(result.durationSeconds, seconds);
      assert.equal(f.events.find(event => event.name === "persisted").metadata.durationSeconds, seconds);
      assert.equal(received.at(-1).prompt, input.hookIdea);
      outputBuffer = clip(Math.ceil(seconds));
      const before = uploads.length, failed = fixture(input);
      await assert.rejects(runGenerateHookVideoJob(failed.job, failed.context), /could not preserve.*duration/);
      assert.equal(uploads.length, before);
    }
  } finally { outputBuffer = buffer; }
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

test("completed Hook jobs carry fitted editable text for the exact output, including recovery", async () => {
  const plan = { version: 1, requestKey: "11111111-1111-4111-8111-111111111111", source: { format: "hook", status: "ready", referenceId: "hook-fixture", blocks: [{ text: "Your next video is already drafted", startMs: 0, endMs: 4000 }] } };
  const f = fixture({ automaticHookText: plan, exploreFormat: "hook", referenceId: "hook-fixture" }); f.job.user_id = "fixture-user";
  const output = await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(output.automaticHookText.status, "ready");
  assert.equal(output.automaticHookText.editing.textOverlays[0].value, automaticTextResult.blocks[0]);
  assert.equal(output.automaticHookText.editing.textOverlays[0].endMs, output.durationSeconds * 1000);
  assert.equal(output.videoId, f.job.input_json.videoId); assert.equal(automaticTextCalls.at(-1).owner, "fixture-user");
  const previous = automaticTextResult; automaticTextResult = null;
  try { const noText = await runGenerateHookVideoJob(f.job, f.context); assert.equal(noText.ok, true); assert.equal(noText.automaticHookText.status, "needs_review"); }
  finally { automaticTextResult = previous; }
  const before = automaticTextCalls.length; f.job.user_id = "other";
  await assert.rejects(runGenerateHookVideoJob(f.job, f.context), /could not be verified/); assert.equal(automaticTextCalls.length, before);
});
