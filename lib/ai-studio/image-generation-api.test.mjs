import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import { slideshowBusinessContextPrompt } from "../../worker/src/lib/slideshow-business-context.ts";
import { slideshowGenerationPrompt } from "../../worker/src/lib/slideshow-generation-contract.ts";
import { slideshowSlotPrompt } from "../../worker/src/lib/slideshow-generation-batch.ts";

registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const local = file => new URL(file, import.meta.url);
const jobs = [], reservations = [], releases = [];
const referenceReads = [];
const savedJobs = new Map();
let contextFails = false;
class SlideshowBusinessContextUnavailableError extends Error { status = 409; }
mock.module(local("../explore/slideshow-business-context.ts"), { namedExports: {
  SlideshowBusinessContextUnavailableError,
  loadSlideshowBusinessContext: async owner => { assert.equal(owner, "image-owner"); if (contextFails) throw new SlideshowBusinessContextUnavailableError("Save business context first"); return { businessProfileId: "business-profile", businessProfileVersion: 3, businessContext: { businessName: "UGC Pilot", productSummary: "Content creation for businesses" } }; },
  slideshowBusinessContextPrompt,
} });
let queueFails = false;
let authFails = false;
let attachmentAsset = {
  id: "11111111-1111-4111-8111-111111111111", collection: "image", status: "ready",
  mime_type: "image/png", file_size_bytes: 1024, url: "https://owned-media.example.test/subject.png",
};
const extraAssets = new Map(Array.from({ length: 14 }, (_, index) => {
  const id = `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`;
  return [id, { ...attachmentAsset, id, url: `https://owned-media.example.test/extra-${index + 1}.png` }];
}));
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
    return assetId === "11111111-1111-4111-8111-111111111111" ? attachmentAsset : extraAssets.get(assetId) ?? null;
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

test("five selected slides and two versions create ten ordered, independently billed outputs with business context", async () => {
  const layouts = Array.from({ length: 5 }, (_, index) => `https://owned-media.example.test/slide-${index + 1}.png`);
  for (const model of ["gpt_image_2_5_flare", "gpt_image_2_5"]) {
    const key = crypto.randomUUID(), before = jobs.length, credits = reservations.length;
    const input = { exploreFormat: "slideshow", model, prompt: "Adapt the reference to my business", referenceImageUrls: layouts, quantity: 2, slideshowSlideCount: 5 };
    const response = await handleAIStudioImageGeneration(post(input, key));
    assert.equal(response.status, 202);
    const result = await response.json();
    assert.equal(result.jobs.length, 10); assert.equal(result.partial, false);
    assert.equal(reservations.length - credits, 10);
    for (const [index, queued] of jobs.slice(before).entries()) {
      assert.deepEqual(queued.input.slideshowGeneration, { version: 1, batchKey: key, slideIndex: index % 5 + 1, slideCount: 5, versionIndex: Math.floor(index / 5) + 1, versionCount: 2 });
      assert.equal(queued.input.slideshowReferenceContract.styleReferenceIndices[0], index % 5 + 1);
      assert.equal(queued.input.slideshowReferenceContract.version, 3);
      assert.equal(queued.input.prompt, input.prompt);
      assert.equal(queued.input.slideshowBusinessContext.businessContext.businessName, "UGC Pilot");
      assert.equal(queued.input.businessProfileVersion, 3);
    }
    const replay = await (await handleAIStudioImageGeneration(post(input, key))).json();
    assert.deepEqual(replay.jobs, result.jobs); assert.equal(jobs.length - before, 10);
  }
});

