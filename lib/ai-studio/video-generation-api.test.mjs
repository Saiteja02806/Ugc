import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import pairedCatalog from "../../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };
import { hookKeyframeGenerationInputKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";

registerHooks({ resolve(specifier, context, next) { return next(specifier === "next/server" ? "next/server.js" : specifier, context); } });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [], saved = new Map();
const automaticTextPlans = [];
let automaticTextPlanError;
mock.module(local("../explore/automatic-hook-text-plan.ts"), { namedExports: { prepareAutomaticHookText: async input => {
  automaticTextPlans.push(input); if (automaticTextPlanError) throw automaticTextPlanError;
  return { version: 1, requestKey: "11111111-1111-4111-8111-111111111111", source: { referenceId: input.referenceId }, model: "test-model" };
} } });
let authFails = false, queueFails = false;
let galleryError;
let galleryDuration = 6.25;
const galleryReads = [];
const startingFrameReads = [];
let startingFrameError;
let startingFrameWorkflow = "hook";
let startingFrameSourceDuration = 73 / 30;
let startingFrameReferenceId = "hook-fixture", videoActorEmail = null;
let startingFrameOutput = { width: 720, height: 1280, ratio: "9:16" };
mock.module(local("../explore/hook-keyframe-result.ts"), { namedExports: {
  resolveApprovedHookStartingFrame: async value => {
    startingFrameReads.push(value);
    if (startingFrameError) throw startingFrameError;
    return { imageUrl: "https://owned-media.example.test/approved-start.png", assetId: value.assetId, imageJobId: value.imageJobId,
      referenceId: startingFrameReferenceId, workflow: startingFrameWorkflow, exploreFormat: startingFrameWorkflow === "wall_text" ? "wall_text" : "hook", sourceSha256: "a".repeat(64), startingFrameIndex: 0, sourceDurationSeconds: startingFrameSourceDuration, receipt: startingFrameReceipt, output: startingFrameOutput };
  },
} });
mock.module(local("../explore/generation-video-reference.ts"), { namedExports: { resolveGalleryGenerationVideo: async (id, format) => {
  galleryReads.push({ id, format });
  if (galleryError) throw galleryError;
  return { url: "https://owned-media.example.test/gallery.mp4", durationSeconds: galleryDuration };
} } });
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("./server-access.ts"), { namedExports: { requireAIStudioProUser: async () => { if (authFails) throw new FirebaseAuthRequestError("Sign in required"); return { uid: "video-owner", email: videoActorEmail, emailVerified: true }; } } });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("../explore/hook-video-library.ts"), { namedExports: { isExploreHookVideoId: id => id === "hook-fixture" || pairedCatalog.items.some(item => item.format === "hook" && item.id === id) } });
mock.module(local("../explore/wall-text-video-library.ts"), { namedExports: { isExploreWallTextVideoId: id => id === "wall-fixture" || pairedCatalog.items.some(item => item.format === "wall_text" && item.id === id) } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: { getBackgroundJobById: async () => null, getMissingBackgroundJobStorageEnvVars: () => [] } });
mock.module(local("../jobs/background-job-service.ts"), { namedExports: { createAndDispatchBackgroundJob: async input => {
  if (queueFails) throw new BillingAccessError("Queue unavailable");
  if (!saved.has(input.idempotencyKey)) { saved.set(input.idempotencyKey, { ...input, id: crypto.randomUUID() }); jobs.push(input); }
  return saved.get(input.idempotencyKey);
} } });
mock.module(local("../storage/storage.ts"), { namedExports: { isTrustedStorageUrl: url => new URL(url).hostname === "owned-media.example.test" } });
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (value, owner) => { assert.equal(owner, "video-owner"); return value; },
  isTrustedMediaReferenceUrl: url => new URL(url).hostname === "owned-media.example.test",
} });
const videoAssetId = "00000000-0000-4000-8000-000000000001";
const audioAssetId = "00000000-0000-4000-8000-000000000002";
const startingFrameAssetId = "00000000-0000-4000-8000-000000000003";
const startingFrameJobId = "00000000-0000-4000-8000-000000000004";
const startingFrameReceipt = {
  version: 1, purpose: "hook_starting_frame", ownerId: "video-owner", draftId: "00000000-0000-4000-8000-000000000005",
  referenceId: "hook-fixture", sourceSha256: "a".repeat(64),
  sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) },
  personImageAssetIds: ["00000000-0000-4000-8000-000000000006"], instructions: "Keep the scene.", promptVersion: 1,
  promptSha256: "c".repeat(64),
};
startingFrameReceipt.inputKey = hookKeyframeGenerationInputKey(startingFrameReceipt);

let referenceOwner = "video-owner";
let imageReferenceOwner = "video-owner", imageReferenceReady = true, imageReferenceCollection = "image";
let uploadedDuration = 2.8;
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetsForOwnerByUrls: async ({ urls, userId }) => { assert.equal(userId, "video-owner"); return urls.map(url => ({ url, user_id: imageReferenceOwner, collection: imageReferenceCollection, mime_type: "image/png", status: imageReferenceReady ? "ready" : "processing", deleted_at: null, file_size_bytes: 1000 })); }, getMediaAssetForOwner: async ({ assetId, userId }) => {
  assert.equal(userId, "video-owner");
  if (assetId === audioAssetId) return { id: assetId, user_id: referenceOwner, deleted_at: null, status: "ready", collection: "audio", mime_type: "audio/mpeg", file_size_bytes: 1000, duration_seconds: 3, url: "https://owned-media.example.test/reference.mp3" };
  return { id: assetId, user_id: referenceOwner, deleted_at: null, status: "ready", collection: "video", mime_type: "video/mp4", file_size_bytes: 1000, duration_seconds: uploadedDuration, url: "https://owned-media.example.test/reference.mp4" };
} } });
mock.module(local("../billing/subscription-db.ts"), { namedExports: { BillingAccessError, deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (kind, duration) => { assert.equal(kind, "video"); return duration * 4; },
  reserveBillingCredits: async input => { reservations.push(input); }, releaseBillingCredits: async input => { releases.push(input); },
} });
const { handleAIStudioVideoGeneration } = await import("./video-generation-api.ts");
const image = "https://owned-media.example.test/reference.png", video = "https://owned-media.example.test/reference.mp4";
const prompt = 'A creator says: “Try this today.” Warm lighting and natural delivery.';
function post(body, key) { return new Request("https://www.getugcpilot.com/api/ai-studio/videos/generate", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ model: "google_omni", prompt, ...body }) }); }

const frameBody = { model: "seedance_2_5", exploreFormat: "hook", referenceId: "hook-fixture",
  startingFrameAssetId, startingFrameJobId, prompt: "Look toward the lens, raise the eyebrows and hold a small smile.", durationSeconds: 8, resolution: "720p" };

