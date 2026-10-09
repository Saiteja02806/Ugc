import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

// Exercise the real client and real API handler, with all external writes replaced.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 403; }
const jobs = new Map(), reservations = new Map(), uploads = [];
const audioId = "11111111-1111-4111-8111-111111111111", videoId = "22222222-2222-4222-8222-222222222222";
const ownedAssets = new Map();
let failChild = null;
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async (request) => {
  if (request.headers.get("Authorization") !== "Bearer fake-owner-token") throw new FirebaseAuthRequestError("Sign in first.");
  return { uid: "owner-a" };
} } });
mock.module("@/lib/queues/job-queue", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async () => null } });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async (input) => {
  if (input.idempotencyKey.endsWith(`:${failChild}`)) throw new BillingAccessError("Second output could not start.");
  const key = `${input.userId}:${input.idempotencyKey}`;
  if (!jobs.has(key)) jobs.set(key, { id: `job-${jobs.size + 1}`, ...input });
  return jobs.get(key);
} } });
mock.module("@/lib/storage/storage", { namedExports: { isTrustedStorageUrl: (url) => new URL(url).hostname === "storage.example.com" } });
mock.module("@/lib/media/media-storage", { namedExports: { getMediaAssetForOwner: async ({ assetId, userId }) => {
  const asset = ownedAssets.get(assetId); return asset?.user_id === userId ? asset : null;
} } });
mock.module("@/lib/explore/hook-video-library", { namedExports: { isExploreHookVideoId: () => false } });
mock.module("@/lib/explore/wall-text-video-library", { namedExports: { isExploreWallTextVideoId: () => false } });
mock.module("@/lib/billing/subscription-db", { namedExports: {
  BillingAccessError, deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (_kind, seconds) => seconds * 4,
  reserveBillingCredits: async (input) => { reservations.set(`${input.userId}:${input.idempotencyKey}`, input); },
  releaseBillingCredits: async (input) => { reservations.delete(`${input.userId}:${input.idempotencyKey}`); },
} });
const { handleAIStudioVideoGeneration } = await import("../lib/ai-studio/video-generation-api.ts");
const { createWorkflowGenerationClient } = await import("../lib/explore/workflow-generation-client.ts");
const { normalizeWorkflowGenerationSettings } = await import("../lib/explore/workflow-generation-settings.ts");
const initialEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
const initialWanEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
beforeEach(() => { jobs.clear(); reservations.clear(); ownedAssets.clear(); uploads.length = 0; failChild = null; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true"; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true"; });
after(() => { if (initialEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = initialEnabled; });
after(() => { if (initialWanEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = initialWanEnabled; });

const draft = (overrides = {}) => ({ kind: "hook", instructions: "A creator explains a useful app.", settings: normalizeWorkflowGenerationSettings({ model: "google_omni", quantity: 2 }, true), creator: null, appScreen: null, videoReference: null, audioReference: null, ...overrides });
function client(overrides = {}) {
  return createWorkflowGenerationClient({
    assertActive() {}, getOwnerToken: async () => "fake-owner-token", createIdempotencyKey: () => "submission",
    uploadImage: async (image) => { uploads.push(image); return { url: `https://storage.example.com/${uploads.length}.png` }; },
    uploadReference: async (source, kind) => {
      uploads.push(source);
      const id = kind === "audio" ? audioId : videoId, url = `https://storage.example.com/${kind}.media`;
      ownedAssets.set(id, { id, url, user_id: "owner-a", collection: kind, status: "ready", deleted_at: null,
        duration_seconds: source.duration, mime_type: source.file.type, file_size_bytes: source.file.size });
      return { assetId: id, url, duration: source.duration };
    },
    fetch: async (url, init) => {
      assert.equal(url, "/api/ai-studio/videos/generate");
      return handleAIStudioVideoGeneration(new Request(`https://www.getugcpilot.com${url}`, init));
    },
    ...overrides,
  });
}

test("both workflow clients reach the real API's text-only contract for every available model", async () => {
  for (const kind of ["hook", "phone"]) {
    for (const model of ["kling_3_0", "google_omni", "seedance_2_5", "wan_3_0"]) {
      jobs.clear(); reservations.clear();
      const input = draft({ kind, settings: normalizeWorkflowGenerationSettings({ model, quantity: 2 }, true) });
      const batch = await client().generate(input);
      assert.equal(batch.jobs.length, 2);
      assert.equal(batch.partial, false);
      assert.equal(uploads.length, 0);
      for (const job of jobs.values()) {
        assert.equal(job.jobType, "generate_hook_video");
        assert.equal(job.userId, "owner-a");
        assert.equal(job.projectId, "ai-studio");
        assert.equal(job.input.model, model);
        assert.equal(job.input.hookIdea, input.instructions);
        assert.deepEqual(job.input.referenceImageUrls, []);
        assert.equal(job.input.provider, model === "seedance_2_5" || model === "wan_3_0" ? "openrouter" : undefined);
      }
      assert.equal(reservations.size, 2);
    }
  }
});

test("creator and app screenshots reach the real API as uploaded multi-image guidance", async () => {
  for (const model of ["google_omni", "seedance_2_5", "wan_3_0"]) {
    jobs.clear(); reservations.clear(); uploads.length = 0;
    await client().generate(draft({ kind: "phone", settings: normalizeWorkflowGenerationSettings({ model }, true),
      creator: { name: "creator.png", url: "blob:creator" }, appScreen: { name: "app.png", url: "blob:app", kind: "image" },
    }));
    const job = [...jobs.values()][0];
    assert.deepEqual(job.input.referenceImageUrls, ["https://storage.example.com/1.png", "https://storage.example.com/2.png"]);
    assert.equal(job.input.avatarImageUrl, job.input.referenceImageUrls[0]);
    assert.equal(uploads.length, 2);
    assert.equal(reservations.size, 1);
  }
});

test("both Explore workflows send owned Create audio/video to OpenRouter, independently of appended demos", async () => {
  for (const kind of ["hook", "phone"]) {
    jobs.clear(); reservations.clear(); uploads.length = 0;
    const reference = (media) => ({ name: `${media}.media`, url: `blob:${media}`, duration: 30, file: { type: `${media}/${media === "audio" ? "mpeg" : "mp4"}`, size: 1024 } });
    await client().generate(draft({ kind, settings: normalizeWorkflowGenerationSettings({ model: "seedance_2_5" }, true),
      videoReference: kind === "hook" ? reference("video") : null,
      appScreen: kind === "phone" ? { ...reference("video"), kind: "video" } : null, audioReference: reference("audio"),
      demo: { url: "blob:not-a-reference" }, demoAudio: { url: "blob:not-reference-audio" },
    }));
    const input = [...jobs.values()][0].input;
    assert.equal(input.provider, "openrouter");
    assert.equal(input.referenceVideoAssetId, videoId);
    assert.equal(input.referenceVideoDurationSeconds, 30);
    assert.deepEqual(input.referenceAudioAssetIds, [audioId]);
    assert.deepEqual(input.referenceAudioUrls, ["https://storage.example.com/audio.media"]);
    assert.equal(uploads.length, 2);
    assert.equal(reservations.size, 1);
    assert.doesNotMatch(JSON.stringify(input), /blob:|demoAssetId|demoAudioAssetId|backgroundAssetId/);
  }
});

test("timed-reference ownership is also checked before Explore's atomic startBatch adapter", async () => {
  const body = { model: "seedance_2_5", prompt: "A creator explains an app", durationSeconds: 5, resolution: "720p",
    referenceAudioUrls: ["https://storage.example.com/audio.media"], referenceAudioAssetIds: [audioId] };
  let starts = 0;
  const invoke = () => handleAIStudioVideoGeneration(new Request("https://www.getugcpilot.com/api/ai-studio/videos/workflow-start", {
    method: "POST", headers: { Authorization: "Bearer fake-owner-token" }, body: JSON.stringify(body),
  }), { startBatch: async (batch) => {
    starts++;
    assert.equal(batch.inputs[0].provider, "openrouter");
    assert.deepEqual(batch.inputs[0].referenceAudioAssetIds, [audioId]);
    return new Response(null, { status: 202 });
  } });
  assert.equal((await invoke()).status, 400);
  assert.equal(starts, 0);
  ownedAssets.set(audioId, { id: audioId, url: body.referenceAudioUrls[0], user_id: "owner-a", collection: "audio", status: "ready",
    deleted_at: null, duration_seconds: 5, mime_type: "audio/mpeg", file_size_bytes: 1024 });
  assert.equal((await invoke()).status, 202);
  assert.equal(starts, 1);
  assert.equal(reservations.size, 0); // Only the adapter owns the atomic reservation.
});

test("a lost API acknowledgement recovers the same durable child IDs and reservation keys", async () => {
  let attempts = 0;
  const actual = client({ fetch: async (url, init) => {
    const result = await handleAIStudioVideoGeneration(new Request(`https://www.getugcpilot.com${url}`, init));
    if (++attempts === 1) throw new Error("acknowledgement lost");
    return result;
  } });
  const input = draft();
  await assert.rejects(actual.generate(input), /acknowledgement lost/);
  const ids = [...jobs.values()].map((job) => job.id);
  const recovered = await actual.generate(input);
  assert.deepEqual(recovered.jobs.map((job) => job.jobId), ids);
  assert.equal(jobs.size, 2);
  assert.equal(reservations.size, 2);
});

test("a real partial acknowledgement keeps started jobs without retrying the missing outputs", async () => {
  failChild = 2;
  const batch = await client().generate(draft({ settings: normalizeWorkflowGenerationSettings({ model: "google_omni", quantity: 4 }, true) }));
  assert.equal(batch.partial, true);
  assert.equal(batch.jobs.length, 1);
  assert.equal(jobs.size, 1);
  assert.equal(reservations.size, 1);
  assert.match(batch.message, /1 of 4/);
});

test("the real API rejects unauthenticated or untrusted references before any billing or job creation", async () => {
  await assert.rejects(client({ getOwnerToken: async () => "wrong-owner-token" }).generate(draft()), /Sign in/);
  await assert.rejects(client({ uploadImage: async () => ({ url: "https://untrusted.example.com/image.png" }) }).generate(draft({ creator: { name: "creator.png", url: "blob:creator" } })), /reference/i);
  assert.equal(jobs.size, 0);
  assert.equal(reservations.size, 0);
});
