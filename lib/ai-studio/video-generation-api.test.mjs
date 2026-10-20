import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import pairedCatalog from "../../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };

registerHooks({ resolve(specifier, context, next) { return next(specifier === "next/server" ? "next/server.js" : specifier, context); } });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [], saved = new Map();
let authFails = false, queueFails = false;
let galleryError;
let galleryDuration = 6.25;
const galleryReads = [];
mock.module(local("../explore/generation-video-reference.ts"), { namedExports: { resolveGalleryGenerationVideo: async (id, format) => {
  galleryReads.push({ id, format });
  if (galleryError) throw galleryError;
  return { url: "https://owned-media.example.test/gallery.mp4", durationSeconds: galleryDuration };
} } });
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("./server-access.ts"), { namedExports: { requireAIStudioProUser: async () => { if (authFails) throw new FirebaseAuthRequestError("Sign in required"); return { uid: "video-owner" }; } } });
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
let referenceOwner = "video-owner";
let uploadedDuration = 2.8;
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetsForOwnerByUrls: async ({ urls, userId }) => urls.map(url => ({ url, user_id: userId, collection: "image", mime_type: "image/png", status: "ready", deleted_at: null, file_size_bytes: 1000 })), getMediaAssetForOwner: async ({ assetId, userId }) => {
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
  assert.equal(jobs.at(-1).input.hookIdea, prompt);
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

test("paired references get trusted audio provenance in ordinary and workflow batches, including older Recreate entry points", async () => {
  for (const format of ["hook", "wall_text"]) {
    const reference = pairedCatalog.items.find(item => item.format === format);
    const expected = { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 };
    const body = { exploreFormat: format, referenceType: format, referenceId: reference.id, quantity: 2,
      referenceSoundtrack: { version: 1, referenceId: "untrusted", audioSha256: "0".repeat(64), volume: 1 } };
    const before = jobs.length;
    assert.equal((await handleAIStudioVideoGeneration(post(body, `paired-${format}`))).status, 202);
    assert.equal(jobs.length - before, 2);
    for (const job of jobs.slice(before)) assert.deepEqual(job.input.referenceSoundtrack, expected);
    let batch;
    assert.equal((await handleAIStudioVideoGeneration(post(body, `paired-batch-${format}`), { startBatch: async value => { batch = value; return new Response("{}", { status: 202 }); } })).status, 202);
    assert.equal(batch.inputs.length, 2);
    for (const input of batch.inputs) assert.deepEqual(input.referenceSoundtrack, expected);
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
        assert.ok(job.input.hookIdea.startsWith(prompt), "Spoken words must not be rewritten");
        if (exploreFormat === "hook") assert.equal(job.input.hookIdea, prompt);
        else assert.match(job.input.hookIdea, /Do not add text, captions, subtitles/);
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
    const images = Array.from({ length: 5 }, (_, index) => `https://owned-media.example.test/reference-${index}.png`);
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
      assert.equal(queued.referenceVideoMode, "edit"); assert.ok(queued.hookIdea.startsWith(combined));
      assert.equal(reservations.at(-1).amount, Math.round(seconds) * 4);
      let batch;
      assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()), { startBatch: async value => { batch = value; return Response.json({ ok: true }, { status: 202 }); } })).status, 202);
      assert.equal(batch.amountPerVideo, Math.round(seconds) * 4);
      assert.ok(batch.inputs.every(input => input.referenceVideoDurationSeconds === seconds && input.referenceVideoMode === "edit" && input.hookIdea.startsWith(combined)));
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
    { exploreFormat: "hook", referenceVideoMode: "edit", referenceVideoUrl: video, referenceVideoDurationSeconds: 2.8, referenceVideoAssetId: videoAssetId, referenceImageUrls: Array.from({ length: 6 }, (_, index) => `https://owned-media.example.test/image-${index}.png`) },
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
      assert.equal(jobs.at(-1).input.hookIdea, exploreFormat === "wall_text" ? `${longPrompt}\n${WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS}` : longPrompt);
    }
  }
});
test("video guidance reserves wall-instruction space and rejects excess length before charging", async () => {
  const { getExploreVideoPromptMaxLength } = await import("../explore/format-generation-prompt.ts");
  const maxLength = getExploreVideoPromptMaxLength({ model: "google_omni", hasReferenceVideo: true, format: "wall_text" });
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
