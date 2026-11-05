import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import sharp from "sharp";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { slideshowBusinessContextPrompt } from "../../worker/src/lib/slideshow-business-context.ts";
import { planSlideshowFaceSwaps } from "../explore/slideshow-face-swap.ts";

// Real API parser/named resolver -> JSON job -> real worker, downloader, durable
// stages, face adapter and HTTP payload. Only infrastructure/network are fakes.
// No localhost server, build, real upload, provider call or billing occurs.
const local = file => new URL(file, import.meta.url);
const owner = "face-test-owner";
const ids = Array.from({ length: 4 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const rows = new Map(), jobs = new Map(), objects = new Map(), operations = new Map();
const reservations = [], baseCalls = [], identityCalls = [], checkpoints = [], dbReads = [], signedReads = [], imageReads = [], planningInputs = [];
let identityFailure, lostFinalWrite, lostStageAck, invalidPhoto;
const png = async color => sharp({ create: { width: 64, height: 80, channels: 3, background: color } }).png().toBuffer();
const baseImage = await png("#657483"), identityResult = await png("#936475");
const photos = await Promise.all(["#123456", "#345678", "#789abc", "#abcdef"].map(png));
const context = { businessProfileId: "test-profile", businessProfileVersion: 1, businessContext: {
  businessName: "Example", productSummary: "A writing app", category: null, mainProblem: null, mainPromise: null, brandTone: null,
  targetAudience: [], valueProps: [], painPoints: [], differentiators: [], visualKeywords: [], ctaIdeas: [], claimsToAvoid: [],
} };
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
class SlideshowPlanError extends Error {}
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => ({ uid: owner }) } });
mock.module(local("./server-access.ts"), { namedExports: { requireAIStudioProUser: async () => ({ uid: owner }) } });
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: {
  getMissingBackgroundJobStorageEnvVars: () => [],
  getBackgroundJobById: async id => [...jobs.values()].find(job => job.id === id) ?? null,
  getBackgroundJobByIdempotencyKey: async (key, scope) => {
    assert.deepEqual(scope, { userId: owner, jobType: "generate_image" }); return jobs.get(key) ?? null;
  },
} });
mock.module(local("../jobs/background-job-service.ts"), { namedExports: {
  createAndDispatchBackgroundJob: async input => {
    if (!jobs.has(input.idempotencyKey)) jobs.set(input.idempotencyKey, JSON.parse(JSON.stringify({ ...input, id: crypto.randomUUID(), status: "queued" })));
    return jobs.get(input.idempotencyKey);
  },
} });
mock.module(local("../billing/subscription-db.ts"), { namedExports: {
  BillingAccessError, getGenerationCreditCost: () => 1, deliverBillingUsageForJob: async () => {}, releaseBillingCredits: async () => {},
  reserveBillingCredits: async value => {
    const previous = reservations.find(reservation => reservation.idempotencyKey === value.idempotencyKey);
    if (previous) assert.equal(previous.amount, value.amount); else reservations.push(value);
  },
} });
mock.module(local("../media/media-storage.ts"), { namedExports: {
  getMediaAssetForOwner: async ({ assetId, userId }) => { assert.equal(userId, owner); return rows.get(assetId) ?? null; },
} });
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (url, userId) => { assert.equal(userId, owner); return url; },
  isTrustedMediaReferenceUrl: url => url.startsWith("https://owned.example.test/") || url.startsWith("https://storage.googleapis.com/test-private-face/"),
} });
mock.module(local("../explore/recreate-catalog.ts"), { namedExports: {
  getRecreateReference: id => id === "test-deck" ? { format: "slideshow", slides: [1, 2, 3, 4].map(number => ({ id: `slide-${number}`, url: `https://owned.example.test/source-${number}.png` })) } : null,
} });
mock.module(local("../explore/slideshow-business-context.ts"), { namedExports: {
  SlideshowBusinessContextUnavailableError: class extends Error {}, loadSlideshowBusinessContext: async () => context, slideshowBusinessContextPrompt,
} });
mock.module(local("../explore/slideshow-plan-service.ts"), { namedExports: {
  SlideshowPlanError,
  planSlideshowRequest: async (_owner, _key, input) => { planningInputs.push(input); return { version: 1, clarifications: [], unusedUploadIds: [],
    slides: input.targetIds.map(targetId => ({ targetId, baseUploadId: null, instructions: "Keep this source scene and render the requested business copy.", preserve: ["Scene and layout"], attachments: [] })) }; },
} });
mock.module(local("../../worker/src/lib/openai-image.ts"), { namedExports: {
  SLIDESHOW_IMAGE_MODEL: "gpt-image-2.5-sunburst", SLIDESHOW_FLARE_IMAGE_MODEL: "gpt-image-2.5-flare",
  generateOpenAiImageBuffer: async (...args) => { baseCalls.push(args); return { buffer: baseImage, model: args[3], requestId: crypto.randomUUID() }; },
} });
mock.module(local("../../worker/src/lib/storage.ts"), { namedExports: {
  getStoredObject: async key => objects.has(key) ? { key, url: `https://owned.example.test/${key}` } : null,
  downloadStoredObjectBuffer: async key => { assert.ok(objects.has(key), key); return objects.get(key); },
  uploadBufferToStorage: async ({ key, buffer }) => {
    if (key.startsWith("images/generated/") && lostFinalWrite) { lostFinalWrite = false; throw Error("Simulated final write failure"); }
    objects.set(key, Buffer.from(buffer));
    if (key.includes("openrouter-image-identity-v1/") && lostStageAck) { lostStageAck = false; throw Error("Simulated lost stage acknowledgement"); }
    return { key, url: `https://owned.example.test/${key}` };
  },
} });
// This fake implements only the media ownership query used at execution. Return
// reverse DB order to prove the primary/support ordering is reconstructed by ID.
const workerRequire = createRequire(local("../../worker/src/lib/slideshow-face-swap.ts"));
mock.module(pathToFileURL(workerRequire.resolve("@google-cloud/storage").replace(/([\\/])cjs([\\/])/, "$1esm$2")), { namedExports: { Storage: class {
  bucket(bucket) { assert.equal(bucket, "test-private-face"); return { file(key) { return { async getSignedUrl() {
    signedReads.push({ bucket, key }); return [`https://owned.example.test/${key}?X-Goog-Signature=test-only`];
  } }; } }; }
} } });
mock.module(pathToFileURL(workerRequire.resolve("@supabase/supabase-js").replace(/\.cjs$/, ".mjs")), { namedExports: { createClient: () => ({ from(table) {
  assert.equal(table, "media_assets"); const query = {};
  return { select() { return this; }, eq(key, value) { query[key] = value; return this; },
    in(key, value) { query[key] = value; return this; }, is(key, value) { query[key] = value; return this; },
    then(resolve) { dbReads.push(query); resolve({ data: [...rows.values()].filter(row => query.id.includes(row.id)).reverse(), error: null }); },
  };
} }) } });
mock.method(globalThis, "fetch", async (url, init) => {
  if (url === "https://openrouter.ai/api/v1/chat/completions") {
    const payload = JSON.parse(init.body); identityCalls.push(payload);
    if (identityFailure === "uncertain") throw Error("Connection lost after submission");
    if (identityFailure) return new Response("Provider rejection", { status: identityFailure });
    return Response.json({ id: `identity-${identityCalls.length}`, choices: [{ message: { images: [{ url: `data:image/png;base64,${identityResult.toString("base64")}` }] } }] });
  }
  const photoIndex = ids.findIndex(id => new URL(url).origin === "https://owned.example.test" && new URL(url).pathname === `/${id}.png`);
  assert.ok(photoIndex >= 0, `Unexpected network access: ${url}`);
  imageReads.push(url);
  if (invalidPhoto === "empty") return new Response(new Uint8Array(), { headers: { "Content-Type": "image/png" } });
  if (invalidPhoto === "oversize") return new Response(photos[photoIndex], { headers: { "Content-Type": "image/png", "Content-Length": String(26 * 1024 * 1024) } });
  return new Response(photos[photoIndex], { headers: { "Content-Type": "image/png" } });
});
const { handleAIStudioImageGeneration, handleAIStudioImageStatus } = await import("./image-generation-api.ts");
const { handleGenerationRequestRecovery } = await import("./generation-request-api.ts");
const { runGenerateImageJob } = await import("../../worker/src/jobs/generate-image.ts");
const { ProviderSubmissionUncertainError } = await import("../../worker/src/lib/generation-provider.ts");
const opKey = input => `${input.jobId}:${input.operationKey}`;
function updateOperation(input, status) {
  const record = operations.get(opKey(input)); assert.ok(record);
  Object.assign(record, { status, metadata: { ...record.metadata, ...input.metadata },
    ...(input.providerOperationId ? { provider_operation_id: input.providerOperationId } : {}), retryAllowed: input.retryAllowed });
}
const workerContext = { checkpoint: async value => checkpoints.push(value), store: {
  reserveGenerationProviderOperation: async input => {
    const key = opKey(input), previous = operations.get(key);
    if (previous) {
      assert.equal(previous.request_fingerprint, input.requestFingerprint, "Recovery must reuse exact saved stage inputs");
      if (previous.status === "failed" && previous.retryAllowed) { previous.status = "reserved"; return { operation: previous, shouldSubmit: true }; }
      return { operation: previous, shouldSubmit: false };
    }
    const operation = { status: "reserved", metadata: input.metadata ?? {}, request_fingerprint: input.requestFingerprint };
    operations.set(key, operation); return { operation, shouldSubmit: true };
  },
  markGenerationProviderSucceeded: async input => updateOperation(input, "provider_succeeded"),
  markGenerationOutputPersisted: async input => updateOperation(input, "output_persisted"),
  markGenerationProviderFailed: async input => updateOperation(input, "failed"),
  markGenerationProviderSubmissionUncertain: async input => updateOperation(input, "submission_uncertain"),
} };
function request(photos = ids.slice(0, 2), marked = ["slide-4"]) {
  return { exploreFormat: "slideshow", model: "gpt_image_2_5_flare", quantity: 2, slideshowSlideCount: 2,
    prompt: "Adapt this deck to my business and use the selected face on the marked slide.",
    referenceImageUrls: [1, 4].map(number => `https://owned.example.test/source-${number}.png`),
    slideshowContext: { version: 1, sources: [1, 4].map(number => ({ referenceId: "test-deck", slideId: `slide-${number}`, slideNumber: number })), uploads: [] },
    ...(photos.length ? { slideshowFaceSelection: { influencer: { id: photos[0], referencePhotos: photos.slice(1).map(id => ({ id })) }, slideIds: marked } } : {}),
  };
}
async function admit(body = request(), key = crypto.randomUUID()) {
  const response = await handleAIStudioImageGeneration(new Request("https://local.test/api", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) }));
  return { response, value: await response.json(), key };
}
async function run(job) {
  // Round-trip storage before consumption: no UI/localStorage is involved.
  const frozen = JSON.parse(JSON.stringify(job));
  const output = await runGenerateImageJob({ id: frozen.id, user_id: frozen.userId, project_id: frozen.projectId, input_json: frozen.input }, workerContext);
  job.status = "completed"; job.output = output; return output;
}
beforeEach(() => {
  rows.clear(); jobs.clear(); objects.clear(); operations.clear();
  for (const list of [reservations, baseCalls, identityCalls, checkpoints, dbReads, signedReads, imageReads, planningInputs]) list.length = 0;
  identityFailure = lostFinalWrite = lostStageAck = invalidPhoto = undefined;
  process.env.SUPABASE_URL = "https://database.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
  process.env.OPENROUTER_API_KEY = "test-only-not-a-secret";
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "test-private-face";
  process.env.GCP_STORAGE_BUCKET = "test-public-output";
  // Fail closed if a future SDK export change bypasses the signer fake.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = fileURLToPath(local("../../.tmp/nonexistent-face-test-credentials.json"));
  for (const [index, id] of ids.entries()) rows.set(id, { id, user_id: owner, status: "ready", deleted_at: null,
    collection: index === 0 ? "influencer" : "image", mime_type: "image/png", file_size_bytes: photos[index].length,
    metadata: {}, storage_key: `${id}.png`, url: `https://owned.example.test/${id}.png` });
});

