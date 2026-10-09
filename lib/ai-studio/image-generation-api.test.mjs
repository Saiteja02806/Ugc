import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [];
const referenceReads = [];
const savedJobs = new Map();
let queueFails = false;
let authFails = false;
let attachmentAsset = {
  id: "11111111-1111-4111-8111-111111111111", collection: "image", status: "ready",
  mime_type: "image/png", file_size_bytes: 1024, url: "https://owned-media.example.test/subject.png",
};
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
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (value, owner) => { assert.equal(owner, "image-owner"); referenceReads.push({ value, owner }); if (typeof value === "string" && value.includes("foreign")) throw new Error("Reference unavailable"); return value; },
  isTrustedMediaReferenceUrl: url => new URL(url).hostname === "owned-media.example.test",
} });
mock.module(local("../media/media-storage.ts"), { namedExports: {
  getMediaAssetForOwner: async ({ assetId, userId }) => {
    assert.equal(userId, "image-owner");
    return assetId === "11111111-1111-4111-8111-111111111111" ? attachmentAsset : null;
  },
} });
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

test("Instructions attachments follow the complete layout context with explicit new-job roles", async () => {
  const layouts = [referenceImageUrl, "https://owned-media.example.test/layout-2.png"];
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const before = jobs.length;
    const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", model, prompt: "Keep the design and use my product", referenceImageUrls: layouts, referenceImageAssetId: attachmentAsset.id }, crypto.randomUUID()));
    assert.equal(response.status, 202);
    assert.deepEqual(jobs[before].input.referenceImageUrls, [...layouts, attachmentAsset.url]);
    assert.equal(jobs[before].input.subjectReferenceIndex, 3);
    assert.equal(jobs[before].input.prompt, "Keep the design and use my product");
  }
});

test("missing or unready Instructions attachments cannot reserve credits or dispatch", async () => {
  const before = jobs.length, credits = reservations.length;
  const saved = attachmentAsset;
  try {
    for (const asset of [null, { ...saved, status: "processing" }, { ...saved, collection: "video" }, { ...saved, file_size_bytes: 25 * 1024 * 1024 + 1 }]) {
      attachmentAsset = asset;
      const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", model: "nano_banana_2", prompt: "Use my product", referenceImageUrl, referenceImageAssetId: saved.id }, crypto.randomUUID()));
      assert.equal(response.status, 400);
    }
  } finally { attachmentAsset = saved; }
  assert.equal(jobs.length, before);
  assert.equal(reservations.length, credits);
});

test("all selected slideshow references are checked for this owner and frozen into each requested output", async () => {
  const urls = Array.from({ length: 12 }, (_, index) => `https://owned-media.example.test/slide-${index}.png`);
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const before = jobs.length, reads = referenceReads.length;
    const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", model, prompt: "Use my brand style", quantity: 2, referenceImageUrls: urls }, crypto.randomUUID()));
    assert.equal(response.status, 202);
    assert.equal(jobs.length - before, 2);
    for (const job of jobs.slice(before)) {
      assert.deepEqual(job.input.referenceImageUrls, urls);
      assert.equal(job.input.referenceImageUrl, urls[0]);
      assert.equal(job.input.batchSize, 2);
    }
    assert.deepEqual(referenceReads.slice(reads).filter(read => read.value).map(read => read.value), urls);
  }
});

test("invalid, foreign, duplicated or mismatched contexts cannot reserve credits or enqueue jobs", async () => {
  const before = jobs.length, credits = reservations.length;
  const invalid = [[], null, "url", [referenceImageUrl, referenceImageUrl], ["https://evil.test/image.png"], [referenceImageUrl, "https://owned-media.example.test/foreign.png"], [referenceImageUrl, 2], Array.from({length: 15}, (_, i) => `https://owned-media.example.test/${i}.png`)];
  for (const referenceImageUrls of invalid) {
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Instructions", referenceImageUrls }, crypto.randomUUID()))).status, 400);
  }
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Instructions", referenceImageUrl, referenceImageUrls: ["https://owned-media.example.test/another.png"] }, crypto.randomUUID()))).status, 400);
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Instructions", referenceImageUrl: "https://evil.test/ignored.png", referenceImageUrls: [referenceImageUrl] }, crypto.randomUUID()))).status, 400);
  assert.equal((await handleAIStudioImageGeneration(post({ prompt: "Instructions", referenceImageUrls: [referenceImageUrl] }, crypto.randomUUID()))).status, 400);
  assert.equal(jobs.length, before);
  assert.equal(reservations.length, credits);
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

test("long instructions reach both selected providers without truncation", async () => {
 const prompt = "Preserve the detailed natural-light composition. ".repeat(500) + "Final detail: no text.";
 for (const model of ["nano_banana_2", "seedream_5_pro"]) {
  const response = await handleAIStudioImageGeneration(post({model,prompt}, crypto.randomUUID()));
  assert.equal(response.status,202); assert.equal(jobs.at(-1).input.prompt,prompt);
 }
});
test("blank prompts stay invalid before billing or job creation", async () => {
 const before=reservations.length;
 assert.equal((await handleAIStudioImageGeneration(post({prompt:" ",model:"nano_banana_2"},crypto.randomUUID()))).status,400);
 assert.equal(reservations.length,before);
});
test("a four-image batch creates four durable jobs and reserves each output", async () => {
 const before=jobs.length, credits=reservations.length;
 assert.equal((await handleAIStudioImageGeneration(post({prompt:"Adult creator portrait",quantity:4,model:"seedream_5_pro"},crypto.randomUUID()))).status,202);
 assert.equal(jobs.length-before,4); assert.equal(reservations.length-credits,4);
 assert.deepEqual(jobs.slice(before).map(job=>job.input.batchIndex),[1,2,3,4]);
 assert.ok(jobs.slice(before).every(job=>job.input.model==="seedream_5_pro"));
});
test("omitted model defaults to Nano Banana and explicit unavailable models stay rejected", async () => {
 assert.equal((await handleAIStudioImageGeneration(post({prompt:"Adult portrait"},crypto.randomUUID()))).status,202);
 assert.equal(jobs.at(-1).input.model,"nano_banana_2");
 const before=reservations.length;
 for(const model of ["gpt_image","flux_3"]) assert.equal((await handleAIStudioImageGeneration(post({model,prompt:"Adult portrait"},crypto.randomUUID()))).status,400);
 assert.equal(reservations.length,before);
});

test("slideshow requests default to GPT Image 2.5 and preserve the selected reference in every queued image", async () => {
  for (const model of [undefined, "gpt_image_2_5", "nano_banana_2"]) {
    const before = jobs.length;
    const response = await handleAIStudioImageGeneration(post({
      exploreFormat: "slideshow", model, prompt: "Recreate this slide with my product",
      aspectRatio: "9:16", quantity: 2, referenceImageUrl,
    }, crypto.randomUUID()));
    assert.equal(response.status, 202);
    assert.equal(jobs.length - before, 2);
    for (const job of jobs.slice(before)) {
      assert.equal(job.input.model, model ?? "gpt_image_2_5");
      assert.equal(job.input.exploreFormat, "slideshow");
      assert.equal(job.input.referenceImageUrl, referenceImageUrl);
    }
  }
});

test("slideshow Seedream requests are rejected before billing while Studio retains its existing models", async () => {
  const before = reservations.length;
  assert.equal((await handleAIStudioImageGeneration(post({
    exploreFormat: "slideshow", model: "seedream_5_pro", prompt: "My slide",
  }, crypto.randomUUID()))).status, 400);
  assert.equal(reservations.length, before);
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