test("private creator animation requires the pilot email and an owned approved frame in both billing paths", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  startingFrameReferenceId = "creator-account-1-01";
  try {
    const body = { ...frameBody, model: "google_omni", referenceId: startingFrameReferenceId };
    const before = reservations.length;
    for (const atomic of [false, true]) {
      videoActorEmail = "other@example.com";
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), atomic ? { startBatch: async () => assert.fail("Wrong account reached billing") } : undefined)).status, 404);
    }
    assert.equal(reservations.length, before);
    videoActorEmail = "vtu19403@veltech.edu.in";
    assert.equal((await handleAIStudioVideoGeneration(post({ ...body, referenceUrl: "blob:browser-local-private-video" }, crypto.randomUUID()))).status, 400);
    assert.equal((await handleAIStudioVideoGeneration(post({ ...body, startingFrameAssetId: undefined, startingFrameJobId: undefined }, crypto.randomUUID()))).status, 400);
    for (const atomic of [false, true]) {
      let frozen;
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), atomic ? { startBatch: async batch => { frozen = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 }); } } : undefined);
      assert.equal(response.status, 202, await response.clone().text());
      frozen ??= jobs.at(-1).input;
      assert.equal(frozen.referenceId, startingFrameReferenceId); assert.equal(frozen.referenceType, "hook");
      assert.equal(frozen.referenceUrl, null); assert.equal(frozen.startingFrameAssetId, startingFrameAssetId);
    }
  } finally {
    startingFrameReferenceId = "hook-fixture"; videoActorEmail = null;
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("Omni admits the approved frame plus separately owned face photos in both frozen billing paths", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const photos = [image, "https://owned-media.example.test/support.png"];
  try {
    for (const atomic of [false, true]) {
      let frozen;
      const response = await handleAIStudioVideoGeneration(post({ ...frameBody, model: "google_omni", durationSeconds: 3,
        referenceImageUrls: photos, imageReferencePurpose: "person" }, crypto.randomUUID()), atomic ? {
        startBatch: async batch => { assert.equal(batch.amountPerVideo, 12); frozen = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 }); },
      } : undefined);
      assert.equal(response.status, 202, await response.text());
      const input = atomic ? frozen : jobs.at(-1).input;
      assert.equal(input.startingFrameAssetId, startingFrameAssetId); assert.equal(input.startingFrameJobId, startingFrameJobId);
      assert.equal(input.startingFrameImageUrl, "https://owned-media.example.test/approved-start.png");
      assert.deepEqual(input.referenceImageUrls, photos);
      assert.deepEqual(input.personReference, { version: 1, mainImageUrl: photos[0], supportingImageUrls: photos.slice(1) });
      assert.equal(input.avatarImageUrl, null); assert.equal(input.provider, "gemini"); assert.equal(input.durationSeconds, 3);
      assert.match(input.hookIdea, /3-second video/); assert.equal(input.referenceVideoUrl, null);
    }
  } finally { if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior; }
});

test("saved influencer collections can supply starting-frame faces only when ready and owned", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const body = { ...frameBody, model: "google_omni", referenceImageUrls: [image], imageReferencePurpose: "person" };
  try {
    imageReferenceCollection = "influencer";
    for (const atomic of [false, true]) {
      let frozen;
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), atomic ? {
        startBatch: async batch => { frozen = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 }); },
      } : undefined);
      assert.equal(response.status, 202, await response.text());
      assert.deepEqual((atomic ? frozen : jobs.at(-1).input).referenceImageUrls, [image]);
    }
    const before = reservations.length;
    for (const atomic of [false, true]) {
      imageReferenceOwner = "another-owner";
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), atomic ? {
        startBatch: async () => assert.fail("Foreign influencer reached credit admission"),
      } : undefined);
      assert.equal(response.status, 400);
    }
    imageReferenceOwner = "video-owner"; imageReferenceReady = false;
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
    assert.equal(reservations.length, before);
  } finally {
    imageReferenceCollection = "image"; imageReferenceOwner = "video-owner"; imageReferenceReady = true;
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("starting-frame faces cannot be silently dropped, exceed the cap or bypass ownership before credits", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const before = reservations.length;
  const body = { ...frameBody, model: "google_omni", referenceImageUrls: [image], imageReferencePurpose: "person" };
  try {
    for (const patch of [
      { model: "wan_3_0" }, { model: "seedance_2_5" }, { imageReferencePurpose: undefined }, { imageReferencePurpose: "general" },
      { referenceImageUrls: [image, image] }, { referenceImageUrls: ["https://owned-media.example.test/approved-start.png"] },
      { referenceImageUrls: Array.from({ length: 6 }, (_, index) => `https://owned-media.example.test/face-${index}.png`) },
    ]) {
      const response = await handleAIStudioVideoGeneration(post({ ...body, ...patch }, crypto.randomUUID()), {
        startBatch: async () => assert.fail("Invalid face inputs reached billing"),
      });
      assert.equal(response.status, 400, JSON.stringify(patch));
    }
    imageReferenceOwner = "someone-else";
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
    imageReferenceOwner = "video-owner"; imageReferenceReady = false;
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
    assert.equal(reservations.length, before);
  } finally {
    imageReferenceOwner = "video-owner"; imageReferenceReady = true;
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("Omni and WAN accept three-second starting animation while Seedance still requires four", async () => {
  const keys = ["ENABLE_HOOK_STARTING_FRAME_PREPARATION", "NEXT_PUBLIC_ENABLE_OPENROUTER_WAN"];
  const prior = keys.map(key => process.env[key]); keys.forEach(key => { process.env[key] = "true"; });
  try {
    for (const model of ["google_omni", "wan_3_0"]) for (const workflow of ["hook", "wall_text"]) {
      startingFrameWorkflow = workflow;
      let input;
      const response = await handleAIStudioVideoGeneration(post({ ...frameBody, model, exploreFormat: workflow, durationSeconds: 3 }, crypto.randomUUID()), {
        startBatch: async batch => { assert.equal(batch.amountPerVideo, 12); input = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 }); },
      });
      assert.equal(response.status, 202, await response.text()); assert.equal(input.durationSeconds, 3); assert.match(input.hookIdea, /3-second video/);
    }
    startingFrameWorkflow = "hook";
    assert.equal((await handleAIStudioVideoGeneration(post({ ...frameBody, durationSeconds: 3 }, crypto.randomUUID()))).status, 400);
  } finally { startingFrameWorkflow = "hook"; keys.forEach((key, index) => { if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index]; }); }
});

