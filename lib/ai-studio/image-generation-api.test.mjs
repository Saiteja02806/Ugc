import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [];
const savedJobs = new Map();
let queueFails = false;
let authFails = false;
let ownedAttachment = { url: "https://owned-media.example.test/my-product.png", status: "ready", collection: "image", mime_type: "image/png", file_size_bytes: 128 };
const attachmentReads = [];
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }

// Mock all side effects while exercising the real API parser and queue payload.
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("./server-access.ts"), { namedExports: {
  requireAIStudioProUser: async () => { if (authFails) throw new FirebaseAuthRequestError("Sign in required"); return { uid: "image-owner" }; },
} });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: { getBackgroundJobById: async () => null, getMissingBackgroundJobStorageEnvVars: () => [] } });
mock.module(local("../jobs/background-job-service.ts"), { namedExports: {
  createAndDispatchBackgroundJob: async input => {
    if (queueFails) throw new BillingAccessError("Queue fixture unavailable");
    if (!savedJobs.has(input.idempotencyKey)) {
      savedJobs.set(input.idempotencyKey, { ...input, id: crypto.randomUUID() });
      jobs.push(input);
    }
    return savedJobs.get(input.idempotencyKey);
  },
} });
mock.module(local("../storage/storage.ts"), { namedExports: {
  isTrustedStorageUrl: url => new URL(url).hostname === "owned-media.example.test",
} });
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetForOwner: async input => { attachmentReads.push(input); return ownedAttachment; } } });
mock.module(local("../billing/subscription-db.ts"), { namedExports: {
  BillingAccessError,
  deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: kind => { assert.equal(kind, "image"); return 5; },
  reserveBillingCredits: async input => { reservations.push(input); },
  releaseBillingCredits: async input => { releases.push(input); },
} });
const { handleAIStudioImageGeneration } = await import("./image-generation-api.ts");
const referenceImageUrl = "https://owned-media.example.test/owned-reference.png";
function post(body, key) {
  return new Request("https://www.getugcpilot.com/api/ai-studio/images/generate", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body),
  });
}

test("the slideshow workflow tags its job and other formats cannot generate images", async () => {
  const before = jobs.length;
  const response = await handleAIStudioImageGeneration(post({ model: "nano_banana_2", prompt: "A replacement slide", aspectRatio: "4:5", quantity: 1, referenceImageUrl, exploreFormat: "slideshow" }, "explore-slideshow-test"));
  assert.equal(response.status, 202);
  assert.equal(jobs[before].input.exploreFormat, "slideshow");
  for (const exploreFormat of ["hook", "wall_text", "unknown"]) {
    const previous = jobs.length;
    assert.equal((await handleAIStudioImageGeneration(post({ model: "nano_banana_2", prompt: "An image", aspectRatio: "4:5", exploreFormat }, `invalid-${exploreFormat}`))).status, 400);
    assert.equal(jobs.length, previous);
  }
});

test("both selected models queue the exact model, ratio, reference and chosen batch size", async () => {
  for (const model of ["nano_banana_2", "seedream_5_pro"]) {
    const before = jobs.length;
    const response = await handleAIStudioImageGeneration(post({ model, prompt: "Natural adult portrait", aspectRatio: "4:5", quantity: 2, referenceImageUrl }, `${model}-batch`));
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.jobs.length, 2);
    for (const [index, job] of jobs.slice(before).entries()) {
      assert.equal(job.input.model, model);
      assert.equal(job.input.referenceImageUrl, referenceImageUrl);
      assert.equal(job.input.aspectRatio, "4:5");
      assert.equal(job.input.batchSize, 2);
      assert.equal(job.input.batchIndex, index + 1);
      assert.equal(job.jobType, "generate_image");
      assert.equal(job.projectId, "ai-studio");
      assert.equal(job.userId, "image-owner");
      assert.equal(reservations.find(reservation => reservation.idempotencyKey === job.idempotencyKey).amount, 5);
    }
  }
});

