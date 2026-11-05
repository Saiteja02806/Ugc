import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hookKeyframeGenerationInputKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { createWorkflowGenerationClient } from "../explore/workflow-generation-client.ts";

// Actual workflow client/start wrapper/common API -> JSON job -> actual worker
// -> real ReAPI adapter/HTTP body -> output. Network/DB/queue/billing are fakes.
const local = file => new URL(file, import.meta.url), owner = "wiring-owner";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const images = [1, 2, 3].map(n => ({ assetId: id(n), url: `https://owned.example.test/photo-${n}.png` }));
const frame = { assetId: id(4), jobId: id(5), referenceId: "talking-test", url: "https://owned.example.test/frame.png", ownerId: owner,
  width: 720, height: 1280, generateAudio: true, draftId: id(6) };
const receipt = { version: 1, purpose: "hook_starting_frame", ownerId: owner, draftId: id(6), referenceId: frame.referenceId,
  sourceSha256: "a".repeat(64), sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) },
  personImageAssetIds: [id(1)], instructions: "Keep this scene.", promptVersion: 1, promptSha256: "c".repeat(64) };
receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
const rows = new Map(), jobs = [], charges = [], posts = [], readPhotos = [], ownershipQueries = [], signed = [];
const operations = new Map(); let providerFailure, invalidPhoto;
const mp4 = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("./server-access.ts"), { namedExports: { requireAIStudioProUser: async () => ({ uid: owner }) } });
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: {
  getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async jobId => jobs.find(job => job.id === jobId) ?? null,
} });
function save(input) {
  const prior = jobs.find(job => job.idempotencyKey === input.idempotencyKey);
  if (prior) return prior;
  const job = JSON.parse(JSON.stringify({ ...input, id: crypto.randomUUID(), status: "queued" })); jobs.push(job); return job;
}
mock.module(local("../jobs/background-job-service.ts"), { namedExports: {
  createAndDispatchBackgroundJob: async input => save(input), dispatchQueuedBackgroundJobForRecovery: async job => job,
} });
mock.module(local("../explore/workflow-generation-receipts.ts"), { namedExports: {
  WorkflowGenerationReceiptError: class extends Error {},
  createWorkflowGenerationBatch: async batch => { charges.push(batch.amountPerVideo); return batch.inputs.map((input, index) => save({
    input, userId: batch.userId, projectId: "ai-studio", jobType: "generate_hook_video", idempotencyKey: `${batch.requestKey}:${index + 1}`,
  })); },
} });
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (url, user) => { assert.equal(user, owner); return url; },
  isTrustedMediaReferenceUrl: url => String(url).startsWith("https://owned.example.test/") || String(url).startsWith("https://storage.googleapis.com/video-test-private/"),
} });
mock.module(local("../media/media-storage.ts"), { namedExports: {
  getMediaAssetForOwner: async ({ assetId, userId }) => { assert.equal(userId, owner); return rows.get(assetId) ?? null; },
  getMediaAssetsForOwnerByUrls: async ({ urls, userId }) => { assert.equal(userId, owner); return [...rows.values()].filter(row => urls.includes(row.url)).reverse(); },
} });
mock.module(local("../explore/hook-keyframe-result.ts"), { namedExports: {
  resolveApprovedHookStartingFrame: async args => { assert.equal(args.ownerId, owner); assert.equal(args.assetId, frame.assetId); assert.equal(args.imageJobId, frame.jobId);
    return { assetId: frame.assetId, imageJobId: frame.jobId, imageUrl: frame.url, referenceId: frame.referenceId, workflow: "talking_head", exploreFormat: "hook",
      sourceSha256: receipt.sourceSha256, startingFrameIndex: 0, receipt, output: { width: 720, height: 1280, ratio: "9:16" } }; },
} });
mock.module(local("../billing/subscription-db.ts"), { namedExports: {
  BillingAccessError, getGenerationCreditCost: (_kind, seconds) => seconds * 2, deliverBillingUsageForJob: async () => {}, releaseBillingCredits: async () => {},
  reserveBillingCredits: async value => charges.push(value.amount),
} });
mock.module(local("../../worker/src/lib/storage.ts"), { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async input => { assert.deepEqual(input.buffer, mp4); return { key: input.key, url: `https://owned.example.test/${input.key}` }; },
} });
// Minimal synthetic MP4 tests transport, not codec/audio quality. Real FFmpeg
// composition/sound tests remain separate and are not replaced by this fake.
mock.module(local("../../worker/src/lib/explore-generated-reference-audio.ts"), { namedExports: {
  silenceGeneratedVideo: async bytes => bytes, applyGeneratedReferenceAudio: async bytes => bytes,
} });
mock.module(local("../../worker/src/lib/silent-video.ts"), { namedExports: { silenceGeneratedVideo: async bytes => bytes } });
const workerRequire = createRequire(local("../../worker/src/lib/owned-video-images.ts"));
mock.module(pathToFileURL(workerRequire.resolve("@supabase/supabase-js").replace(/\.cjs$/, ".mjs")), { namedExports: {
  createClient: () => ({ from(table) {
    assert.equal(table, "media_assets"); const query = {};
    return { select() { return this; }, eq(key, value) { query[key] = value; return this; }, in(key, value) { query[key] = value; return this; }, is(key, value) { query[key] = value; return this; },
      then(resolve) { ownershipQueries.push(query); resolve({ data: [...rows.values()].filter(row => query.id.includes(row.id)).reverse(), error: null }); } };
  } }),
} });
mock.module(pathToFileURL(workerRequire.resolve("@google-cloud/storage").replace(/([\\/])cjs([\\/])/, "$1esm$2")), { namedExports: {
  Storage: class { bucket(bucket) { assert.equal(bucket, "video-test-private"); return { file(key) { return { getSignedUrl: async () => {
    signed.push(key); return [`https://owned.example.test/${key}?X-Goog-Signature=synthetic`];
  } }; } }; } },
} });
mock.method(globalThis, "fetch", async (url, init) => {
  const value = String(url);
  if (value === "https://reapi.ai/api/v1/videos/generations") {
    posts.push(JSON.parse(init.body));
    if (providerFailure === "uncertain") throw Error("Lost provider acceptance");
    if (providerFailure) return new Response("Rejected", { status: providerFailure });
    return Response.json({ id: `task-${posts.length}`, status: "processing" }, { status: 202 });
  }
  if (value.startsWith("https://reapi.ai/api/v1/tasks/")) return Response.json({ status: "completed", output: { video_urls: ["https://cdn.reapi.ai/synthetic.mp4"] } });
  if (value === "https://cdn.reapi.ai/synthetic.mp4") { assert.equal(new Headers(init?.headers).has("Authorization"), false); return new Response(mp4); }
  if (value.startsWith("https://owned.example.test/")) {
    readPhotos.push(value);
    if (invalidPhoto) return new Response(new Uint8Array(), { headers: { "Content-Type": "image/png" } });
    return new Response(Buffer.from("synthetic-size-check"), { headers: { "Content-Type": "image/png" } });
  }
  assert.fail(`Unexpected network: ${value}`);
});
const { handleAIStudioVideoGeneration, handleAIStudioVideoStatus } = await import("./video-generation-api.ts");
const { handleWorkflowGenerationStart } = await import("../explore/workflow-generation-start-api.ts");
const { runGenerateHookVideoJob } = await import("../../worker/src/jobs/generate-hook-video.ts");
const { ProviderSubmissionUncertainError } = await import("../../worker/src/lib/generation-provider.ts");
const operationKey = value => `${value.jobId}:${value.operationKey}`;
const context = { checkpoint: async () => {}, store: {
  getGenerationProviderOperation: async value => operations.get(operationKey(value)) ?? null,
  reserveGenerationProviderOperation: async value => {
    const key = operationKey(value), previous = operations.get(key);
    if (previous) { assert.equal(previous.request_fingerprint, value.requestFingerprint); return { operation: previous, shouldSubmit: false }; }
    const operation = { status: "reserved", provider: value.provider, request_fingerprint: value.requestFingerprint, metadata: value.metadata ?? {} };
    operations.set(key, operation); return { operation, shouldSubmit: true };
  },
  markGenerationProviderSubmitted: async value => Object.assign(operations.get(operationKey(value)), { status: "submitted", provider_operation_id: value.providerOperationId }),
  markGenerationProviderSucceeded: async value => Object.assign(operations.get(operationKey(value)), { status: "provider_succeeded", output_url: value.outputUrl, metadata: value.metadata }),
  markGenerationOutputPersisted: async value => Object.assign(operations.get(operationKey(value)), { status: "output_persisted", output_url: value.outputUrl, metadata: value.metadata }),
  markGenerationProviderFailed: async value => Object.assign(operations.get(operationKey(value)), { status: "failed", retry_allowed: value.retryAllowed }),
  markGenerationProviderSubmissionUncertain: async value => Object.assign(operations.get(operationKey(value)), { status: "submission_uncertain" }),
} };
async function admit(body, atomic = false) {
  const key = crypto.randomUUID();
  const request = new Request("https://local.test/api", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ prompt: "Keep the selected reference order.", durationSeconds: 4, resolution: "720p", aspectRatio: "9:16", quantity: 1, ...body, idempotencyKey: key, ...(atomic ? { workflowKind: "hook" } : {}) }) });
  const response = await (atomic ? handleWorkflowGenerationStart(request) : handleAIStudioVideoGeneration(request));
  return { response, value: await response.json() };
}
async function run(job) {
  const frozen = JSON.parse(JSON.stringify(job));
  const output = await runGenerateHookVideoJob({ id: frozen.id, user_id: owner, input_json: frozen.input }, context);
  job.status = "completed"; job.output = output; return output;
}
beforeEach(() => {
  rows.clear(); jobs.length = charges.length = posts.length = readPhotos.length = ownershipQueries.length = signed.length = 0; operations.clear(); providerFailure = invalidPhoto = undefined;
  Object.assign(process.env, { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: "true", NEXT_PUBLIC_ENABLE_OPENROUTER_WAN: "true", ENABLE_HOOK_STARTING_FRAME_PREPARATION: "true", EXPLORE_GENERATION_ENABLED: "true", REAPI_API_KEY: "test-only", SUPABASE_URL: "https://database.example.test", SUPABASE_SERVICE_ROLE_KEY: "test-only", GCP_PRIVATE_MEDIA_BUCKET: "video-test-private", GCP_STORAGE_BUCKET: "video-test-output", GOOGLE_APPLICATION_CREDENTIALS: fileURLToPath(local("../../.tmp/nonexistent-video-test-credentials.json")) });
  for (const image of [...images, frame]) rows.set(image.assetId, { id: image.assetId, user_id: owner, url: image.url, collection: "image", status: "ready", deleted_at: null, mime_type: "image/png", file_size_bytes: 500, metadata: {}, storage_key: `${image.assetId}.png` });
  rows.set(id(9), { id: id(9), user_id: owner, url: "https://owned.example.test/voice.mp3", collection: "audio", status: "ready", deleted_at: null, mime_type: "audio/mpeg", file_size_bytes: 500, duration_seconds: 5 });
});