test("Talking Head scripts and Wall background instructions reach owned-frame animation through both admission paths", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  try {
    for (const workflow of ["talking_head", "wall_text"]) {
      startingFrameWorkflow = workflow;
      const exploreFormat = workflow === "wall_text" ? "wall_text" : "hook";
      const body = { ...frameBody, model: "google_omni", exploreFormat, quantity: 2, generateAudio: workflow === "talking_head", prompt: workflow === "talking_head" ? 'Reference instructions: Natural delivery. Your instructions: Say "My own message."' : "A gentle camera movement. Keep overlay text editable." };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      let atomic;
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async batch => { atomic = batch.inputs; return Response.json({ ok: true }, { status: 202 }); } })).status, 202);
      for (const input of [...jobs.slice(-2).map(job => job.input), ...atomic]) {
        assert.equal(input.referenceType, exploreFormat);
        assert.equal(input.startingFrameAssetId, startingFrameAssetId);
        assert.equal(input.referenceVideoUrl, null);
        assert.ok(input.hookIdea.includes(body.prompt));
        assert.match(input.hookIdea, workflow === "talking_head" ? /Generate the user's requested speech/ : /Overlay text is added separately/);
      }
    }
  } finally {
    startingFrameWorkflow = "hook";
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("approved starting-frame requests freeze owned provenance and self-contained prompts in both billing admission paths", async () => {
  const prior = [process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION, process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE];
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  try {
    for (const generateAudio of [undefined, false, true]) {
      const body = { ...frameBody, ...(generateAudio === undefined ? {} : { generateAudio }), quantity: 2 };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      assert.equal(reservations.at(-1).amount, 32);
      let atomic;
      await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async batch => {
        assert.equal(batch.amountPerVideo, 32); atomic = batch.inputs; return Response.json({ ok: true }, { status: 202 });
      } });
      assert.equal(atomic.length, 2);
      for (const input of [...jobs.slice(-2).map(job => job.input), ...atomic]) {
        assert.equal(input.startingFrameImageUrl, "https://owned-media.example.test/approved-start.png");
        assert.equal(input.startingFrameAssetId, startingFrameAssetId);
        assert.equal(input.startingFrameJobId, startingFrameJobId);
        assert.deepEqual(input.startingFrameReceipt, startingFrameReceipt);
        assert.equal(input.provider, "reapi"); assert.equal(input.durationSeconds, 8);
        assert.equal(input.generateAudio, generateAudio === true); assert.equal(input.generationIntent, "animate_starting_frame");
        assert.deepEqual(input.referenceImageUrls, []); assert.deepEqual(input.referenceAudioUrls, []);
        assert.equal(input.referenceVideoUrl, null); assert.equal(input.referenceVideoMode, undefined); assert.equal(input.personReference, undefined);
        assert.equal(input.hookIdea.match(/Animate the approved starting image/g).length, 1);
        assert.match(input.hookIdea, /8-second video/); assert.ok(input.hookIdea.includes(frameBody.prompt));
        assert.doesNotMatch(input.hookIdea, /@Video|@Image|EDIT THE EXISTING VIDEO|NEW PERFORMANCE|replace the performer's facial identity/);
      }
    }
    assert.ok(startingFrameReads.every(value => value.ownerId === "video-owner"));
  } finally {
    for (const [index, key] of ["ENABLE_HOOK_STARTING_FRAME_PREPARATION", "NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE"].entries()) {
      if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index];
    }
  }
});

test("each supported animation model freezes the same verified starting frame and its explicit provider before billing", async () => {
  const keys = ["ENABLE_HOOK_STARTING_FRAME_PREPARATION", "NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE", "NEXT_PUBLIC_ENABLE_OPENROUTER_WAN"];
  const prior = keys.map(key => process.env[key]); keys.forEach(key => { process.env[key] = "true"; });
  try {
    for (const model of ["google_omni", "seedance_2_5", "wan_3_0"]) for (const atomic of [false, true]) {
      let inputs;
      const response = await handleAIStudioVideoGeneration(post({ ...frameBody, model }, crypto.randomUUID()), atomic ? {
        startBatch: async batch => { inputs = batch.inputs; return Response.json({ ok: true }, { status: 202 }); },
      } : undefined);
      assert.equal(response.status, 202);
      const input = atomic ? inputs[0] : jobs.at(-1).input;
      assert.equal(input.model, model); assert.equal(input.provider, model === "google_omni" ? "gemini" : "reapi");
      assert.equal(input.startingFrameAssetId, startingFrameAssetId); assert.deepEqual(input.startingFrameReceipt, startingFrameReceipt);
      assert.deepEqual(input.referenceImageUrls, []); assert.equal(input.referenceVideoUrl, null);
      assert.equal(input.generateAudio, false); assert.equal(input.generationIntent, "animate_starting_frame");
    }
  } finally { keys.forEach((key, index) => { if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index]; }); }
});

test("starting-frame admission verifies the generated asset shape rather than trusting source-frame dimensions", async () => {
  const prior = [process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION, process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE];
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  const before = reservations.length;
  try {
    for (const output of [
      { width: 1280, height: 720, ratio: "9:16" },
      { width: 720, height: 1280, ratio: "16:9" },
      { width: null, height: 1280, ratio: "9:16" },
      { width: 720, height: 0, ratio: "9:16" },
      { width: 1024, height: 1280, ratio: "4:5" },
    ]) {
      startingFrameOutput = output;
      const response = await handleAIStudioVideoGeneration(post(frameBody, crypto.randomUUID()), {
        startBatch: async () => assert.fail("Unverified generated image shape reached billing admission"),
      });
      assert.equal(response.status, 400, JSON.stringify(output));
    }
    assert.equal(reservations.length, before);
  } finally {
    startingFrameOutput = { width: 720, height: 1280, ratio: "9:16" };
    for (const [index, key] of ["ENABLE_HOOK_STARTING_FRAME_PREPARATION", "NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE"].entries()) {
      if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index];
    }
  }
});

test("starting-frame conflicts, wrong model, malformed duration and unavailable provenance cannot charge", async () => {
  const prior = [process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION, process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE];
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  const before = reservations.length;
  try {
    for (const patch of [
      { model: "kling_3_0" }, { model: "google_omni", durationSeconds: 11 }, { exploreFormat: "wall_text" }, { startingFrameJobId: undefined },
      { referenceImageUrls: [image] }, { avatarImageUrl: image }, { referenceVideoUrl: video },
      { referenceAudioUrls: ["https://owned-media.example.test/reference.mp3"] }, { useGalleryVideoReference: true },
      { referenceVideoMode: "edit" }, { durationSeconds: -1 }, { durationSeconds: 16 }, { durationSeconds: 3.5 },
      { generateAudio: "false" }, { referenceId: "another-hook" }, { aspectRatio: "16:9" },
      { prompt: "Use @Video 1 and @Image 1 to swap the face." },
      { prompt: "Animate the approved starting image into an 8-second video." },
    ]) {
      const response = await handleAIStudioVideoGeneration(post({ ...frameBody, ...patch }, crypto.randomUUID()), {
        startBatch: async () => assert.fail("Invalid starting-frame request reached credit admission"),
      });
      assert.equal(response.status, 400, JSON.stringify(patch));
    }
    startingFrameError = Object.assign(new Error("The Hook source changed. Prepare a new starting image."), { status: 409 });
    assert.equal((await handleAIStudioVideoGeneration(post(frameBody, crypto.randomUUID()))).status, 409);
    startingFrameError = undefined;
    process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "false";
    assert.equal((await handleAIStudioVideoGeneration(post(frameBody, crypto.randomUUID()))).status, 404);
    assert.equal(reservations.length, before);
  } finally {
    startingFrameError = undefined;
    for (const [index, key] of ["ENABLE_HOOK_STARTING_FRAME_PREPARATION", "NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE"].entries()) {
      if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index];
    }
  }
});

