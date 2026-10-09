import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
let signedIn = true;
let reserved = [];
let queued = [];
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 403; }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => {
  if (!signedIn) throw new FirebaseAuthRequestError("Sign in first");
  return { uid: "owner" };
} } });
mock.module("@/lib/queues/job-queue", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async () => null } });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async (job) => {
  queued.push(job); return { id: `job-${queued.length}`, input: job.input };
} } });
mock.module("@/lib/storage/storage", { namedExports: { isTrustedStorageUrl: (url) => new URL(url).hostname === "storage.example.com" } });
mock.module("@/lib/media/media-storage", { namedExports: { getMediaAssetForOwner: async () => null } });
mock.module("@/lib/explore/hook-video-library", { namedExports: { isExploreHookVideoId: (id) => id === "hook-reference" } });
mock.module("@/lib/explore/wall-text-video-library", { namedExports: { isExploreWallTextVideoId: (id) => id === "wall-reference" } });
mock.module("@/lib/billing/subscription-db", { namedExports: {
  BillingAccessError, deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (_kind, seconds) => seconds * 4,
  releaseBillingCredits: async () => {}, reserveBillingCredits: async (input) => { reserved.push(input); },
} });
const { handleAIStudioVideoGeneration } = await import("./video-generation-api.ts");
const initialEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
const initialWanEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
beforeEach(() => { signedIn = true; reserved = []; queued = []; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true"; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true"; });
after(() => { if (initialEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = initialEnabled; });
after(() => { if (initialWanEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = initialWanEnabled; });
function generate(body = {}) {
  return handleAIStudioVideoGeneration(new Request("https://getugcpilot.com/api/ai-studio/videos/generate", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "test-submission" },
    body: JSON.stringify({ model: "seedance_2_5", prompt: "A ceramic cup in soft daylight", durationSeconds: 5, resolution: "720p", ...body }),
  }));
}

test("new Seedance jobs freeze OpenRouter routing and preserve full prompt and image guidance", async () => {
  const prompt = "x".repeat(5000);
  const response = await generate({ prompt, durationSeconds: 30, resolution: "480p", quantity: 2, referenceImageUrls: ["https://storage.example.com/person.png"] });
  assert.equal(response.status, 202);
  assert.equal(queued.length, 2);
  for (const { input } of queued) {
    assert.equal(input.provider, "openrouter"); assert.equal(input.model, "seedance_2_5");
    assert.equal(input.hookIdea, prompt); assert.equal(input.promptMode, "direct");
    assert.equal(input.durationSeconds, 30); assert.equal(input.resolution, "480p");
    assert.deepEqual(input.referenceImageUrls, ["https://storage.example.com/person.png"]);
  }
  assert.deepEqual(reserved.map((reservation) => reservation.amount), [120, 120]);
});

test("both Explore formats require the image and retain the chosen model and source context", async () => {
  for (const [referenceType, referenceId] of [["hook", "hook-reference"], ["wall_text", "wall-reference"]]) {
    assert.equal((await generate({ referenceType, referenceId })).status, 400);
    const referenceUrl = "https://storage.example.com/source.mp4";
    assert.equal((await generate({ referenceType, referenceId, referenceUrl, referenceImageUrls: ["https://storage.example.com/person.png"] })).status, 202);
    const input = queued.at(-1).input;
    assert.equal(input.referenceType, referenceType); assert.equal(input.referenceId, referenceId);
    assert.equal(input.referenceUrl, referenceUrl); assert.equal(input.provider, "openrouter");
  }
  assert.equal(reserved.length, 2);
});

test("unavailable Seedance and unauthenticated requests never reserve credits or enqueue", async () => {
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "false";
  assert.equal((await generate()).status, 503);
  signedIn = false;
  assert.equal((await generate()).status, 401);
  assert.equal(reserved.length, 0); assert.equal(queued.length, 0);
});