test("all five selected video models retain exact ordered owned images through API, job, worker and real ReAPI HTTP payload", async () => {
  for (const model of ["seedance_2_5", "wan_3_0", "google_omni", "kling_3_0", "kling_4_0"]) {
    const selected = images.slice(0, model.startsWith("kling") ? 2 : 3).reverse();
    const { response, value } = await admit({ model, referenceImageUrls: selected.map(image => image.url) });
    assert.equal(response.status, 202, JSON.stringify(value)); const job = jobs.at(-1);
    assert.deepEqual(job.input.ownedImageReferences.images, selected);
    const output = await run(job);
    assert.deepEqual(posts.at(-1).image_urls, selected.map(image => image.url));
    assert.equal(posts.at(-1).model, { seedance_2_5: "doubao-seedance-2.5-face", wan_3_0: "wan3.0-video", google_omni: "gemini-omni-1-1", kling_3_0: "kling-3-0", kling_4_0: "kling-4-0" }[model]);
    assert.equal(job.input.model, model); assert.equal(output.provider, "reapi"); assert.equal(job.input.provider, "reapi");
    const status = await handleAIStudioVideoStatus(new Request(`https://local.test/status?jobId=${job.id}`));
    assert.equal((await status.json()).job.output.url, output.url, "The displayed result points to this selected job's final output");
    await run(job); assert.equal(posts.length, jobs.length, "Accepted tasks recover without another POST");
  }
  assert.equal(ownershipQueries.length, 5);
});