const attachmentId = "aa9b30ea-7950-480a-a51e-2cb66f1aa701";
test("slideshow ownership resolution preserves layout first, attachment second and exact instructions", async () => {
  const before = jobs.length;
  const prompt = "Keep image 1 layout. Use my product in image 2.";
  const response = await handleAIStudioImageGeneration(post({ model: "nano_banana_2", prompt, quantity: 1, referenceImageUrl, referenceImageAssetId: attachmentId, exploreFormat: "slideshow" }, "layout-and-product"));
  assert.equal(response.status, 202);
  assert.deepEqual(attachmentReads.at(-1), { assetId: attachmentId, userId: "image-owner" });
  assert.deepEqual(jobs[before].input.referenceImageUrls, [referenceImageUrl, ownedAttachment.url]);
  assert.equal(jobs[before].input.referenceImageUrl, referenceImageUrl);
  assert.equal(jobs[before].input.prompt, prompt);
  assert.equal("businessContext" in jobs[before].input, false);
});

test("an attachment alone keeps the legacy one-reference worker shape", async () => {
  const response = await handleAIStudioImageGeneration(post({ model: "seedream_5_pro", prompt: "Restyle my image", referenceImageAssetId: attachmentId, exploreFormat: "slideshow" }, "product-only"));
  assert.equal(response.status, 202);
  assert.equal(jobs.at(-1).input.referenceImageUrl, ownedAttachment.url);
  assert.equal("referenceImageUrls" in jobs.at(-1).input, false);
});

test("missing, unfinished, non-image and oversized owned references fail before credits or jobs", async () => {
  const original = ownedAttachment;
  const before = reservations.length, previousJobs = jobs.length;
  try {
    for (const invalid of [null, { ...original, status: "uploading" }, { ...original, collection: "video" }, { ...original, file_size_bytes: 26 * 1024 * 1024 }, { ...original, url: "https://outside.test/x.png" }]) {
      ownedAttachment = invalid;
      const response = await handleAIStudioImageGeneration(post({ prompt: "Use my image", referenceImageAssetId: attachmentId, exploreFormat: "slideshow" }, "bad-attachment"));
      assert.equal(response.status, 400);
    }
    for (const body of [{ referenceImageAssetId: "invalid" }, { referenceImageUrls: [referenceImageUrl] }, { referenceImageAssetId: attachmentId }]) {
      assert.equal((await handleAIStudioImageGeneration(post({ prompt: "Use my image", ...body }, "bad-reference"))).status, 400);
    }
    assert.equal(reservations.length, before); assert.equal(jobs.length, previousJobs);
  } finally { ownedAttachment = original; }
});

test("repeated Seedream submissions keep the original jobs and billing keys", async () => {
  const body = { model: "seedream_5_pro", prompt: "Same adult portrait", quantity: 2 };
  const first = await (await handleAIStudioImageGeneration(post(body, "repeat-seedream"))).json();
  const before = jobs.length;
  const second = await (await handleAIStudioImageGeneration(post(body, "repeat-seedream"))).json();
  assert.deepEqual(second.jobs, first.jobs);
  assert.equal(jobs.length, before);
  assert.deepEqual(reservations.slice(-2).map(item => item.idempotencyKey), ["repeat-seedream:1", "repeat-seedream:2"]);
});

test("omitted and removed model choices fall back to Nano Banana", async () => {
  for (const model of [undefined, "gpt_image", "flux_3"]) {
    const response = await handleAIStudioImageGeneration(post({ model, prompt: "Adult portrait" }, `fallback-${model}`));
    assert.equal(response.status, 202);
    assert.equal(jobs.at(-1).input.model, "nano_banana_2");
  }
});

test("authentication and trusted-reference checks still reject requests before reserving credits", async () => {
  const before = reservations.length;
  authFails = true;
  try {
    assert.equal((await handleAIStudioImageGeneration(post({ model: "seedream_5_pro", prompt: "Adult portrait" }, "unauthorized"))).status, 401);
  } finally { authFails = false; }
  assert.equal((await handleAIStudioImageGeneration(post({ model: "seedream_5_pro", prompt: "Adult portrait", referenceImageUrl: "https://untrusted.example.test/image.png" }, "untrusted"))).status, 400);
  assert.equal(reservations.length, before);
});

test("Seedream dispatch failure releases the existing credit reservation", async () => {
  queueFails = true;
  try {
    assert.equal((await handleAIStudioImageGeneration(post({ model: "seedream_5_pro", prompt: "Adult portrait" }, "failed-seedream"))).status, 402);
    assert.deepEqual(releases.at(-1), { idempotencyKey: "failed-seedream", userId: "image-owner" });
  } finally { queueFails = false; }
});