test("invalid model, duration, quality and references fail before billing", async () => {
  for (const body of [{ model: "bytedance/seedance-2.5" }, { durationSeconds: 3 }, { durationSeconds: 31 }, { durationSeconds: 4.5 }, { resolution: "1080p" }, { resolution: "4K" }, { referenceImageUrls: ["https://untrusted.example/image.png"] }, { referenceImageUrls: Array.from({ length: 7 }, (_, i) => `https://storage.example.com/${i}.png`) }, { referenceVideoUrl: "https://storage.example.com/video.mp4" }]) {
    assert.equal((await generate(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(reserved.length, 0); assert.equal(queued.length, 0);
});

test("Kling and Omni remain usable independently of the Seedance availability gate", async () => {
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "false";
  for (const model of ["kling_3_0", "google_omni"]) {
    assert.equal((await generate({ model })).status, 202);
    assert.equal(queued.at(-1).input.model, model);
    assert.equal(queued.at(-1).input.provider, undefined);
  }
});

test("WAN queues three-second image hooks through OpenRouter with matching application credits", async () => {
  const response = await generate({ model: "wan_3_0", durationSeconds: 3, resolution: "1080p", quantity: 2,
    referenceImageUrls: ["https://storage.example.com/person.png"] });
  assert.equal(response.status, 202);
  assert.equal(queued.length, 2);
  for (const { input } of queued) {
    assert.equal(input.provider, "openrouter"); assert.equal(input.model, "wan_3_0");
    assert.equal(input.durationSeconds, 3); assert.equal(input.resolution, "1080p");
    assert.deepEqual(input.referenceImageUrls, ["https://storage.example.com/person.png"]);
  }
  assert.deepEqual(reserved.map(row => row.amount), [12, 12]);
});

test("WAN supports boundary durations, every resolution and both Explore format generators", async () => {
  for (const durationSeconds of [2, 30]) for (const resolution of ["480p", "720p", "1080p"]) {
    assert.equal((await generate({ model: "wan_3_0", durationSeconds, resolution })).status, 202);
    assert.equal(queued.at(-1).input.durationSeconds, durationSeconds);
  }
  for (const exploreFormat of ["hook", "wall_text"]) {
    assert.equal((await generate({ model: "wan_3_0", durationSeconds: 3, exploreFormat })).status, 202);
    assert.equal(queued.at(-1).input.exploreFormat, exploreFormat);
    assert.equal(queued.at(-1).input.provider, "openrouter");
  }
});

test("WAN availability is independent and respects the rollout switch before billing", async () => {
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "false";
  assert.equal((await generate({ model: "wan_3_0", durationSeconds: 3 })).status, 202);
  process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "false";
  assert.equal((await generate({ model: "wan_3_0", durationSeconds: 3 })).status, 503);
  assert.equal(queued.length, 1); assert.equal(reserved.length, 1);
});

test("invalid WAN settings and unsupported timed references never reserve or queue", async () => {
  for (const patch of [
    { durationSeconds: 1 }, { durationSeconds: 31 }, { durationSeconds: 2.5 }, { durationSeconds: "3" }, { durationSeconds: null },
    { resolution: "4K" }, { resolution: ["480p"] }, { aspectRatio: "1:1" },
    { referenceVideoUrl: "https://storage.example.com/clip.mp4" },
    { referenceAudioUrls: ["https://storage.example.com/voice.mp3"], referenceAudioAssetIds: ["11111111-1111-4111-8111-111111111111"] },
    { referenceImageUrls: Array.from({ length: 7 }, (_, i) => `https://storage.example.com/${i}.png`) },
  ]) assert.equal((await generate({ model: "wan_3_0", ...patch })).status, 400, JSON.stringify(patch));
  assert.equal((await generate({ model: "google_omni", durationSeconds: 2 })).status, 400);
  assert.equal(reserved.length, 0); assert.equal(queued.length, 0);
});