test("Seedance editing is admitted with source-based credits, ordered roles and sound off in both admission paths", async () => {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  const priorDuration = galleryDuration;
  try {
    galleryDuration = 4.04;
    const images = Array.from({ length: 6 }, (_, i) => `https://owned-media.example.test/photo-${i + 1}.png`);
    for (const exploreFormat of ["hook", "wall_text"]) {
      const body = { model: "seedance_2_5", exploreFormat, referenceId: `${exploreFormat}-fixture`, useGalleryVideoReference: true,
        referenceVideoMode: "edit", durationSeconds: 30, referenceImageUrls: images, avatarImageUrl: images[0], imageReferencePurpose: "person" };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      assert.equal(reservations.at(-1).amount, 20, "app credits round the verified source up, not the supplied output setting");
      let atomic;
      await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async batch => {
        assert.equal(batch.amountPerVideo, 20); atomic = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 });
      } });
      for (const input of [jobs.at(-1).input, atomic]) {
        assert.equal(input.provider, "reapi"); assert.equal(input.referenceVideoMode, "edit");
        assert.equal(input.durationSeconds, 5); assert.equal(input.referenceVideoDurationSeconds, 4.04);
        assert.equal(input.generationIntent, "replace_face"); assert.equal(input.generateAudio, false);
        assert.deepEqual(input.referenceImageUrls, images);
        assert.equal(input.personReference.mainImageUrl, images[0]);
        assert.match(input.hookIdea, /EDIT THE EXISTING VIDEO: In @Video 1/);
        assert.match(input.hookIdea, /@Image 6/);
        assert.ok(input.hookIdea.includes(prompt));
      }
    }
  } finally {
    galleryDuration = priorDuration;
    if (enabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = enabled;
  }
});

test("short sources and incompatible edit models fail before either credit admission path", async () => {
  const flags = [process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE, process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN];
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true"; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true";
  const priorDuration = galleryDuration, before = reservations.length, beforeJobs = jobs.length;
  try {
    for (const model of ["seedance_2_5", "wan_3_0"]) for (const duration of [3.467, 30.001]) {
      galleryDuration = duration;
      const body = { model, exploreFormat: "hook", referenceId: "hook-fixture", useGalleryVideoReference: true, referenceVideoMode: "edit", durationSeconds: 30 };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async () => assert.fail("invalid edit must not reach billing admission") })).status, 400);
    }
    assert.equal(reservations.length, before); assert.equal(jobs.length, beforeJobs);
  } finally {
    galleryDuration = priorDuration;
    for (const [i, flag] of ["NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE", "NEXT_PUBLIC_ENABLE_OPENROUTER_WAN"].entries()) {
      if (flags[i] === undefined) delete process.env[flag]; else process.env[flag] = flags[i];
    }
  }
});

test("AI Studio, Hook and Wall of Text create every selected two/three-video job and recover all IDs", async () => {
  for (const exploreFormat of [undefined, "hook", "wall_text"]) for (const quantity of [2, 3]) {
    const key = crypto.randomUUID(), before = jobs.length;
    const body = { quantity, durationSeconds: 5, ...(exploreFormat ? { exploreFormat } : {}) };
    const response = await handleAIStudioVideoGeneration(post(body, key));
    assert.equal(response.status, 202);
    const batch = await response.json();
    assert.equal(batch.jobs.length, quantity); assert.equal(batch.partial, false);
    assert.equal(new Set(batch.jobs.map(job => job.videoId)).size, quantity);
    assert.equal(jobs.length - before, quantity);
    assert.ok(jobs.slice(before).every((job, i) => job.input.batchSize === quantity && job.input.batchIndex === i + 1));
    const replay = await (await handleAIStudioVideoGeneration(post(body, key))).json();
    assert.deepEqual(replay.jobs, batch.jobs); assert.equal(jobs.length - before, quantity);
    let atomic;
    await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async b => { atomic=b; return Response.json({ ok: true }, { status: 202 }); } });
    assert.equal(atomic.inputs.length, quantity);
  }
});
test("model image limits reach both queue paths intact beside video/audio and excess fails before billing", async () => {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
  const wanEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true";
  try {
    for (const [model, limit] of [["seedance_2_5", 30], ["wan_3_0", 10], ["google_omni", 10]]) {
      const images = Array.from({ length: limit }, (_, i) => `https://owned-media.example.test/reference-${i}.png`);
      const body = { model, exploreFormat: "hook", durationSeconds: 5, referenceImageUrls: images,
        useGalleryVideoReference: true, referenceId: "hook-fixture",
        ...(model !== "google_omni" ? { referenceAudioUrls: ["https://owned-media.example.test/reference.mp3"], referenceAudioAssetIds: [audioAssetId] } : {}) };
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()));
      assert.equal(response.status, 202, JSON.stringify(await response.clone().json()));
      assert.deepEqual(jobs.at(-1).input.referenceImageUrls, images);
      let atomic;
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async batch => {
        atomic = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 });
      } })).status, 202);
      assert.deepEqual(atomic.referenceImageUrls, images);
      const before = reservations.length;
      const rejected = await handleAIStudioVideoGeneration(post({ ...body, referenceImageUrls: [...images, "https://owned-media.example.test/excess.png"] }, crypto.randomUUID()));
      assert.equal(rejected.status, 400);
      assert.match((await rejected.json()).error, new RegExp(`up to ${limit} reference images`));
      assert.equal(reservations.length, before);
    }
  } finally {
    if (enabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
    else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = enabled;
    if (wanEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
    else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = wanEnabled;
  }
});

test("invalid video counts fail before creating jobs or reserving credits", async () => {
  const before = jobs.length, creditCount = reservations.length;
  for (const quantity of [0, 5, 1.5, "3", null]) assert.equal((await handleAIStudioVideoGeneration(post({ quantity }, crypto.randomUUID()))).status, 400);
  assert.equal(jobs.length, before); assert.equal(reservations.length, creditCount);
});

test("person roles reach both job paths with main first, source intact and instructions intact", async () => {
  const urls = [image, "https://owned-media.example.test/left.png", "https://owned-media.example.test/right.png"];
  for (const exploreFormat of ["hook", "wall_text"]) for (const withVideo of [false, true]) {
    const body = { exploreFormat, imageReferencePurpose: "person", avatarImageUrl: urls[0], referenceImageUrls: urls,
      ...(withVideo ? { useGalleryVideoReference: true, referenceId: `${exploreFormat}-fixture`, referenceVideoMode: "edit" } : {}) };
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
    let atomic;
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async batch => {
      atomic = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 });
    } })).status, 202);
    for (const input of [jobs.at(-1).input, atomic]) {
      assert.deepEqual(input.referenceImageUrls, urls);
      assert.deepEqual(input.personReference, { version: 1, mainImageUrl: urls[0], supportingImageUrls: urls.slice(1) });
      assert.match(input.hookIdea, /Image 1 is the main face photo/);
      assert.match(input.hookIdea, /supporting views of the SAME person/);
      assert.ok(input.hookIdea.includes(prompt));
      assert.equal(input.referenceVideoUrl, withVideo ? "https://owned-media.example.test/gallery.mp4" : null);
    }
  }
  await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", imageReferencePurpose: "general", referenceImageUrls: urls }, crypto.randomUUID()));
  assert.equal(jobs.at(-1).input.personReference, undefined);
  assert.ok(jobs.at(-1).input.hookIdea.endsWith(prompt));
  assert.doesNotMatch(jobs.at(-1).input.hookIdea, /IMAGE ROLES/);
});