test("Talking Head client/atomic API forwards reviewed spoken words once and pins the literal starting-frame role", async () => {
  const script = "Here is my exact opening line.";
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const client = createWorkflowGenerationClient({ getOwnerToken: async () => "synthetic-token", createIdempotencyKey: () => id(20), assertActive() {}, uploadImage: async () => assert.fail("Literal frame cannot be re-uploaded as generic input"),
    fetch: async (_url, init) => handleWorkflowGenerationStart(new Request("https://local.test/workflow-start", init)),
    recovery: { ownerId: owner, kind: "hook", storage: () => storage, onChange() {}, withLock: work => work() },
  });
  const result = await client.generate({ kind: "hook", workflow: "talking_head", instructions: script, talkingHeadScript: script, talkingHeadScriptReviewed: true,
    referenceInstructions: "Stable camera and subtle gestures.", settings: { model: "seedance_2_5", duration: 4, resolution: "720p", quantity: 1, aspectRatio: "9:16" }, creator: null, videoReference: null, audioReference: null, startingFrame: frame, startingFramePhotos: [] });
  assert.equal(result.jobs[0].jobId, jobs[0].id); const output = await run(jobs[0]);
  assert.deepEqual(posts[0].image_with_roles, [{ url: frame.url, role: "first_frame" }]);
  assert.equal(posts[0].image_urls, undefined); assert.equal(posts[0].generate_audio, true);
  assert.equal(posts[0].prompt.split(script).length - 1, 1, "Complete displayed script appears once");
  assert.deepEqual(jobs[0].input.ownedImageReferences.images, [{ assetId: frame.assetId, url: frame.url }]);
  assert.equal(output.url, jobs[0].output.url); assert.equal(charges.length, 1);
});

