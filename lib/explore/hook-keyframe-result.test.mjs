import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, hookKeyframeSnapshotKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import curatedFrames from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
const local = file => new URL(file, import.meta.url);
const OWNER = "owner", JOB = "11111111-1111-4111-8111-111111111111", GENERATED = "22222222-2222-4222-8222-222222222222";
const MAIN = "33333333-3333-4333-8333-333333333333", GENERATION = "44444444-4444-4444-8444-444444444444";
let job, asset, sources, canonical, reads, additionalSources;
mock.method(globalThis, "fetch", async () => assert.fail("No live database, storage or provider calls"));
mock.module(local("../jobs/background-jobs.ts"), { namedExports: { getBackgroundJobForUser: async input => { reads.push(input); return job; } } });
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetForOwner: async input => { reads.push(input); return asset; } } });
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (_url, owner) => { assert.equal(owner, OWNER); return canonical; },
  isTrustedMediaReferenceUrl: url => url.startsWith("https://media.example.test/"),
} });
mock.module(local("../../worker/src/lib/explore-hook-reference-release.ts"), { namedExports: { getHookReferenceReleaseItems: () => sources } });
mock.module(local("./starting-frame-reference-source.ts"), { namedExports: { getAdditionalStartingFrameSources: () => additionalSources } });
const { resolveApprovedHookStartingFrame, resolveOwnedHookKeyframeResult } = await import("./hook-keyframe-result.ts");
const params = { assetId: GENERATED, imageJobId: JOB, ownerId: OWNER };
beforeEach(() => {
  const partial = { ownerId: OWNER, draftId: "55555555-5555-4555-8555-555555555555", referenceId: "hook-15", sourceSha256: "a".repeat(64),
    sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, personImageAssetIds: [MAIN], instructions: "Keep this scene" };
  const receipt = { ...partial, version: 1, purpose: "hook_starting_frame", promptVersion: 1, inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256("Image editing instructions") };
  const url = "https://media.example.test/generated.png", key = "images/generated/owner/hook-starting-frame/image.png", ratio = "9:16";
  const scene = `https://media.example.test/${hookKeyframeSnapshotKey(receipt)}`;
  job = { id: JOB, jobType: "generate_image", userId: OWNER, status: "completed", input: { model: "nano_banana_2", aspectRatio: ratio, prompt: "Image editing instructions",
    generationId: GENERATION, hookKeyframe: receipt, referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.example.test/main.png"] },
    output: { mediaAssetId: GENERATED, generationId: GENERATION, model: "nano_banana_2", key, url, ratio, width: 720, height: 1280, hookKeyframe: receipt } };
  asset = { id: GENERATED, user_id: OWNER, deleted_at: null, status: "ready", collection: "image", source_type: "generated_image", source_record_id: JOB,
    mime_type: "image/png", storage_key: key, url, ratio, width: 720, height: 1280 };
  canonical = url; sources = [{ id: "hook-15", videoSha256: "a".repeat(64) }]; additionalSources = []; reads = [];
});
test("completed starting image is returned only through its owned job and generated asset", async () => {
  const result = await resolveApprovedHookStartingFrame(params);
  assert.equal(result.assetId, GENERATED); assert.equal(result.imageJobId, JOB); assert.equal(result.startingFrameIndex, 0);
  assert.equal(result.imageUrl, canonical); assert.equal(result.receipt.ownerId, OWNER);
  assert.deepEqual(reads, [{ jobId: JOB, userId: OWNER }, { assetId: GENERATED, userId: OWNER }]);
});

test("curated v3 completed images retain their later frame through recovery and animation handoff", async () => {
  const selected = curatedFrames.frames[0];
  const receipt = { ...job.input.hookKeyframe, version: 3, imageModel: "nano_banana_2", promptVersion: 4,
    referenceId: selected.referenceId, sourceSha256: selected.sourceSha256,
    sourceFrame: { index: selected.index, timeSeconds: selected.timeSeconds, width: selected.width, height: selected.height, sha256: selected.sha256 } };
  receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
  job.input.hookKeyframe = receipt; job.output.hookKeyframe = structuredClone(receipt);
  job.input.referenceImageUrl = `https://media.example.test/${hookKeyframeSnapshotKey(receipt)}`;
  job.input.referenceImageUrls[0] = job.input.referenceImageUrl;
  sources = [{ id: selected.referenceId, videoSha256: selected.sourceSha256 }];
  const result = await resolveApprovedHookStartingFrame(params);
  assert.equal(result.startingFrameIndex, selected.index); assert.equal(result.receipt.sourceFrame.timeSeconds, selected.timeSeconds);
  assert.equal((await resolveOwnedHookKeyframeResult(params)).receipt.inputKey, receipt.inputKey);
});

test("a completed model-aware Pro frame can be used, while a different output model cannot satisfy its receipt", async () => {
  const receipt = { ...job.input.hookKeyframe, version: 2, imageModel: "gemini_3_pro", promptVersion: 2 };
  receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
  job.input.model = "gemini_3_pro"; job.input.hookKeyframe = receipt;
  job.output.model = "gemini_3_pro"; job.output.hookKeyframe = structuredClone(receipt);
  const result = await resolveApprovedHookStartingFrame(params);
  assert.equal(result.assetId, GENERATED); assert.equal(result.receipt.imageModel, "gemini_3_pro");
  job.output.model = "nano_banana_2";
  await assert.rejects(resolveApprovedHookStartingFrame(params), /output could not be verified/);
});
test("a receipt alone cannot approve another owner's, generic, altered or unfinished job", async () => {
  const original = structuredClone(job);
  for (const change of [{ userId: "other" }, { jobType: "generate_hook_video" }, { status: "processing" }, { input: { ...original.input, generationId: "not-uuid" } },
    { input: { ...original.input, prompt: "Different instructions" } }, { input: { ...original.input, hookKeyframe: undefined } },
    { input: { ...original.input, model: "seedream_5_pro" } }, { input: { ...original.input, referenceImageUrls: [original.input.referenceImageUrl] } }]) {
    job = { ...structuredClone(original), ...change }; await assert.rejects(resolveOwnedHookKeyframeResult(params));
  }
  job = null; await assert.rejects(resolveOwnedHookKeyframeResult(params), error => error.status === 404);
});
test("output must bind the asset ID, generation, image model and exact preparation receipt", async () => {
  const output = structuredClone(job.output);
  for (const change of [{ mediaAssetId: MAIN }, { generationId: MAIN }, { model: "gpt_image" }, { key: undefined }, { url: undefined },
    { hookKeyframe: undefined }, { hookKeyframe: { ...output.hookKeyframe, instructions: "Changed" } }]) {
    job.output = { ...structuredClone(output), ...change }; await assert.rejects(resolveOwnedHookKeyframeResult(params), error => error.status === 409);
  }
});
test("ordinary portraits and mismatched generated assets cannot be passed off as an approved full scene", async () => {
  const original = structuredClone(asset);
  for (const change of [{ id: MAIN }, { user_id: "other" }, { deleted_at: "now" }, { status: "uploading" }, { collection: "influencer" }, { source_type: "upload" },
    { source_record_id: MAIN }, { mime_type: "image/jpeg" }, { storage_key: "another.png" }, { url: "https://media.example.test/other.png" },
    { width: null }, { height: 0 }, { width: 719 }, { ratio: "4:5" }]) {
    asset = { ...structuredClone(original), ...change }; await assert.rejects(resolveOwnedHookKeyframeResult(params), error => error.status === 409);
  }
});
test("source provenance changes block animation admission while the old owned image remains recoverable", async () => {
  sources[0].videoSha256 = "c".repeat(64);
  assert.equal((await resolveOwnedHookKeyframeResult(params)).assetId, GENERATED);
  await assert.rejects(resolveApprovedHookStartingFrame(params), /source changed/);
  sources = []; await assert.rejects(resolveApprovedHookStartingFrame(params), /source changed/);
});

test("Talking Head and paired Wall source IDs verify through the canonical registry rather than ID prefixes", async () => {
  for (const [referenceId, workflow] of [["talking-car-story", "talking_head"], ["explore-paired-wall_text-fixture", "wall_text"]]) {
    sources = [];
    additionalSources = [{ id: referenceId, workflow, videoSha256: "a".repeat(64) }];
    for (const raw of [job.input.hookKeyframe, job.output.hookKeyframe]) {
      raw.referenceId = referenceId; raw.inputKey = hookKeyframeGenerationInputKey(raw);
    }
    const scene = `https://media.example.test/${hookKeyframeSnapshotKey(job.input.hookKeyframe)}`;
    job.input.referenceImageUrl = scene; job.input.referenceImageUrls[0] = scene;
    const resolved = await resolveApprovedHookStartingFrame(params);
    assert.equal(resolved.workflow, workflow); assert.equal(resolved.exploreFormat, workflow === "wall_text" ? "wall_text" : "hook");
    additionalSources[0].videoSha256 = "f".repeat(64);
    await assert.rejects(resolveApprovedHookStartingFrame(params), /source changed/);
  }
});
test("untrusted delivery URL is rejected even with a completed media record", async () => {
  canonical = "https://foreign.example.test/generated.png";
  await assert.rejects(resolveOwnedHookKeyframeResult(params), /unavailable/);
});
test("a caller cannot use the verifier to query an unrelated job or asset identifier", async () => {
  job.id = MAIN;
  // Owner-scoped stores should enforce IDs, and the verifier independently binds
  // those IDs so a stale/misrouted record cannot authorize a different request.
  await assert.rejects(resolveOwnedHookKeyframeResult(params));
});