test("invalid person role requests and overflowing role prompts fail before charging", async () => {
  const before = reservations.length;
  for (const body of [
    { imageReferencePurpose: "person", referenceImageUrls: [image] },
    { exploreFormat: "hook", imageReferencePurpose: "person" },
    { exploreFormat: "hook", imageReferencePurpose: "unknown", referenceImageUrls: [image] },
  ]) {
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
  }
  const enabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  try {
    assert.equal((await handleAIStudioVideoGeneration(post({ model: "seedance_2_5", durationSeconds: 5, exploreFormat: "hook",
      imageReferencePurpose: "person", referenceImageUrls: [image], prompt: "x".repeat(10_000) }, crypto.randomUUID()))).status, 400);
  } finally {
    if (enabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
    else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = enabled;
  }
  assert.equal(reservations.length, before);
});

test("both workflows freeze Sound off by default and retain explicit Sound on in ordinary and atomic jobs", async () => {
  for (const exploreFormat of ["hook", "wall_text"]) for (const generateAudio of [undefined, false, true]) {
    const body = { exploreFormat, ...(generateAudio === undefined ? {} : { generateAudio }) };
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
    let batch;
    await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { batch = value; return Response.json({ ok: true }, { status: 202 }); } });
    for (const input of [jobs.at(-1).input, batch.inputs[0]]) {
      assert.equal(input.generateAudio, generateAudio === true);
      assert.match(input.hookIdea, generateAudio ? /SOUND SETTING: ON/ : /SOUND SETTING: OFF/);
      assert.ok(input.hookIdea.includes(prompt));
      assert.equal(input.referenceSoundtrack, undefined);
    }
  }
  const before = reservations.length, queued = jobs.length;
  for (const generateAudio of [null, "false", 0, {}]) {
    assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", generateAudio }, crypto.randomUUID()))).status, 400);
  }
  assert.equal(jobs.length, queued); assert.equal(reservations.length, before);
});

test("Seedance binds all five ordered face photos to a source performance, or creates from photos alone", async () => {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  try {
    const urls = Array.from({ length: 5 }, (_, i) => `https://owned-media.example.test/person-${i}.png`);
    for (const withVideo of [false, true]) {
      const body = { model: "seedance_2_5", exploreFormat: "hook", imageReferencePurpose: "person", avatarImageUrl: urls[0], referenceImageUrls: urls,
        generateAudio: false, ...(withVideo ? { useGalleryVideoReference: true, referenceId: "hook-fixture" } : {}) };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      let atomic;
      await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { atomic = value.inputs[0]; return Response.json({ ok: true }, { status: 202 }); } });
      for (const input of [jobs.at(-1).input, atomic]) {
        assert.deepEqual(input.referenceImageUrls, urls);
        assert.equal(input.personReference.mainImageUrl, urls[0]);
        for (let i = 1; i <= 5; i++) assert.ok(input.hookIdea.includes(`@Image ${i}`));
        assert.equal(input.generateAudio, false);
        assert.equal(input.generationIntent, withVideo ? "recreate_performance" : "create_performance");
        if (withVideo) assert.match(input.hookIdea, /PERFORMANCE SOURCE: @Video 1/);
        else assert.doesNotMatch(input.hookIdea, /@Video/);
        assert.ok(input.hookIdea.includes(prompt));
      }
    }
  } finally {
    if (enabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
    else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = enabled;
  }
});

test("new sound controls prevent automatic gallery music while legacy Recreate retains trusted audio provenance", async () => {
  for (const format of ["hook", "wall_text"]) {
    const reference = pairedCatalog.items.find(item => item.format === format);
    const expected = { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 };
    const body = { exploreFormat: format, referenceType: format, referenceId: reference.id, quantity: 2,
      referenceSoundtrack: { version: 1, referenceId: "untrusted", audioSha256: "0".repeat(64), volume: 1 } };
    const before = jobs.length;
    assert.equal((await handleAIStudioVideoGeneration(post(body, `paired-${format}`))).status, 202);
    assert.equal(jobs.length - before, 2);
    for (const job of jobs.slice(before)) { assert.equal(job.input.referenceSoundtrack, undefined); assert.equal(job.input.generateAudio, false); }
    let batch;
    assert.equal((await handleAIStudioVideoGeneration(post(body, `paired-batch-${format}`), { startBatch: async value => { batch = value; return new Response("{}", { status: 202 }); } })).status, 202);
    assert.equal(batch.inputs.length, 2);
    for (const input of batch.inputs) { assert.equal(input.referenceSoundtrack, undefined); assert.equal(input.generateAudio, false); }
    assert.equal((await handleAIStudioVideoGeneration(post({ referenceType: format, referenceId: reference.id, avatarImageUrl: image }, `paired-legacy-${format}`))).status, 202);
    assert.deepEqual(jobs.at(-1).input.referenceSoundtrack, expected);
  }
});

for (const exploreFormat of ["hook", "wall_text"]) {
  test(`${exploreFormat} queues prompt-only, image or video guidance with exact narration and workflow metadata`, async () => {
    for (const [name, reference] of [["prompt", {}], ["image", { avatarImageUrl: image }], ["video", { referenceVideoUrl: video, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 2.8 }]]) {
      const before = jobs.length;
      const response = await handleAIStudioVideoGeneration(post({ exploreFormat, durationSeconds: 8, quantity: 2, aspectRatio: "16:9", ...reference,
        referenceType: exploreFormat, referenceId: exploreFormat === "hook" ? "hook-fixture" : "wall-fixture" }, `${exploreFormat}-${name}`));
      assert.equal(response.status, 202);
      assert.equal((await response.json()).jobs.length, 2);
      for (const [index, job] of jobs.slice(before).entries()) {
        assert.equal(job.input.exploreFormat, exploreFormat);
        assert.equal(job.input.model, "google_omni");
        assert.equal(job.input.aspectRatio, "16:9");
        assert.equal(job.input.promptMode, "direct");
        assert.equal(job.input.avatarImageUrl, reference.avatarImageUrl ?? null);
        assert.equal(job.input.referenceVideoUrl, reference.referenceVideoUrl ?? null);
        assert.equal(job.input.referenceVideoDurationSeconds, reference.referenceVideoDurationSeconds ?? null);
        assert.equal(job.input.durationSeconds, name === "video" ? 3 : 8);
        assert.ok(job.input.hookIdea.includes(prompt), "The user's complete instructions must not be rewritten");
        assert.equal(job.input.generateAudio, false);
        if (exploreFormat === "hook") assert.ok(job.input.hookIdea.endsWith(prompt));
        else assert.match(job.input.hookIdea, /without creator-added text, captions, subtitles/);
        assert.equal(job.input.batchIndex, index + 1); assert.equal(job.input.batchSize, 2);
        assert.equal(job.jobType, "generate_hook_video"); assert.equal(job.userId, "video-owner");
        assert.equal(reservations.find(item => item.idempotencyKey === job.idempotencyKey).amount, name === "video" ? 12 : 32);
      }
    }
  });
}
test("video formats reject invalid uploads and unsupported modes before reserving credits", async () => {
  const before = reservations.length;
  for (const body of [{ exploreFormat: "slideshow" }, { exploreFormat: "hook", avatarImageUrl: image, referenceVideoUrl: video, referenceVideoDurationSeconds: 2 },
    { exploreFormat: "wall_text", avatarImageUrl: "https://untrusted.test/a.png" }, { exploreFormat: "hook", referenceVideoUrl: video, referenceVideoDurationSeconds: 3.1 },
    { exploreFormat: "hook", referenceVideoUrl: video }, { exploreFormat: "hook", model: "kling_3_0", avatarImageUrl: image }]) {
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
  }
  assert.equal(reservations.length, before);
});

