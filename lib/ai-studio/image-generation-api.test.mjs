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
  canonicalMediaReference: async (value, owner) => { assert.equal(owner, "image-owner"); return value; },
  isTrustedMediaReferenceUrl: url => new URL(url).hostname === "owned-media.example.test",
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
