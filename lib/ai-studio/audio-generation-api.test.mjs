import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });

const assetId = "0aeb9b1a-2222-4333-8444-555555555555";
const audioUrl = "https://storage.example.com/audio.mp3";
const videoAssetId = "0aeb9b1a-2222-4333-8444-777777777777";
const videoUrl = "https://storage.example.com/video.mp4";
let ownedVideo;
let ownedAsset;
let reserved = 0;
let queuedInput;
let uploadedObject;
let readyMetadata;

class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 403; }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => ({ uid: "owner" }) } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => ({ uid: "owner" }) } });
mock.module("@/lib/queues/job-queue", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("@/lib/explore/hook-video-library", { namedExports: { isExploreHookVideoId: () => false } });
mock.module("@/lib/explore/wall-text-video-library", { namedExports: { isExploreWallTextVideoId: () => false } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async () => null } });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async ({ input }) => { queuedInput = input; return { id: "mock-job", input }; } } });
mock.module("@/lib/storage/storage", { namedExports: {
  isTrustedStorageUrl: (url) => new URL(url).hostname === "storage.example.com",
  buildPublicStorageUrl: (key) => `https://storage.example.com/${key}`,
  headStorageObject: async () => uploadedObject,
} });
mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetForOwner: async ({ assetId: requestedId, userId }) => userId !== "owner" ? null : requestedId === assetId ? ownedAsset : requestedId === videoAssetId ? ownedVideo : null,
  markMediaAssetReady: async (metadata) => { readyMetadata = metadata; return { ...ownedAsset, status: "ready" }; },
  serializeMediaAsset: (asset) => asset,
} });
mock.module("@/lib/billing/subscription-db", { namedExports: {
  BillingAccessError,
  deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (_kind, seconds) => seconds * 4,
  releaseBillingCredits: async () => {},
  reserveBillingCredits: async () => { reserved++; },
} });

const { handleAIStudioVideoGeneration } = await import("./video-generation-api.ts");
const { POST: completeUpload } = await import("../../app/api/media/complete-upload/route.ts");
const { createMediaUploadTarget, MAX_AUDIO_UPLOAD_BYTES } = await import("../media/media-upload.ts");
const initialEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
beforeEach(() => { process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true"; });
after(() => { if (initialEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = initialEnabled; });

function reset() {
  reserved = 0;
  queuedInput = null;
  readyMetadata = null;
  uploadedObject = { ContentType: "audio/mpeg", ContentLength: 1024 };
  ownedAsset = { id: assetId, user_id: "owner", deleted_at: null, file_size_bytes: 1024, collection: "audio", status: "ready", mime_type: "audio/mpeg", storage_key: "audio/key.mp3", duration_seconds: 5, url: audioUrl };
  ownedVideo = { ...ownedAsset, id: videoAssetId, collection: "video", mime_type: "video/mp4", storage_key: "video/key.mp4", url: videoUrl };
}
function generate(body = {}) {
  return handleAIStudioVideoGeneration(new Request("https://getugcpilot.com/api/ai-studio/videos/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Use the reference audio and portrait", model: "seedance_2_5", durationSeconds: 5, resolution: "720p", referenceAudioUrls: [audioUrl], referenceAudioAssetIds: [assetId], ...body }),
  }));
}

test("passes owned audio with images and a video into the durable generation job", async () => {
  reset();
  const response = await generate({ referenceImageUrls: ["https://storage.example.com/image.jpg"], referenceVideoUrl: videoUrl, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 5 });
  assert.equal(response.status, 202);
  assert.deepEqual(queuedInput.referenceAudioUrls, [audioUrl]);
  assert.deepEqual(queuedInput.referenceImageUrls, ["https://storage.example.com/image.jpg"]);
  assert.equal(queuedInput.referenceVideoUrl, "https://storage.example.com/video.mp4");
  assert.equal(reserved, 1);
  assert.equal(queuedInput.provider, "openrouter");
  assert.deepEqual(queuedInput.referenceAudioAssetIds, [assetId]);
  assert.equal(queuedInput.referenceVideoAssetId, videoAssetId);
});
test("rejects another owner's audio and mismatched file URLs before reserving credits", async () => {
  reset();
  assert.equal((await generate({ referenceAudioAssetIds: ["0aeb9b1a-2222-4333-8444-666666666666"] })).status, 400);
  assert.equal((await generate({ referenceAudioUrls: ["https://storage.example.com/different.mp3"] })).status, 400);
  assert.equal(reserved, 0);
  assert.equal(queuedInput, null);
});
test("rejects unavailable models, oversized audio, and excessive combined reference counts before billing", async () => {
  reset();
  assert.equal((await generate({ model: "google_omni" })).status, 400);
  ownedAsset.duration_seconds = 31;
  assert.equal((await generate()).status, 400);
  ownedAsset.duration_seconds = 5;
  assert.equal((await generate({ referenceImageUrls: Array.from({ length: 30 }, (_, i) => `https://storage.example.com/${i}.jpg`) })).status, 400);
  assert.equal(reserved, 0);
});
test("accepts MP3/WAV upload targets with a separate audio size limit", () => {
  const input = { collection: "audio", fileName: "voice.mp3", contentType: "audio/mpeg", fileSize: 1024, userId: "owner" };
  assert.equal(createMediaUploadTarget(input).ok, true);
  assert.equal(createMediaUploadTarget({ ...input, contentType: "audio/wav", fileName: "voice.wav" }).ok, true);
  assert.equal(createMediaUploadTarget({ ...input, contentType: "video/mp4" }).ok, false);
  assert.equal(createMediaUploadTarget({ ...input, fileSize: MAX_AUDIO_UPLOAD_BYTES + 1 }).status, 413);
});