test("Explore Seedance reaches ordinary and atomic admission with prompt, images, uploaded video, audio and gallery references", async () => {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true";
  try {
    for (const exploreFormat of ["hook", "wall_text"]) for (const reference of [
      {}, { avatarImageUrl: image, referenceImageUrls: [image] },
      { referenceVideoUrl: video, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: uploadedDuration },
      { referenceAudioUrls: ["https://owned-media.example.test/reference.mp3"], referenceAudioAssetIds: [audioAssetId] },
      { useGalleryVideoReference: true, referenceId: `${exploreFormat}-fixture`, referenceImageUrls: [image] },
    ]) {
      const body = { model: "seedance_2_5", exploreFormat, durationSeconds: 17, resolution: "480p", quantity: 2, ...reference };
      const before = jobs.length;
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()));
      assert.equal(response.status, 202, JSON.stringify(await response.clone().json()));
      assert.equal(jobs.length - before, 2);
      let batch;
      const atomic = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { batch = value; return Response.json({ ok: true }, { status: 202 }); } });
      assert.equal(atomic.status, 202, JSON.stringify(await atomic.clone().json()));
      assert.equal(batch.amountPerVideo, 68);
      for (const input of [...jobs.slice(before).map(job => job.input), ...batch.inputs]) {
        assert.equal(input.model, "seedance_2_5"); assert.equal(input.provider, "reapi"); assert.equal(input.exploreFormat, exploreFormat);
        assert.equal(input.durationSeconds, 17); assert.equal(input.resolution, "480p");
        assert.equal(input.referenceVideoMode, undefined, "Seedance references must not become Omni edit operations");
        assert.deepEqual(input.referenceImageUrls, reference.referenceImageUrls ?? (reference.avatarImageUrl ? [image] : []));
        assert.deepEqual(input.referenceAudioUrls, reference.referenceAudioUrls ?? []);
        if (reference.referenceAudioUrls) assert.deepEqual(input.referenceAudioDurationSeconds, [3]);
        if (reference.referenceVideoUrl || reference.useGalleryVideoReference) {
          assert.equal(input.referenceVideoUrl, reference.useGalleryVideoReference ? "https://owned-media.example.test/gallery.mp4" : video);
          assert.equal(input.referenceVideoDurationSeconds, reference.useGalleryVideoReference ? galleryDuration : uploadedDuration);
        }
      }
    }
    for (const seconds of [2, 30]) {
      galleryDuration = seconds;
      assert.equal((await handleAIStudioVideoGeneration(post({ model: "seedance_2_5", exploreFormat: "hook", useGalleryVideoReference: true, referenceId: "hook-fixture" }, crypto.randomUUID()))).status, 202);
      assert.equal(jobs.at(-1).input.referenceVideoDurationSeconds, seconds);
    }
    const before = reservations.length;
    for (const seconds of [1.99, 30.01]) {
      galleryDuration = seconds;
      assert.equal((await handleAIStudioVideoGeneration(post({ model: "seedance_2_5", exploreFormat: "hook", useGalleryVideoReference: true, referenceId: "hook-fixture" }, crypto.randomUUID()))).status, 400);
    }
    assert.equal(reservations.length, before);
    process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "false";
    assert.equal((await handleAIStudioVideoGeneration(post({ model: "seedance_2_5", exploreFormat: "hook" }, crypto.randomUUID()))).status, 503);
    assert.equal(reservations.length, before);
  } finally {
    galleryDuration = 6.25;
    if (enabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = enabled;
  }
});

for (const exploreFormat of ["hook", "wall_text"]) {
  test(`${exploreFormat} preserves all selected images alongside an actual gallery source video`, async () => {
    const images = Array.from({ length: 10 }, (_, index) => `https://owned-media.example.test/reference-${index}.png`);
    const body = { exploreFormat, avatarImageUrl: images[0], referenceImageUrls: images, useGalleryVideoReference: true, referenceId: `${exploreFormat}-fixture`, referenceVideoMode: "edit" };
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
    assert.deepEqual(jobs.at(-1).input.referenceImageUrls, images);
    assert.equal(jobs.at(-1).input.referenceVideoUrl, "https://owned-media.example.test/gallery.mp4");
    let batch;
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { batch = value; return new Response("{}", { status: 202 }); } })).status, 202);
    assert.deepEqual(batch.inputs[0].referenceImageUrls, images);
  });
  test(`${exploreFormat} preserves an uploaded video and image in ordinary and atomic edit requests`, async () => {
    const body = { exploreFormat, avatarImageUrl: image, referenceImageUrls: [image], referenceVideoUrl: video,
      referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 2.8, referenceVideoMode: "edit", prompt: "x".repeat(1500) };
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
    const input = jobs.at(-1).input;
    assert.equal(input.referenceVideoMode, "edit"); assert.equal(input.referenceVideoUrl, video);
    assert.deepEqual(input.referenceImageUrls, [image]); assert.equal(input.avatarImageUrl, image);
    assert.equal(input.durationSeconds, 3);
    let batch;
    assert.equal((await handleAIStudioVideoGeneration(post({ ...body, quantity: 2 }, crypto.randomUUID()), {
      startBatch: async value => { batch = value; return new Response("{}", { status: 202 }); },
    })).status, 202);
    assert.equal(batch.amountPerVideo, 12);
    assert.ok(batch.inputs.every(item => item.referenceVideoMode === "edit" && item.referenceVideoUrl === video && item.referenceImageUrls[0] === image));
  });
  test(`${exploreFormat} resolves the selected gallery video on the server and charges for its verified length`, async () => {
    assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat, useGalleryVideoReference: true, referenceId: `${exploreFormat}-fixture`,
      referenceUrl: "https://attacker.test/fake.mp4", avatarImageUrl: image }, crypto.randomUUID()))).status, 202);
    const input = jobs.at(-1).input;
    assert.deepEqual(galleryReads.at(-1), { id: `${exploreFormat}-fixture`, format: exploreFormat });
    assert.equal(input.referenceVideoUrl, "https://owned-media.example.test/gallery.mp4");
    assert.equal(input.referenceUrl, input.referenceVideoUrl); assert.equal(input.referenceType, exploreFormat);
    assert.equal(input.referenceVideoDurationSeconds, 6.25); assert.equal(input.durationSeconds, 6);
    assert.equal(input.referenceVideoMode, "edit"); assert.equal(input.avatarImageUrl, image);
    assert.equal(reservations.at(-1).amount, 24);
  });
}
test("decimal Hook and Wall source timelines and combined prompts survive admission in ordinary and atomic batches", async () => {
  try {
    for (const [exploreFormat, seconds] of [["hook", 3.3], ["hook", 3.49], ["hook", 3.5], ["hook", 3.7], ["wall_text", 6.3], ["wall_text", 6.7]]) {
      galleryDuration = seconds;
      const combined = "Keep the reference gestures. Remove captions.\n\nUser instruction: use warm lighting.";
      const body = { exploreFormat, prompt: combined, useGalleryVideoReference: true, referenceId: `${exploreFormat}-fixture`, referenceImageUrls: [image] };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      const queued = jobs.at(-1).input;
      assert.equal(queued.referenceVideoDurationSeconds, seconds); assert.equal(queued.durationSeconds, Math.round(seconds));
      assert.equal(queued.referenceVideoMode, "edit"); assert.ok(queued.hookIdea.includes(combined));
      assert.equal(reservations.at(-1).amount, Math.round(seconds) * 4);
      let batch;
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { batch = value; return Response.json({ ok: true }, { status: 202 }); } })).status, 202);
      assert.equal(batch.amountPerVideo, Math.round(seconds) * 4);
      assert.ok(batch.inputs.every(input => input.referenceVideoDurationSeconds === seconds && input.referenceVideoMode === "edit" && input.hookIdea.includes(combined)));
    }
  } finally { galleryDuration = 6.25; }
});