test("Seedance keeps all 30 selected images through ownership lookup and provider submission", async () => {
  const selected = Array.from({ length: 30 }, (_, index) => ({ assetId: id(100 + index), url: `https://owned.example.test/batch-${index}.png` }));
  for (const image of selected) rows.set(image.assetId, { ...rows.get(id(1)), id: image.assetId, url: image.url });
  const { response, value } = await admit({ model: "seedance_2_5", referenceImageUrls: selected.map(image => image.url) });
  assert.equal(response.status, 202, JSON.stringify(value));
  await run(jobs[0]);
  assert.deepEqual(posts[0].image_urls, selected.map(image => image.url));
});

test("Talking Head approved image plus voice accepts an owned legacy image with unknown size, then sends all reference roles", async () => {
  rows.get(frame.assetId).file_size_bytes = null; rows.get(images[0].assetId).file_size_bytes = null; rows.get(images[0].assetId).collection = "influencer";
  for (const model of ["seedance_2_5", "wan_3_0"]) {
    const result = await admit({ model, exploreFormat: "hook", workflow: "talking_head", referenceId: frame.referenceId,
      startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, startingFrameMode: "image_voice_reference", generateAudio: true,
      referenceImageUrls: [images[0].url], imageReferencePurpose: "person", referenceAudioUrls: ["https://owned.example.test/voice.mp3"], referenceAudioAssetIds: [id(9)], talkingHeadScript: "Say these exact words.", talkingHeadScriptReviewed: true }, true);
    assert.equal(result.response.status, 202, JSON.stringify(result.value));
    const job = jobs.at(-1); await run(job);
    assert.deepEqual(posts.at(-1).image_urls, [frame.url, images[0].url]); assert.deepEqual(posts.at(-1).audio_urls, ["https://owned.example.test/voice.mp3"]);
    assert.equal(posts.at(-1).image_with_roles, undefined, "Voice mode is explicitly general scene/appearance guidance");
  }
  assert.equal(readPhotos.length, 4, "Both unknown-size images checked before each admission");
});