test("OpenRouter references allow 30-second files without Runway's unrelated combined-duration restriction", async () => {
  reset();
  ownedAsset.duration_seconds = 30;
  assert.equal((await generate()).status, 202);
  ownedAsset.duration_seconds = 25;
  assert.equal((await generate({ referenceVideoUrl: videoUrl, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 5 })).status, 202);
  assert.equal(reserved, 2);
  reset();
  assert.equal((await generate({
    referenceAudioUrls: Array.from({ length: 11 }, (_, i) => `https://storage.example.com/audio-${i}.mp3`),
    referenceAudioAssetIds: Array.from({ length: 11 }, (_, i) => `0aeb9b1a-2222-4333-8444-${String(i).padStart(12, "0")}`),
  })).status, 400);
  assert.equal(reserved, 0);
  assert.equal(queuedInput, null);
});

test("rejects foreign, unready, deleted, mismatched and oversized timed references before billing", async () => {
  for (const kind of ["audio", "video"]) {
    for (const patch of [{ user_id: "other" }, { status: "uploading" }, { deleted_at: "2026-10-04" },
      { collection: "image" }, { mime_type: "image/png" }, { duration_seconds: null }, { duration_seconds: 31 },
      { file_size_bytes: 251 * 1024 ** 2 }, { url: "https://storage.example.com/forged.mp4" }]) {
      reset();
      Object.assign(kind === "audio" ? ownedAsset : ownedVideo, patch);
      assert.equal((await generate({ referenceVideoUrl: videoUrl, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 5 })).status, 400, `${kind}: ${JSON.stringify(patch)}`);
      assert.equal(reserved, 0);
    }
  }
  reset();
  for (const patch of [{ referenceVideoUrl: videoUrl }, { referenceVideoAssetId: videoAssetId },
    { referenceVideoUrl: videoUrl, referenceVideoAssetId: videoAssetId, referenceVideoDurationSeconds: 4 },
    { referenceVideoUrl: videoUrl, referenceVideoAssetId: assetId, referenceVideoDurationSeconds: 5 }]) {
    assert.equal((await generate(patch)).status, 400);
  }
  assert.equal(reserved, 0);
});
test("completes an owned audio upload without fabricated width and height", async () => {
  reset();
  ownedAsset.status = "uploading";
  const response = await completeUpload(new Request("https://getugcpilot.com/api/media/complete-upload", {
    method: "POST", body: JSON.stringify({ assetId, key: "audio/key.mp3", durationSeconds: 5 }),
  }));
  assert.equal(response.status, 200);
  assert.equal(readyMetadata.width, null);
  assert.equal(readyMetadata.height, null);
  assert.equal(readyMetadata.ratio, "other");
  assert.equal(readyMetadata.durationSeconds, 5);
});
test("does not mark overlong or mismatched audio uploads ready", async () => {
  reset();
  const request = (seconds) => new Request("https://getugcpilot.com/api/media/complete-upload", {
    method: "POST", body: JSON.stringify({ assetId, key: "audio/key.mp3", durationSeconds: seconds }),
  });
  assert.equal((await completeUpload(request(31))).status, 400);
  uploadedObject.ContentType = "video/mp4";
  assert.equal((await completeUpload(request(5))).status, 422);
  assert.equal(readyMetadata, null);
});
