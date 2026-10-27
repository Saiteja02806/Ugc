import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, hookKeyframeSnapshotKey } from "../../dist/lib/hook-keyframe-generation-contract.js";
import { creatorSceneCanonicalUrl, verifyCreatorSceneDelivery } from "../../dist/lib/creator-scene-delivery.js";
import creatorFrames from "../../dist/lib/creator-source-frames.json" with { type: "json" };
const local = file => new URL(file, import.meta.url);
const calls = [], storedImage = Buffer.from("generated fixture pixels"); let existingOutput;
mock.method(globalThis, "fetch", async () => assert.fail("No paid providers, database or storage network calls"));
mock.module(local("../../dist/lib/private-media.js"), { namedExports: { resolveOwnedPrivateMediaUrl: async (url, owner) => { calls.push({ resolved: url, owner }); return url; } } });
mock.module(local("../../dist/lib/openai-image.js"), { namedExports: { SLIDESHOW_IMAGE_MODEL: "gpt-fixture", SLIDESHOW_FLARE_IMAGE_MODEL: "flare-fixture", generateOpenAiImageBuffer: async () => assert.fail("Wrong provider") } });
mock.module(local("../../dist/lib/gemini-image.js"), { namedExports: {
  GEMINI_3_PRO_IMAGE_MODEL: "gemini-3-pro-image", generateGemini3ProImageBuffer: async input => {
    calls.push({ proPaid: input }); await input.onOperationCreated("pro-operation"); await input.onOperationSucceeded("pro-operation"); return storedImage;
  },
  generateGeminiImageBuffer: async (prompt, ratio, references, hookKeyframe) => { calls.push({ paid: { prompt, ratio, references, hookKeyframe } }); return { buffer: storedImage, model: "nano-fixture", requestId: "image-operation" }; },
} });
mock.module(local("../../dist/lib/seedream-image.js"), { namedExports: { SEEDREAM_5_PRO_IMAGE_MODEL: "seedream-fixture", generateSeedreamImageBuffer: async () => assert.fail("Wrong provider") } });
mock.module(local("../../dist/lib/openrouter-seedream-image.js"), { namedExports: { generateOpenRouterSeedreamImage: async () => assert.fail("Wrong provider") } });
mock.module(local("../../dist/lib/image-output.js"), { namedExports: {
  AI_STUDIO_IMAGE_RATIO: "9:16", AI_STUDIO_IMAGE_RATIOS: ["9:16", "16:9", "4:5", "1:1"], getAIStudioImageDimensions: () => ({ width: 720, height: 1280 }),
  prepareAIStudioImageOutput: async (buffer, ratio, options) => { calls.push({ prepare: { ratio, options } }); return buffer; },
} });
mock.module(local("../../dist/lib/storage.js"), { namedExports: {
  getStoredObject: async key => existingOutput ? { key, url: `https://media.test/${key}` } : null,
  downloadStoredObjectBuffer: async () => storedImage,
  uploadBufferToStorage: async input => { calls.push({ upload: input.key }); return { key: input.key, url: `https://media.test/${input.key}` }; },
} });
const { runGenerateImageJob } = await import("../../dist/jobs/generate-image.js");
const context = { checkpoint: async () => {}, store: {
  reserveGenerationProviderOperation: async input => { calls.push({ reserve: input }); return { shouldSubmit: true, operation: { status: "reserved", metadata: {} } }; },
  markGenerationProviderSubmitted: async () => {}, markGenerationProviderSucceeded: async () => {}, markGenerationOutputPersisted: async () => {},
} };
function job() {
  const prompt = "Image 1 supplies the scene. Image 2 supplies the main face; Image 3 supplies supporting facial detail. Preserve the scene and edit facial appearance only.";
  const partial = { ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: "hook-15", sourceSha256: "a".repeat(64),
    sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) },
    personImageAssetIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"], instructions: "Keep the scene." };
  const receipt = { ...partial, version: 1, purpose: "hook_starting_frame", promptVersion: 1, inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
  const scene = `https://media.test/${hookKeyframeSnapshotKey(receipt)}`;
  return { id: "hook-image-job", user_id: "owner", project_id: "hook-starting-frame", input_json: {
    generationId: "44444444-4444-4444-8444-444444444444", exploreFormat: "hook", model: "nano_banana_2", aspectRatio: "9:16", prompt,
    referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png", "https://media.test/support.png"], hookKeyframe: receipt,
  } };
}
const count = key => calls.filter(call => key in call).length;
beforeEach(() => { calls.length = 0; existingOutput = false; });
test("Hook image stage sends scene/main/support in exact order with only its compiled image instructions", async () => {
  const input = job(), output = await runGenerateImageJob(input, context), received = calls.find(call => call.paid).paid;
  assert.equal(received.prompt, input.input_json.prompt); assert.equal(received.ratio, "9:16"); assert.deepEqual(received.references, input.input_json.referenceImageUrls);
  assert.deepEqual(calls.filter(call => call.resolved).map(call => ({ url: call.resolved, owner: call.owner })), input.input_json.referenceImageUrls.map(url => ({ url, owner: "owner" })));
  assert.deepEqual(calls.find(call => call.prepare).prepare.options, { preserveComposition: true });
  assert.deepEqual(output.hookKeyframe, input.input_json.hookKeyframe); assert.equal(output.model, "nano_banana_2"); assert.equal(output.effectivePrompt, received.prompt);
  assert.equal(count("paid"), 1); assert.equal(count("reserve"), 1);
});