test("invalid deck sizes and missing business context cannot reserve credits", async () => {
  const before = reservations.length;
  for (const count of [0, 11, 2.5, "5"]) {
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Create slides", referenceImageUrl, slideshowSlideCount: count }, crypto.randomUUID()))).status, 400);
  }
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Create slides", referenceImageUrl, slideshowSlideCount: 5 }, crypto.randomUUID()))).status, 400);
  contextFails = true;
  try { assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Create slides", referenceImageUrl }, crypto.randomUUID()))).status, 409); }
  finally { contextFails = false; }
  assert.equal(reservations.length, before);
});

test("AI Studio and slideshow submit each selected image with distinct IDs and preserve the count on replay", async () => {
  for (const exploreFormat of [undefined, "slideshow"]) for (const quantity of [2, 3]) {
    const key = crypto.randomUUID(), before = jobs.length;
    const body = { prompt: "Create an adult presenter portrait", quantity,
      model: exploreFormat ? "gpt_image_2_5" : "seedream_5_pro",
      ...(exploreFormat ? { exploreFormat, referenceImageUrl } : {}) };
    const response = await handleAIStudioImageGeneration(post(body, key));
    assert.equal(response.status, 202);
    const batch = await response.json();
    assert.equal(batch.jobs.length, quantity);
    assert.equal(batch.partial, false);
    assert.equal(jobs.length - before, quantity);
    assert.equal(new Set(batch.jobs.map(j => j.generationId)).size, quantity);
    assert.ok(jobs.slice(before).every((j, i) => j.input.batchSize === quantity && j.input.batchIndex === i + 1));
    const replay = await (await handleAIStudioImageGeneration(post(body, key))).json();
    assert.deepEqual(replay.jobs, batch.jobs);
    assert.equal(jobs.length - before, quantity);
  }
});
test("invalid image counts are rejected before reserving credits rather than silently becoming one image", async () => {
  const before = jobs.length, creditCount = reservations.length;
  for (const quantity of [0, 5, 1.5, "3", null]) {
    assert.equal((await handleAIStudioImageGeneration(post({ prompt: "An adult presenter", quantity }, crypto.randomUUID()))).status, 400);
  }
  assert.equal(jobs.length, before); assert.equal(reservations.length, creditCount);
});

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

test("six slideshow layouts and both attached images reach every requested output in selection order", async () => {
  const layouts = Array.from({ length: 6 }, (_, index) => `https://owned-media.example.test/layout-${index + 1}.png`);
  const ids = [attachmentAsset.id, [...extraAssets.keys()][0]];
  const urls = [...layouts, attachmentAsset.url, extraAssets.get(ids[1]).url];
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const before = jobs.length;
    const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", model, prompt: "Use both of my images as references", quantity: 2, referenceImageUrls: layouts, referenceImageAssetIds: ids }, crypto.randomUUID()));
    assert.equal(response.status, 202);
    assert.equal(jobs.length - before, 2);
    for (const queued of jobs.slice(before)) {
      assert.deepEqual(queued.input.referenceImageUrls, urls);
      assert.equal(queued.input.additionalReferenceStartIndex, 7);
      assert.equal(queued.input.subjectReferenceIndex, undefined);
      assert.equal(queued.input.prompt, "Use both of my images as references");
    }
  }
});

test("attachments work without a catalogue and the fourteen-image bound includes slideshow layouts", async () => {
  const ids = [...extraAssets.keys()];
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageAssetIds: ids }, crypto.randomUUID()));
  assert.equal(response.status, 202);
  assert.deepEqual(jobs.at(-1).input.referenceImageUrls, ids.map(id => extraAssets.get(id).url));
  assert.equal(jobs.at(-1).input.additionalReferenceStartIndex, 1);
  const credits = reservations.length, before = jobs.length;
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageUrl, referenceImageAssetIds: ids }, crypto.randomUUID()))).status, 400);
  assert.equal(reservations.length, credits);
  assert.equal(jobs.length, before);
});

test("regeneration keeps the visible attachment order and gives the existing slide its own role", async () => {
  const ids = [...extraAssets.keys()].slice(0, 2);
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my first image for the product", referenceImageUrl, referenceImageAssetIds: ids, regenerationImageAssetId: attachmentAsset.id }, crypto.randomUUID()));
  assert.equal(response.status, 202);
  assert.deepEqual(jobs.at(-1).input.referenceImageUrls, [referenceImageUrl, ...ids.map(id => extraAssets.get(id).url), attachmentAsset.url]);
  assert.equal(jobs.at(-1).input.additionalReferenceStartIndex, 2);
  assert.equal(jobs.at(-1).input.regenerationReferenceIndex, 4);
  const credits = reservations.length;
  for (const input of [{ regenerationImageAssetId: "bad-id" }, { regenerationImageAssetId: crypto.randomUUID() }]) {
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my image", referenceImageAssetIds: ids, ...input }, crypto.randomUUID()))).status, 400);
  }
  assert.equal(reservations.length, credits);
});