test("exact photos reach the real identity HTTP payload only for original marked Slide 4 / Version 1, and the final result is correlated", async () => {
  const { response, value, key } = await admit(); assert.equal(response.status, 202, JSON.stringify(value));
  assert.deepEqual(reservations.map(value => value.amount), [1, 2, 1, 1], "One extra credit only for the marked first version");
  assert.deepEqual(value.jobs.map(job => !!job.slideshowFaceSwapManaged), [false, true, false, false]);
  assert.deepEqual(planSlideshowFaceSwaps({ jobs: value.jobs, sources: [{ slideId: "slide-1" }, { slideId: "slide-4" }], slideIds: ["slide-4"], influencerAssetId: ids[0] }), [], "No duplicate paid browser swap");
  const outputs = [];
  for (const job of jobs.values()) outputs.push(await run(job));
  assert.equal(baseCalls.length, 4); assert.equal(identityCalls.length, 1);
  for (const call of baseCalls) {
    assert.equal(call[3], "gpt-image-2.5-flare", "Selected base model remains unchanged");
    assert.ok(call[2].every(url => url.includes("source-")), "Identity photos must not leak into the base generator");
  }
  const content = identityCalls[0].messages[0].content;
  assert.deepEqual(content.filter(part => part.image_url).map(part => Buffer.from(part.image_url.url.split(",")[1], "base64")), [baseImage, photos[0], photos[1]]);
  assert.doesNotMatch(content[0].text, /only identity photo/);
  assert.match(content[0].text, /Preserve the finished slide's exact words/);
  assert.equal(outputs[1].slideshowFaceSwap.targetId, "source:test-deck:slide-4");
  assert.deepEqual(outputs[1].slideshowFaceSwap.identityAssetIds, ids.slice(0, 2));
  assert.deepEqual(outputs.map(output => !!output.slideshowFaceSwap), [false, true, false, false]);
  const changed = [...jobs.values()][1];
  assert.deepEqual((await sharp(objects.get(outputs[1].key)).metadata()).width, 1024);
  const status = await handleAIStudioImageStatus(new Request(`https://local.test/api?jobId=${changed.id}`));
  const statusBody = await status.json();
  assert.equal(statusBody.job.output.url, outputs[1].url); assert.equal(statusBody.job.output.slideshowGeneration.slideIndex, 2);
  const recovery = await handleGenerationRequestRecovery(new Request(`https://local.test/api?requestKey=${key}&kind=image&scope=slideshow&quantity=2&slideshowSlideCount=2`));
  assert.deepEqual((await recovery.json()).jobs.map(job => !!job.slideshowFaceSwapManaged), [false, true, false, false]);
  assert.equal(dbReads.length, 1); assert.equal(dbReads[0].user_id, owner);
});

test("A to B, primary/support reordering, four photos and clear reach the correct stages", async () => {
  for (const selected of [ids.slice(0, 2), [ids[2], ids[1], ids[0], ids[3]], []]) {
    const before = identityCalls.length;
    const result = await admit(request(selected)); assert.equal(result.response.status, 202, JSON.stringify(result.value));
    for (const job of [...jobs.values()].slice(-4)) await run(job);
    assert.equal(identityCalls.length - before, selected.length ? 1 : 0);
    if (selected.length) assert.deepEqual(identityCalls.at(-1).messages[0].content.filter(part => part.image_url).slice(1).map(part => Buffer.from(part.image_url.url.split(",")[1], "base64")), selected.map(id => photos[ids.indexOf(id)]));
  }
});

test("private uploaded face photos are signed at execution and their exact bytes reach the adapter without freezing bearer URLs", async () => {
  for (const id of ids.slice(0, 2)) Object.assign(rows.get(id), { metadata: { storageLocation: "private_user_media" }, url: `https://storage.googleapis.com/test-private-face/${id}.png` });
  const { response } = await admit(); assert.equal(response.status, 202);
  const job = [...jobs.values()][1];
  assert.doesNotMatch(JSON.stringify(job.input), /X-Goog-Signature/);
  await run(job);
  assert.deepEqual(signedReads.map(read => read.key), ids.slice(0, 2).map(id => `${id}.png`));
  assert.deepEqual(identityCalls[0].messages[0].content.filter(part => part.image_url).slice(1).map(part => Buffer.from(part.image_url.url.split(",")[1], "base64")), photos.slice(0, 2));
});

test("multiple face marks keep source order and a repeated admission does not create new jobs or charge again", async () => {
  const body = request(ids.slice(0, 2), ["slide-4", "slide-1"]);
  const { key, value } = await admit(body);
  assert.equal((await admit(body, key)).response.status, 202);
  assert.equal(jobs.size, 4); assert.deepEqual(reservations.map(value => value.amount), [2, 2, 1, 1]);
  assert.deepEqual([...jobs.values()].map(job => job.input.slideshowFaceSwap?.targetId ?? null), ["source:test-deck:slide-1", "source:test-deck:slide-4", null, null]);
  for (const job of jobs.values()) await run(job);
  assert.equal(identityCalls.length, 2);
  assert.deepEqual(value.jobs.map(job => !!job.slideshowFaceSwapManaged), [true, true, false, false]);
});

test("historical saved influencer photos with unknown size are byte-checked before planning/credit and reach the worker", async () => {
  for (const id of ids.slice(0, 2)) rows.get(id).file_size_bytes = null;
  const { response } = await admit(); assert.equal(response.status, 202);
  assert.equal(imageReads.length, 2, "Actual byte limits checked during admission, not deferred until after billing");
  assert.equal(planningInputs.length, 1);
  await run([...jobs.values()][1]);
  assert.equal(imageReads.length, 4);
  assert.deepEqual(identityCalls[0].messages[0].content.filter(part => part.image_url).slice(1).map(part => Buffer.from(part.image_url.url.split(",")[1], "base64")), photos.slice(0, 2));
});

test("unknown-size empty or oversize saved photos cannot reach planning or billing", async () => {
  rows.get(ids[0]).file_size_bytes = null;
  for (const failure of ["empty", "oversize"]) {
    invalidPhoto = failure;
    const { response, value } = await admit(); assert.equal(response.status, 400, JSON.stringify(value));
    assert.match(value.message, /size limits/);
  }
  assert.equal(planningInputs.length, 0); assert.equal(reservations.length, 0); assert.equal(jobs.size, 0);
  assert.equal(identityCalls.length, 0);
});

test("foreign/deleted/unready/changed public photos fail at execution before the identity provider, rather than reporting base-only success", async () => {
  for (const change of [{ user_id: "foreign" }, { deleted_at: "2026-11-05" }, { status: "pending" }, { collection: "video" }, { url: "https://owned.example.test/replaced.png" }]) {
    const { response } = await admit(); assert.equal(response.status, 202);
    const job = [...jobs.values()].at(-3), saved = { ...rows.get(ids[0]) };
    Object.assign(rows.get(ids[0]), change);
    await assert.rejects(run(job), /face photo/i);
    assert.equal(job.status, "queued"); rows.set(ids[0], saved);
  }
  assert.equal(identityCalls.length, 0);
});

test("saved base/identity/harmonization stages survive a worker restart and lost final write without duplicate calls", async () => {
  await admit(); const job = [...jobs.values()][1]; lostFinalWrite = true;
  await assert.rejects(run(job), /final write failure/);
  assert.equal(identityCalls.length, 1); assert.equal(baseCalls.length, 1); assert.equal(job.status, "queued");
  const output = await run(job); assert.equal(output.ok, true);
  await run(job); assert.equal(identityCalls.length, 1); assert.equal(baseCalls.length, 1);
});

test("a lost identity-stage save acknowledgement is recovered from its deterministic PNG without resubmitting either paid stage", async () => {
  await admit(); const job = [...jobs.values()][1]; lostStageAck = true;
  await assert.rejects(run(job), /save is unconfirmed/);
  assert.equal(identityCalls.length, 1); await run(job);
  assert.equal(identityCalls.length, 1); assert.equal(baseCalls.length, 1);
});

test("uncertain identity submission never becomes a completed slide or automatic repeated paid call", async () => {
  await admit(); const job = [...jobs.values()][1]; identityFailure = "uncertain";
  await assert.rejects(run(job), ProviderSubmissionUncertainError);
  identityFailure = undefined;
  await assert.rejects(run(job), ProviderSubmissionUncertainError);
  assert.equal(identityCalls.length, 1); assert.equal(baseCalls.length, 1); assert.equal(job.status, "queued");
});

test("known rejected identity requests reuse the base stage on safe retry", async () => {
  await admit(); const job = [...jobs.values()][1]; identityFailure = 429;
  await assert.rejects(run(job), /temporarily rejected/);
  identityFailure = undefined; await run(job);
  assert.equal(identityCalls.length, 2); assert.equal(baseCalls.length, 1);
});

test("wrong target/version, role duplicates and face selection without the authoritative source context cannot reach a provider", async () => {
  await admit(); const job = [...jobs.values()][1];
  for (const mutate of [
    input => input.slideshowFaceSwap.targetId = "source:test-deck:slide-1",
    input => input.slideshowGeneration.versionIndex = 2,
    input => input.slideshowFaceSwap.identityAssetIds[1] = input.slideshowFaceSwap.identityAssetIds[0],
  ]) {
    const altered = structuredClone(job); mutate(altered.input); await assert.rejects(run(altered));
  }
  const invalid = request(); delete invalid.slideshowContext;
  assert.equal((await admit(invalid)).response.status, 400);
  assert.equal(identityCalls.length, 0); assert.equal(baseCalls.length, 0);
});