test("private creator scene links are freshly signed for both Gemini paths while durable jobs retain canonical provenance", async () => {
  process.env.CREATOR_REFERENCE_SIGNING_SECRET = "a-private-test-secret-with-at-least-32-characters";
  for (const model of ["nano_banana_2", "gemini_3_pro"]) {
    calls.length = 0;
    const input = job(), body = input.input_json;
    body.model = model; body.hookKeyframe.version = 2; body.hookKeyframe.imageModel = model;
    body.hookKeyframe.promptVersion = 4; body.hookKeyframe.referenceId = "creator-account-1-01";
    body.hookKeyframe.inputKey = hookKeyframeGenerationInputKey(body.hookKeyframe);
    body.referenceImageUrl = body.referenceImageUrls[0] = creatorSceneCanonicalUrl(body.hookKeyframe);
    const canonical = body.referenceImageUrl;
    await runGenerateImageJob(input, context);
    const received = model === "nano_banana_2" ? calls.find(call => call.paid).paid.references : calls.find(call => call.proPaid).proPaid.referenceImageUrls;
    assert.ok(verifyCreatorSceneDelivery(new URL(received[0])));
    assert.deepEqual(received.slice(1), body.referenceImageUrls.slice(1));
    assert.equal(body.referenceImageUrl, canonical); assert.equal(new URL(body.referenceImageUrl).search, "");
  }
  delete process.env.CREATOR_REFERENCE_SIGNING_SECRET;
});
test("Wall starting-image jobs accept the same verified scene/person contract from their own workflow", async () => {
  const input = job(); input.input_json.exploreFormat = "wall_text";
  const output = await runGenerateImageJob(input, context);
  assert.deepEqual(output.hookKeyframe, input.input_json.hookKeyframe);
  assert.equal(count("paid"), 1); assert.equal(count("reserve"), 1);
});
test("altered, incompatible or collided input roles fail before any provider reservation", async () => {
  for (const change of [{ model: "gpt_image" }, { exploreFormat: "slideshow" }, { prompt: "Unbound prompt" }, { aspectRatio: "4:5" },
    { hookKeyframe: null }, { slideshowReferenceContract: {} }, { characterSource: "ugc-pilot-characters" }, { additionalReferenceStartIndex: 2 },
    { subjectReferenceIndex: 2 }, { slideshowBusinessContext: {} }, { regenerationReferenceIndex: 2 }]) {
    const input = job(); Object.assign(input.input_json, change); await assert.rejects(runGenerateImageJob(input, context));
  }
  const foreign = job(); foreign.user_id = "other"; await assert.rejects(runGenerateImageJob(foreign, context));
  const swapped = job(); swapped.input_json.referenceImageUrls.reverse(); await assert.rejects(runGenerateImageJob(swapped, context));
  const stale = job(); stale.input_json.referenceImageUrls[0] = stale.input_json.referenceImageUrl = "https://media.test/unbound-scene.png";
  await assert.rejects(runGenerateImageJob(stale, context));
  assert.equal(count("reserve"), 0); assert.equal(count("paid"), 0);
});
test("complete Hook image provenance and ordered identity references are included in the durable provider fingerprint", async () => {
  const input = job(); await runGenerateImageJob(input, context);
  const original = calls.find(call => call.reserve).reserve.requestFingerprint;
  const receipt = input.input_json.hookKeyframe; receipt.personImageAssetIds.reverse(); receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
  const urls = input.input_json.referenceImageUrls; [urls[1], urls[2]] = [urls[2], urls[1]];
  await runGenerateImageJob(input, context);
  assert.notEqual(calls.filter(call => call.reserve).at(-1).reserve.requestFingerprint, original);
});
test("recovering an already stored starting image preserves its receipt without a second provider submission", async () => {
  existingOutput = true; const input = job(), output = await runGenerateImageJob(input, context);
  assert.deepEqual(output.hookKeyframe, input.input_json.hookKeyframe); assert.equal(output.generationId, input.input_json.generationId);
  assert.equal(count("reserve"), 0); assert.equal(count("paid"), 0); assert.equal(count("upload"), 0);
});