test("new slideshow jobs default to 4:5 and freeze style and attachment roles for every version", async () => {
  const layouts = [referenceImageUrl, "https://owned-media.example.test/layout-2.png"];
  const before = jobs.length;
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my product in this style", referenceImageUrls: layouts, referenceImageAssetIds: [attachmentAsset.id], quantity: 2 }, crypto.randomUUID()));
  assert.equal(response.status, 202);
  for (const queued of jobs.slice(before)) {
    assert.equal(queued.input.aspectRatio, "4:5");
    assert.deepEqual(queued.input.slideshowReferenceContract, { version: 3, styleReferenceIndices: [1, 2], attachmentReferenceIndices: [3] });
  }
});

test("recreation without attachments always has an edit target, with or without selected style references", async () => {
  for (const styles of [[], [referenceImageUrl, "https://owned-media.example.test/layout-2.png"]]) {
    const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Change only the background", ...(styles.length ? { referenceImageUrls: styles } : {}), regenerationImageAssetId: attachmentAsset.id }, crypto.randomUUID()));
    assert.equal(response.status, 202);
    assert.deepEqual(jobs.at(-1).input.referenceImageUrls, [...styles, attachmentAsset.url]);
    assert.deepEqual(jobs.at(-1).input.slideshowReferenceContract, { version: 3, styleReferenceIndices: styles.map((_, i) => i + 1), attachmentReferenceIndices: [], regenerationReferenceIndex: styles.length + 1 });
  }
});

test("reused images keep their distinct roles and attachment numbering without duplicating provider inputs", async () => {
  const otherId = [...extraAssets.keys()][0];
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my second attached image for the background", referenceImageUrls: [referenceImageUrl, attachmentAsset.url], referenceImageAssetIds: [attachmentAsset.id, otherId], regenerationImageAssetId: attachmentAsset.id }, crypto.randomUUID()));
  assert.equal(response.status, 202);
  assert.deepEqual(jobs.at(-1).input.referenceImageUrls, [referenceImageUrl, attachmentAsset.url, extraAssets.get(otherId).url]);
  assert.deepEqual(jobs.at(-1).input.slideshowReferenceContract, { version: 3, styleReferenceIndices: [1, 2], attachmentReferenceIndices: [2, 3], regenerationReferenceIndex: 2 });
});

test("slideshow prompts account for role guidance before billing and never truncate explicit text instructions", async () => {
  const prompt = 'Include the words "New collection" in the middle. ' + "Keep my requested details. ".repeat(500);
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt, referenceImageUrl }, crypto.randomUUID()));
  assert.equal(response.status, 202);
  assert.ok(jobs.at(-1).input.prompt.startsWith(prompt.trim()));
  const credits = reservations.length;
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "x".repeat(32_000), referenceImageUrl }, crypto.randomUUID()))).status, 400);
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use a reference" }, crypto.randomUUID()))).status, 400);
  assert.equal(reservations.length, credits);
});

test("admission measures the actual preservation/business/slide prompt before reserving credits", async () => {
  for (const count of [1, 10]) {
  const body = { exploreFormat: "slideshow", prompt: "x", referenceImageUrls: Array.from({ length: count }, (_, i) => `https://owned-media.example.test/slide-${i}.png`), quantity: 1, slideshowSlideCount: count };
  assert.equal((await handleAIStudioImageGeneration(post(body, crypto.randomUUID()))).status, 202);
  const frozen = jobs.at(-1).input;
  const finalPrompt = prompt => slideshowGenerationPrompt(slideshowSlotPrompt(slideshowBusinessContextPrompt(prompt, frozen.slideshowBusinessContext, true), frozen.slideshowGeneration, true), frozen.aspectRatio, frozen.slideshowReferenceContract);
  const overhead = finalPrompt("").length;
  const accepted = "x".repeat(32_000 - overhead);
  assert.equal(finalPrompt(accepted).length, 32_000);
  assert.equal((await handleAIStudioImageGeneration(post({ ...body, prompt: accepted }, crypto.randomUUID()))).status, 202);
  const credits = reservations.length;
  assert.equal((await handleAIStudioImageGeneration(post({ ...body, prompt: accepted + "x" }, crypto.randomUUID()))).status, 400);
  assert.equal(reservations.length, credits);
  }
});