test("public photos deleted, changed or reassigned after admission cannot reach any paid provider request", async () => {
  for (const changes of [{ deleted_at: "2026-11-05" }, { user_id: "foreign" }, { status: "processing" }, { url: "https://owned.example.test/replaced.png" }]) {
    const row = rows.get(id(1)), previous = { ...row };
    assert.equal((await admit({ model: "seedance_2_5", referenceImageUrls: [row.url] })).response.status, 202);
    Object.assign(row, changes); await assert.rejects(run(jobs.at(-1)), /selected image/i); Object.assign(row, previous);
  }
  assert.equal(posts.length, 0);
});

test("private photos are signed only at execution; canonical identities stay frozen and ordered", async () => {
  const row = rows.get(id(1)); row.url = `https://storage.googleapis.com/video-test-private/${row.storage_key}`; row.metadata = { storageLocation: "private_user_media" };
  const { response } = await admit({ model: "wan_3_0", referenceImageUrls: [row.url, images[1].url] }); assert.equal(response.status, 202);
  assert.doesNotMatch(JSON.stringify(jobs[0].input), /X-Goog-Signature/);
  await run(jobs[0]); assert.deepEqual(signed, [row.storage_key]);
  assert.match(posts[0].image_urls[0], /X-Goog-Signature=synthetic/); assert.equal(posts[0].image_urls[1], images[1].url);
});

test("clear, unknown-size invalid content and mismatched frozen order fail honestly without fallback", async () => {
  let result = await admit({ model: "seedance_2_5" }); assert.equal(result.response.status, 202); await run(jobs[0]);
  assert.equal(posts[0].image_urls, undefined); assert.equal(jobs[0].input.ownedImageReferences, undefined);
  const count = charges.length; rows.get(id(1)).file_size_bytes = null; invalidPhoto = true;
  result = await admit({ model: "seedance_2_5", referenceImageUrls: [images[0].url] }); assert.equal(result.response.status, 400); assert.equal(charges.length, count);
  invalidPhoto = false; rows.get(id(1)).file_size_bytes = 500;
  await admit({ model: "seedance_2_5", referenceImageUrls: images.slice(0, 2).map(image => image.url) });
  const altered = structuredClone(jobs.at(-1)); altered.input.ownedImageReferences.images.reverse(); await assert.rejects(run(altered), /owned image selection/);
});

test("uncertain submission and saved-task recovery preserve the request without another paid POST", async () => {
  await admit({ model: "seedance_2_5", referenceImageUrls: [images[0].url] }); providerFailure = "uncertain";
  await assert.rejects(run(jobs[0]), ProviderSubmissionUncertainError); providerFailure = undefined;
  await assert.rejects(run(jobs[0]), ProviderSubmissionUncertainError); assert.equal(posts.length, 1);
});