test("invalid, unavailable and incompatible edit sources cannot reserve credits", async () => {
  const before = reservations.length;
  for (const body of [
    { exploreFormat: "hook", referenceVideoMode: "edit" },
    { exploreFormat: "hook", model: "wan_3_0", useGalleryVideoReference: true, referenceVideoMode: "edit" },
    { exploreFormat: "hook", useGalleryVideoReference: true, referenceVideoUrl: video },
    { exploreFormat: "hook", referenceVideoMode: "edit", referenceVideoUrl: video, referenceVideoDurationSeconds: 10.1, referenceVideoAssetId: videoAssetId },
    { exploreFormat: "hook", referenceVideoMode: "edit", referenceVideoUrl: video, referenceVideoDurationSeconds: 2.8, referenceVideoAssetId: videoAssetId, referenceImageUrls: Array.from({ length: 11 }, (_, index) => `https://owned-media.example.test/image-${index}.png`) },
  ]) assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
  galleryError = new Error("This gallery video is longer than 10 seconds.");
  try {
    const response = await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", useGalleryVideoReference: true }, crypto.randomUUID()));
    assert.equal(response.status, 400); assert.match((await response.json()).error, /longer than 10 seconds/);
  } finally { galleryError = undefined; }
  assert.equal(reservations.length, before);
});

test("WAN uses the registered gallery video as a reference while keeping the requested output length", async () => {
  const initialWan = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true";
  galleryDuration = 15;
  try {
    for (const exploreFormat of ["hook", "wall_text"]) {
      const body = { model: "wan_3_0", exploreFormat, useGalleryVideoReference: true,
        referenceId: `${exploreFormat}-fixture`, referenceImageUrls: [image], durationSeconds: 3 };
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 202);
      const input = jobs.at(-1).input;
      assert.equal(input.provider, "reapi"); assert.equal(input.referenceVideoDurationSeconds, 15);
      assert.equal(input.referenceVideoMode, undefined); assert.equal(input.durationSeconds, 3);
      assert.equal(input.referenceVideoUrl, "https://owned-media.example.test/gallery.mp4");
      assert.equal(reservations.at(-1).amount, 12);
    }
    galleryDuration = 15.01;
    const before = reservations.length;
    assert.equal((await handleAIStudioVideoGeneration(post({ model: "wan_3_0", exploreFormat: "hook",
      useGalleryVideoReference: true, referenceId: "hook-fixture", durationSeconds: 3 }, crypto.randomUUID()))).status, 400);
    assert.equal(reservations.length, before);
  } finally {
    galleryDuration = 6.25;
    if (initialWan === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
    else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = initialWan;
  }
});
test("Wall of Text charges and queues ten seconds from either a gallery source or an owned upload, preserving the image", async () => {
  galleryDuration = 10; uploadedDuration = 10;
  try {
    for (const source of [
      { useGalleryVideoReference: true, referenceId: "wall-fixture" },
      { referenceVideoMode: "edit", referenceVideoUrl: video, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 10 },
    ]) {
      const response = await handleAIStudioVideoGeneration(post({ exploreFormat: "wall_text", avatarImageUrl: image,
        referenceImageUrls: [image], durationSeconds: 5, ...source }, crypto.randomUUID()));
      assert.equal(response.status, 202);
      assert.equal(jobs.at(-1).input.durationSeconds, 10);
      assert.equal(jobs.at(-1).input.referenceVideoDurationSeconds, 10);
      assert.equal(jobs.at(-1).input.referenceVideoMode, "edit");
      assert.deepEqual(jobs.at(-1).input.referenceImageUrls, [image]);
      assert.equal(reservations.at(-1).amount, 40);
    }
  } finally { galleryDuration = 6.25; uploadedDuration = 2.8; }
});
test("format video references still enforce the production owner check before credit reservation", async () => {
  const before = reservations.length;
  referenceOwner = "different-owner";
  try {
    assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", referenceVideoUrl: video, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 2.8 }, "wrong-reference-owner"))).status, 400);
    assert.equal(reservations.length, before);
  } finally { referenceOwner = "video-owner"; }
});
test("long Omni prompts preserve all narration and wall-background instructions in queued jobs", async () => {
  const { WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS } = await import("../explore/format-generation-prompt.ts");
  const longPrompt = "A detailed cinematic scene. ".repeat(500) + ' The creator says “Hello.”';
  for (const exploreFormat of ["hook", "wall_text"]) {
    for (const reference of [{}, { avatarImageUrl: image }]) {
      assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat, prompt: longPrompt, ...reference }, crypto.randomUUID()))).status, 202);
      assert.ok(jobs.at(-1).input.hookIdea.endsWith(exploreFormat === "wall_text" ? `${longPrompt}\n${WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS}` : longPrompt));
    }
  }
});
test("video guidance reserves wall-instruction space and rejects excess length before charging", async () => {
  const { getExploreVideoPromptMaxLength } = await import("../explore/format-generation-prompt.ts");
  const maxLength = getExploreVideoPromptMaxLength({ model: "google_omni", hasReferenceVideo: true, format: "wall_text", generateAudio: false });
  const reference = { referenceVideoUrl: video, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 2.8 };
  assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "wall_text", prompt: "A".repeat(maxLength), ...reference }, "long-wall-video"))).status, 202);
  assert.equal(jobs.at(-1).input.hookIdea.length, 1000);
  const before = jobs.length;
  const creditsBefore = reservations.length;
  assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "wall_text", prompt: "A".repeat(maxLength + 1), ...reference }, "too-long-wall-video"))).status, 400);
  assert.equal(jobs.length, before); assert.equal(reservations.length, creditsBefore);
});
test("legacy Recreate still requires an image; access checks, idempotency and failed-dispatch credit release are retained", async () => {
  assert.equal((await handleAIStudioVideoGeneration(post({ referenceType: "hook", referenceId: "hook-fixture", referenceVideoUrl: video, referenceVideoDurationSeconds: 2 }, "legacy"))).status, 400);
  authFails = true;
  try { assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "hook" }, "unauth"))).status, 401); } finally { authFails = false; }
  const body = { exploreFormat: "hook", avatarImageUrl: image, quantity: 2 };
  const first = await (await handleAIStudioVideoGeneration(post(body, "repeat"))).json(), before = jobs.length;
  assert.deepEqual((await (await handleAIStudioVideoGeneration(post(body, "repeat"))).json()).jobs, first.jobs);
  assert.equal(jobs.length, before);
  queueFails = true;
  try {
    assert.equal((await handleAIStudioVideoGeneration(post({ exploreFormat: "hook" }, "dispatch-fail"))).status, 402);
    assert.deepEqual(releases.at(-1), { idempotencyKey: "dispatch-fail", userId: "video-owner" });
  } finally { queueFails = false; }
});