test("invalid or foreign multiple attachments fail before billing and preserve existing scalar clients", async () => {
  const credits = reservations.length, before = jobs.length;
  for (const referenceImageAssetIds of [null, [], "image", [attachmentAsset.id, attachmentAsset.id], ["not-an-id"], [crypto.randomUUID()], [attachmentAsset.id, crypto.randomUUID()], [...extraAssets.keys(), attachmentAsset.id]]) {
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageAssetIds }, crypto.randomUUID()))).status, 400);
  }
  for (const input of [{ referenceImageAssetId: attachmentAsset.id }, { exploreFormat: undefined }]) {
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageAssetIds: [attachmentAsset.id], ...input }, crypto.randomUUID()))).status, 400);
  }
  const saved = attachmentAsset;
  try {
    for (const asset of [{ ...saved, status: "processing" }, { ...saved, collection: "video" }, { ...saved, mime_type: "image/gif" }, { ...saved, file_size_bytes: 25 * 1024 * 1024 + 1 }, { ...saved, url: "https://owned-media.example.test/foreign.png" }]) {
      attachmentAsset = asset;
      const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageAssetIds: [saved.id] }, crypto.randomUUID()));
      assert.ok([400, 503].includes(response.status));
    }
  } finally { attachmentAsset = saved; }
  assert.equal(reservations.length, credits);
  assert.equal(jobs.length, before);
});

test("oversized combined attachments cannot reserve credits", async () => {
  const entries = [...extraAssets.entries()].slice(0, 3), credits = reservations.length;
  try {
    entries.forEach(([id, asset]) => extraAssets.set(id, { ...asset, file_size_bytes: 20 * 1024 * 1024 }));
    assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", prompt: "Use my images", referenceImageAssetIds: entries.map(([id]) => id) }, crypto.randomUUID()))).status, 400);
  } finally { entries.forEach(([id, asset]) => extraAssets.set(id, asset)); }
  assert.equal(reservations.length, credits);
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
      assert.equal(job.input.provider, model === "seedream_5_pro" ? "openrouter" : undefined);
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
test("Studio replay preserves a legacy Seedream job rather than moving it to OpenRouter", async () => {
  const key = "legacy-seedream-route";
  const request = { model: "seedream_5_pro", prompt: "An adult creator", aspectRatio: "9:16" };
  const first = await handleAIStudioImageGeneration(post(request, key));
  const admitted = savedJobs.get(key);
  delete admitted.input.provider;
  const before = jobs.length;
  const replay = await handleAIStudioImageGeneration(post(request, key));
  assert.deepEqual((await replay.json()).jobs, (await first.json()).jobs);
  assert.equal(jobs.length, before);
  assert.equal(savedJobs.get(key).input.provider, undefined);
});
test("blank prompts stay invalid before billing or job creation", async () => {
 const before=reservations.length;
 assert.equal((await handleAIStudioImageGeneration(post({prompt:" ",model:"nano_banana_2"},crypto.randomUUID()))).status,400);
 assert.equal(reservations.length,before);
});

test("an explicit uploaded-screen request with no attachment fails before billing", async () => {
  const before = reservations.length, queued = jobs.length;
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", referenceImageUrl, prompt: "Place my uploaded screenshot inside the laptop. Keep the rest." }, crypto.randomUUID()));
  assert.equal(response.status, 400); assert.match((await response.json()).message, /none is attached/);
  assert.equal(reservations.length, before); assert.equal(jobs.length, queued);
  assert.equal((await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", referenceImageUrl, referenceImageAssetIds: [attachmentAsset.id], prompt: "Place my uploaded screenshot inside the laptop." }, crypto.randomUUID()))).status, 202);
  assert.deepEqual(jobs.at(-1).input.slideshowReferenceContract.attachmentReferenceIndices, [2]);
});

test("a screenshot placement followed by preserve-only instructions cannot bypass attachment preflight", async () => {
  const prompt = "Use my uploaded screenshot inside the laptop, do not change anything else.";
  const credits = reservations.length, count = jobs.length;
  const response = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", referenceImageUrl, prompt }, crypto.randomUUID()));
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /none is attached/);
  assert.equal(reservations.length, credits);
  assert.equal(jobs.length, count);
  const attached = await handleAIStudioImageGeneration(post({ exploreFormat: "slideshow", referenceImageUrl, referenceImageAssetIds: [attachmentAsset.id], prompt }, crypto.randomUUID()));
  assert.equal(attached.status, 202);
  assert.equal(jobs.at(-1).input.prompt, prompt);
  assert.deepEqual(jobs.at(-1).input.slideshowReferenceContract.attachmentReferenceIndices, [2]);
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
      assert.equal(job.input.model, model ?? "gpt_image_2_5_flare");
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
