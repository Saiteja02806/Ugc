import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, next) { return next(specifier === "next/server" ? "next/server.js" : specifier, context); } });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [], saved = new Map();
let authFails = false, queueFails = false;
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("./server-access.ts"), { namedExports: { requireAIStudioProUser: async () => { if (authFails) throw new FirebaseAuthRequestError("Sign in required"); return { uid: "video-owner" }; } } });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("../explore/hook-video-library.ts"), { namedExports: { isExploreHookVideoId: id => id === "hook-fixture" } });
mock.module(local("../explore/wall-text-video-library.ts"), { namedExports: { isExploreWallTextVideoId: id => id === "wall-fixture" } });
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
let referenceOwner = "video-owner";
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetForOwner: async ({ assetId, userId }) => {
  assert.equal(userId, "video-owner");
  return { id: assetId, user_id: referenceOwner, deleted_at: null, status: "ready", collection: "video", mime_type: "video/mp4", file_size_bytes: 1000, duration_seconds: 2.8, url: "https://owned-media.example.test/reference.mp4" };
} } });
mock.module(local("../billing/subscription-db.ts"), { namedExports: { BillingAccessError, deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (kind, duration) => { assert.equal(kind, "video"); return duration * 4; },
  reserveBillingCredits: async input => { reservations.push(input); }, releaseBillingCredits: async input => { releases.push(input); },
} });
const { handleAIStudioVideoGeneration } = await import("./video-generation-api.ts");
const image = "https://owned-media.example.test/reference.png", video = "https://owned-media.example.test/reference.mp4";
const prompt = 'A creator says: “Try this today.” Warm lighting and natural delivery.';
function post(body, key) { return new Request("https://www.getugcpilot.com/api/ai-studio/videos/generate", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ model: "google_omni", prompt, ...body }) }); }

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
test("video-only formats reject slideshow, mixed guidance, untrusted media and long clips before reserving credits", async () => {
  const before = reservations.length;
  for (const body of [{ exploreFormat: "slideshow" }, { exploreFormat: "hook", avatarImageUrl: image, referenceVideoUrl: video, referenceVideoDurationSeconds: 2 },
    { exploreFormat: "wall_text", avatarImageUrl: "https://untrusted.test/a.png" }, { exploreFormat: "hook", referenceVideoUrl: video, referenceVideoDurationSeconds: 3.1 },
    { exploreFormat: "hook", referenceVideoUrl: video }, { exploreFormat: "hook", model: "seedance_2_5", avatarImageUrl: image }]) {
    assert.equal((await handleAIStudioVideoGeneration(post(body, crypto.randomUUID()))).status, 400);
  }
  assert.equal(reservations.length, before);
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