test("only new Hook V2 jobs opt into bound labels and verified scene bytes; legacy wire requests and recovery remain unchanged", async () => {
  const legacy = job();
  await runGenerateImageJob(legacy, context);
  const legacyRequest = calls.find(call => call.paid).paid;
  assert.equal(legacyRequest.hookKeyframe, undefined);
  const legacyFingerprint = calls.find(call => call.reserve).reserve.requestFingerprint;
  calls.length = 0;
  const upgraded = job(); upgraded.input_json.hookKeyframe.promptVersion = 2;
  await runGenerateImageJob(upgraded, context);
  assert.deepEqual(calls.find(call => call.paid).paid.hookKeyframe, upgraded.input_json.hookKeyframe);
  assert.notEqual(calls.find(call => call.reserve).reserve.requestFingerprint, legacyFingerprint);
  calls.length = 0; existingOutput = true;
  await runGenerateImageJob(legacy, context);
  assert.equal(count("paid"), 0); assert.equal(count("reserve"), 0);
});

test("new model-aware Pro and Flash jobs route separately and bind model, role contract and edge policy", async () => {
  for (const promptVersion of [2, 3, 4]) {
  for (const model of ["gemini_3_pro", "nano_banana_2"]) {
    calls.length = 0;
    const input = job(); input.input_json.model = model;
    const receipt = input.input_json.hookKeyframe;
    receipt.version = 2; receipt.promptVersion = promptVersion; receipt.imageModel = model;
    receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
    const output = await runGenerateImageJob(input, context);
    if (model === "gemini_3_pro") {
      assert.equal(count("paid"), 0); assert.equal(count("proPaid"), 1);
      assert.deepEqual(calls.find(call => call.proPaid).proPaid.hookKeyframe, receipt);
      assert.deepEqual(calls.find(call => call.proPaid).proPaid.referenceImageUrls, input.input_json.referenceImageUrls);
    } else { assert.equal(count("paid"), 1); assert.equal(count("proPaid"), 0); assert.deepEqual(calls.find(call => call.paid).paid.hookKeyframe, receipt); }
    assert.deepEqual(calls.find(call => call.prepare).prepare.options, { preserveComposition: true, cropNearRatioPadding: true });
    assert.equal(output.model, model);
  }
  }
});


test("v4 private full recreation signs both opening and clarity before provider submission", async () => {
  process.env.CREATOR_REFERENCE_SIGNING_SECRET = "a-private-test-secret-with-at-least-32-characters";
  try {
    for (const model of ["nano_banana_2", "gemini_3_pro"]) {
      calls.length = 0;
      const input = job(), body = input.input_json, frame = creatorFrames.frames.find(f => f.index > 0);
      body.model = model;
      const receipt = body.hookKeyframe;
      Object.assign(receipt, { version: 4, imageModel: model, promptVersion: 5, referenceId: frame.referenceId, sourceSha256: frame.sourceSha256,
        sourceFrame: { index: frame.index, timeSeconds: frame.timeSeconds, sha256: frame.sha256, width: frame.width, height: frame.height },
        animationOpeningFrame: { index: 0, timeSeconds: 0, sha256: "c".repeat(64), width: frame.width, height: frame.height } });
      receipt.preparationInputKey = JSON.stringify({version:3,ownerId:receipt.ownerId,draftId:receipt.draftId,referenceId:receipt.referenceId,sourceSha256:receipt.sourceSha256,sourceFrame:receipt.sourceFrame,imageAssetIds:receipt.personImageAssetIds,instructions:receipt.instructions,imageModel:model});
      receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
      body.referenceImageUrl = creatorSceneCanonicalUrl(receipt, "opening");
      body.referenceImageUrls = [body.referenceImageUrl, creatorSceneCanonicalUrl(receipt), "https://media.test/main.png", "https://media.test/support.png"];
      const canonical = [...body.referenceImageUrls];
      await runGenerateImageJob(input, context);
      const received = model === "nano_banana_2" ? calls.find(call => call.paid).paid.references : calls.find(call => call.proPaid).proPaid.referenceImageUrls;
      assert.equal(verifyCreatorSceneDelivery(new URL(received[0])).frameSha256, receipt.animationOpeningFrame.sha256);
      assert.equal(verifyCreatorSceneDelivery(new URL(received[1])).frameSha256, frame.sha256);
      assert.deepEqual(received.slice(2), canonical.slice(2));
      assert.deepEqual(body.referenceImageUrls, canonical, "Frozen job retains unsigned canonical inputs");
    }
  } finally { delete process.env.CREATOR_REFERENCE_SIGNING_SECRET; }
});