test("automatic Hook text is frozen once per batch in both admission paths; preflight errors charge nothing", async () => {
  for (const atomic of [false, true]) {
    const before = jobs.length, planCount = automaticTextPlans.length;
    let inputs;
    const response = await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", referenceId: "hook-fixture", automaticHookText: true, quantity: 3 }, `auto-text-${atomic}`),
      atomic ? { startBatch: async batch => { inputs = batch.inputs; return Response.json({ ok: true }, { status: 202 }); } } : undefined);
    assert.equal(response.status, 202, await response.clone().text());
    if (!atomic) inputs = jobs.slice(before).map(job => job.input);
    assert.equal(inputs.length, 3); assert.equal(automaticTextPlans.length, planCount + 1);
    assert.ok(inputs.every(input => input.automaticHookText.requestKey === inputs[0].automaticHookText.requestKey));
    assert.equal(automaticTextPlans.at(-1).owner.uid, "video-owner");
  }
  const before = reservations.length; automaticTextPlanError = new Error("Business context is required.");
  try { const response = await handleAIStudioVideoGeneration(post({ exploreFormat: "hook", referenceId: "hook-fixture", automaticHookText: true }, "auto-preflight"));
    assert.equal(response.status, 409); assert.match((await response.json()).error, /Business context/); assert.equal(reservations.length, before);
  } finally { automaticTextPlanError = undefined; }
});


test("full-source assigned phases require an original-opening receipt and freeze duration-mapped words", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const version = startingFrameReceipt.version;
  try {
    const body = { ...frameBody, model: "google_omni", durationSeconds: 3, prompt: "OPENING: PHASE [0–0.25]: Keep mug at lips.\nENDING: PHASE [0.25–1]: Lower the mug and hold the surprised look." };
    startingFrameReceipt.version = 3;
    const before = reservations.length;
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 409);
    assert.equal(reservations.length, before);
    startingFrameReceipt.version = 4;
    for (const atomic of [false, true]) {
      let frozen;
      const response = await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), atomic ? { startBatch: async batch => { frozen = batch.inputs[0]; return Response.json({ok:true},{status:202}); } } : undefined);
      assert.equal(response.status, 202, await response.clone().text());
      frozen ??= jobs.at(-1).input;
      assert.match(frozen.hookIdea, /0–0.75s: Keep mug at lips/);
      assert.match(frozen.hookIdea, /0.75–3s: Lower the mug/);
      assert.doesNotMatch(frozen.hookIdea, /PHASE \[/);
    }
  } finally {
    startingFrameReceipt.version = version;
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("new opening jobs freeze source-speed action and a final hold in both admission paths", async () => {
  const prior = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const old = structuredClone(startingFrameReceipt);
  try {
    Object.assign(startingFrameReceipt, { version: 5, promptVersion: 7, imageModel: "nano_banana_2" });
    startingFrameReceipt.preparationInputKey = JSON.stringify({ version: 4, ownerId: startingFrameReceipt.ownerId,
      draftId: startingFrameReceipt.draftId, referenceId: startingFrameReceipt.referenceId, sourceSha256: startingFrameReceipt.sourceSha256,
      sourceFrame: startingFrameReceipt.sourceFrame, imageAssetIds: startingFrameReceipt.personImageAssetIds,
      instructions: startingFrameReceipt.instructions, imageModel: startingFrameReceipt.imageModel });
    startingFrameReceipt.inputKey = hookKeyframeGenerationInputKey(startingFrameReceipt);
    for (const atomic of [false, true]) {
      let frozen;
      const response = await handleAIStudioVideoGeneration(post({ ...frameBody, model: "google_omni", durationSeconds: 3,
        prompt: "OPENING: PHASE [0\u20130.25]: Keep mug at lips.\nENDING: PHASE [0.25\u20131]: Lower the mug and hold the surprised look." }, crypto.randomUUID()),
      atomic ? { startBatch: async batch => { frozen = batch.inputs[0]; return Response.json({ ok: true }, { status: 202 }); } } : undefined);
      assert.equal(response.status, 202, await response.clone().text()); frozen ??= jobs.at(-1).input;
      assert.equal(frozen.durationSeconds, 3); assert.equal(frozen.hookSourceTimeline.trimEndMs, 2433);
      assert.equal(frozen.hookSourceTimeline.sourceDurationSeconds, 73 / 30);
      assert.match(frozen.hookIdea, /0.61s/); assert.match(frozen.hookIdea, /FINAL HOLD/);
      assert.match(frozen.hookIdea, /2.43/); assert.match(frozen.hookIdea, /logos/i);
    }
  } finally {
    for (const key of Object.keys(startingFrameReceipt)) delete startingFrameReceipt[key]; Object.assign(startingFrameReceipt, old);
    if (prior === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = prior;
  }
});

test("new Hook source duration is authoritative: 4s/5s are retained and shorter requests fail before credits",async()=>{
 const prior=process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION,old=structuredClone(startingFrameReceipt);
 process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION="true";
 try{
  Object.assign(startingFrameReceipt,{version:5,promptVersion:7,imageModel:"nano_banana_2"});
  startingFrameReceipt.preparationInputKey=JSON.stringify({version:4,ownerId:startingFrameReceipt.ownerId,draftId:startingFrameReceipt.draftId,referenceId:startingFrameReceipt.referenceId,sourceSha256:startingFrameReceipt.sourceSha256,sourceFrame:startingFrameReceipt.sourceFrame,imageAssetIds:startingFrameReceipt.personImageAssetIds,instructions:startingFrameReceipt.instructions,imageModel:startingFrameReceipt.imageModel});
  startingFrameReceipt.inputKey=hookKeyframeGenerationInputKey(startingFrameReceipt);
  for(const source of [4,5,4.3]){
   startingFrameSourceDuration=source;const amount=reservations.length;
   const rejected=await handleAIStudioVideoGeneration(post({...frameBody,model:"google_omni",durationSeconds:3,prompt:"OPENING: PHASE [0–1]: Preserve all actions.",sourceDurationSeconds:2},crypto.randomUUID()));
   assert.equal(rejected.status,400);assert.match(await rejected.text(),/preserve the full source Hook/);assert.equal(reservations.length,amount);
   let input;const accepted=await handleAIStudioVideoGeneration(post({...frameBody,model:"google_omni",durationSeconds:Math.ceil(source),prompt:"OPENING: PHASE [0–1]: Preserve all actions."},crypto.randomUUID()),{startBatch:async batch=>{input=batch.inputs[0];return Response.json({ok:true},{status:202})}});
   assert.equal(accepted.status,202,await accepted.clone().text());assert.equal(input.hookSourceTimeline.trimEndMs,Math.round(source*1000));assert.equal(input.durationSeconds,Math.ceil(source));
  }
 }finally{startingFrameSourceDuration=73/30;for(const key of Object.keys(startingFrameReceipt))delete startingFrameReceipt[key];Object.assign(startingFrameReceipt,old);if(prior===undefined)delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION=prior;}
});
