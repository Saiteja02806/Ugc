import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import curatedFrames from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
import { hookKeyframeGenerationInputKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { readCreatorPrivateJson, readCreatorPrivateFile } from "./creator-private-files.ts";
const privateCreatorCatalog = readCreatorPrivateJson("creator-accounts.json", {version:1,accounts:[]});

const local = file => new URL(file, import.meta.url);
const OWNER = "hook-owner", MAIN = "11111111-1111-4111-8111-111111111111", SUPPORT = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
const calls = [], saved = new Map(), assets = new Map();
let authError, missing, source, openingSource, storageError, queueError, snapshotUrl, concurrentGate, collision, objectOverrides;
let actorEmail = "vtu19403@veltech.edu.in";
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
class BillingAccessError extends Error { constructor(message, status = 402) { super(message); this.status = status; } }
class HookSourceFrameError extends Error { constructor(message, status = 409) { super(message); this.status = status; } }
mock.method(globalThis, "fetch", async () => assert.fail("No network or paid provider requests are allowed"));
mock.module(local("../ai-studio/server-access.ts"), { namedExports: { requireAIStudioProUser: async () => { calls.push("auth"); if (authError) throw authError; return { uid: OWNER, email: actorEmail, emailVerified: true }; } } });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("../billing/subscription-db.ts"), { namedExports: {
  BillingAccessError, getGenerationCreditCost: () => 5,
  reserveBillingCredits: async input => { calls.push({ reserve: input }); },
  releaseBillingCredits: async () => assert.fail("Recovery must never release a saved reservation"),
} });
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => missing ? ["queue"] : [] } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: {
  getMissingBackgroundJobStorageEnvVars: () => [],
  getBackgroundJobByIdempotencyKey: async (key, filter) => { calls.push({ lookup: key, filter }); return saved.get(key) ?? null; },
  getBackgroundJobForUser: async ({ jobId, userId }) => { calls.push({ jobRead: jobId, userId }); return [...saved.values()].find(job => job.id === jobId && job.userId === userId) ?? null; },
} });
mock.module(local("../jobs/background-job-service.ts"), { namedExports: { createAndDispatchBackgroundJob: async (input, options) => {
  calls.push({ create: input });
  const stored = collision ?? saved.get(input.idempotencyKey) ?? { ...input, id: crypto.randomUUID(), status: "queued", errorMessage: null, output: null };
  saved.set(input.idempotencyKey, stored);
  await options?.beforeDispatch(stored);
  if (queueError) throw queueError;
  calls.push({ dispatch: stored.id }); return stored;
} } });
mock.module(local("../media/media-storage.ts"), { namedExports: { getMediaAssetForOwner: async ({ assetId, userId }) => { calls.push({ photoRead: assetId, userId }); return assets.get(assetId) ?? null; } } });
mock.module(local("../media/media-delivery.ts"), { namedExports: { isPrivateUserMedia: value => value.metadata?.storageLocation === "private_user_media" } });
function head(key, privateObject = false) {
  calls.push({ head: key, privateObject }); const asset = [...assets.values()].find(value => value.storage_key === key);
  return { ContentLength: asset.file_size_bytes ?? 1024, ContentType: asset.mime_type, ...objectOverrides };
}
mock.module(local("../media/private-media-storage.ts"), { namedExports: { privateMediaHead: async key => head(key, true) } });
mock.module(local("../media/media-reference.ts"), { namedExports: {
  canonicalMediaReference: async (url, owner) => { calls.push({ canonical: url, owner }); return url; },
  isTrustedMediaReferenceUrl: url => { try { return new URL(url).origin === "https://owned-media.example.test"; } catch { return false; } },
} });
mock.module(local("../storage/storage.ts"), { namedExports: {
  getMissingStorageEnvVars: () => [], headStorageObject: async ({ key }) => head(key), uploadBufferToStorage: async input => {
    calls.push({ snapshot: input });
    if (concurrentGate) await concurrentGate;
    if (storageError) throw storageError;
    return { key: input.key, url: snapshotUrl ?? `https://owned-media.example.test/${input.key}` };
  },
} });
mock.module(local("./hook-source-frame.ts"), { namedExports: {
  HookSourceFrameError, getHookSourceFrame: async referenceId => { calls.push({ frameRead: referenceId }); return source; },
  getHookOpeningSourceFrame: async referenceId => { calls.push({ openingFrameRead: referenceId }); return openingSource; },
} });
mock.module(local("../../worker/src/lib/explore-hook-reference-release.ts"), { namedExports: { getHookReferenceReleaseItems: () => [] } });
const { handleHookKeyframeGeneration, handleHookKeyframeStatus } = await import("./hook-keyframe-generation-api.ts");
function body(changes = {}) { return { referenceId: "hook-15", sourceSha256: "a".repeat(64), draftId: crypto.randomUUID(), personImageAssetIds: [MAIN, SUPPORT], instructions: "Preserve the pose.", idempotencyKey: crypto.randomUUID(), imageModel: "nano_banana_2", ...changes }; }
function post(input) { return new Request("https://www.getugcpilot.com/api/explore/hook-keyframe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
function get(query) { return new Request(`https://www.getugcpilot.com/api/explore/hook-keyframe?${query}`); }
const count = key => calls.filter(call => typeof call === "object" && key in call).length;
function asset(id) { return { id, user_id: OWNER, deleted_at: null, collection: "image", status: "ready", mime_type: "image/png", file_size_bytes: 1024, storage_key: `images/${id}.png`, url: `https://owned-media.example.test/${id}.png` }; }
beforeEach(() => {
  actorEmail = "vtu19403@veltech.edu.in";
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  calls.length = 0; saved.clear(); assets.clear();
  for (const id of [MAIN, SUPPORT, THIRD]) assets.set(id, asset(id));
  authError = missing = storageError = queueError = snapshotUrl = concurrentGate = collision = objectOverrides = undefined;
  source = { frameIndex: 0, frameTimeSeconds: 0, sourceSha256: "a".repeat(64), frameSha256: "b".repeat(64), width: 720, height: 1280, png: Buffer.from("mock source pixels") };
  openingSource = source;
});

test("gate and entitlement checks reject before source, storage or credits", async () => {
  delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 404); assert.equal(calls.length, 0);
  assert.equal((await handleHookKeyframeStatus(get("cost=1"))).status, 404); assert.equal(calls.length, 0);
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  for (const status of [401, 403]) { authError = new FirebaseAuthRequestError("Denied", status); assert.equal((await handleHookKeyframeGeneration(post(body()))).status, status); }
  assert.equal(count("reserve"), 0); assert.equal(count("frameRead"), 0);
});

test("private creator requests freeze a canonical scene, never publish a public snapshot, and recover without rebilling", async () => {
  process.env.CREATOR_REFERENCE_SIGNING_SECRET = "private-test-signing-secret-at-least-32-characters";
  const input = body({ referenceId: "creator-account-1-01" });
  const response = await handleHookKeyframeGeneration(post(input));
  assert.equal(response.status, 202);
  const job = calls.findLast(call => call.create).create;
  assert.match(job.input.referenceImageUrl, /\/api\/explore\/creator-scene\/creator-account-1-01\/explore\/hook-starting-frames\/v1\//);
  assert.equal(new URL(job.input.referenceImageUrl).search, "");
  assert.equal(count("snapshot"), 0); assert.equal(count("reserve"), 1); assert.equal(count("create"), 1);
  assert.equal((await handleHookKeyframeGeneration(post(input))).status, 202);
  assert.equal(count("reserve"), 1); assert.equal(count("create"), 1);
  delete process.env.CREATOR_REFERENCE_SIGNING_SECRET;
});

test("other emails cannot prepare a creator scene even with the exact reference ID and hash", async () => {
  actorEmail = "other@example.com";
  assert.equal((await handleHookKeyframeGeneration(post(body({ referenceId: "creator-account-1-01" })))).status, 404);
  assert.equal(count("frameRead"), 0); assert.equal(count("snapshot"), 0); assert.equal(count("reserve"), 0); assert.equal(count("create"), 0);
});

test("curated admission requires the reviewed anchor key and freezes both original opening and clarity", async () => {
  const selected = curatedFrames.frames[0];
  source = { frameIndex: selected.index, frameTimeSeconds: selected.timeSeconds, sourceSha256: selected.sourceSha256,
    frameSha256: selected.sha256, width: selected.width, height: selected.height, png: Buffer.from("mock approved pixels") };
  openingSource = { ...source, frameIndex: 0, frameTimeSeconds: 0, frameSha256: "c".repeat(64), png: Buffer.from("mock original opening") };
  const request = body({ referenceId: selected.referenceId, sourceSha256: selected.sourceSha256 });
  const sourceFrame = { index: selected.index, timeSeconds: selected.timeSeconds, width: selected.width, height: selected.height, sha256: selected.sha256 };
  const key = frame => hookKeyframeGenerationInputKey({ version: 3, imageModel: request.imageModel, ownerId: OWNER, draftId: request.draftId,
    referenceId: request.referenceId, sourceSha256: request.sourceSha256, sourceFrame: frame, personImageAssetIds: request.personImageAssetIds, instructions: request.instructions });
  for (const preparationInputKey of [undefined, key({ ...sourceFrame, index: 0, timeSeconds: 0 })]) {
    const response = await handleHookKeyframeGeneration(post({ ...request, preparationInputKey }));
    assert.equal(response.status, 409); assert.equal(count("reserve"), 0); assert.equal(count("snapshot"), 0);
  }
  request.preparationInputKey = key(sourceFrame);
  const missingModel = await handleHookKeyframeGeneration(post({ ...request, imageModel: undefined }));
  assert.equal(missingModel.status, 400); assert.equal(count("reserve"), 0); assert.equal(count("snapshot"), 0);
  const accepted = await handleHookKeyframeGeneration(post(request)); assert.equal(accepted.status, 202);
  const result = await accepted.json(); assert.equal(result.receipt.version, 4); assert.deepEqual(result.receipt.sourceFrame, sourceFrame);
  assert.equal(result.receipt.animationOpeningFrame.index, 0); assert.equal(count("snapshot"), 2);
  assert.doesNotMatch(calls.findLast(call => call.create).create.input.prompt, /VERIFIED OPENING SCENE/);
  const recovered = await handleHookKeyframeGeneration(post(request)); assert.equal(recovered.status, 202);
  assert.equal((await recovered.json()).jobId, result.jobId); assert.equal(count("reserve"), 1); assert.equal(count("create"), 1);
});

test("Hook 100 pilot binds stored t=0 first, clarity anchor second and identity photos afterward", async () => {
  const selected = curatedFrames.frames.find(frame => frame.number === 100);
  source = { frameIndex: selected.index, frameTimeSeconds: selected.timeSeconds, sourceSha256: selected.sourceSha256,
    frameSha256: selected.sha256, width: selected.width, height: selected.height, png: Buffer.from("reviewed clarity anchor pixels") };
  openingSource = { frameIndex: 0, frameTimeSeconds: 0, sourceSha256: selected.sourceSha256,
    frameSha256: "c".repeat(64), width: selected.width, height: selected.height, png: Buffer.from("stored original opening pixels") };
  const request = body({ referenceId: selected.referenceId, sourceSha256: selected.sourceSha256 });
  const sourceFrame = { index: selected.index, timeSeconds: selected.timeSeconds, width: selected.width, height: selected.height, sha256: selected.sha256 };
  request.preparationInputKey = hookKeyframeGenerationInputKey({ version: 3, imageModel: request.imageModel, ownerId: OWNER, draftId: request.draftId,
    referenceId: request.referenceId, sourceSha256: request.sourceSha256, sourceFrame, personImageAssetIds: request.personImageAssetIds, instructions: request.instructions });
  const response = await handleHookKeyframeGeneration(post(request));
  assert.equal(response.status, 202);
  const queued = calls.findLast(call => call.create).create, receipt = queued.input.hookKeyframe;
  assert.equal(receipt.version, 4); assert.equal(receipt.promptVersion, 5);
  assert.deepEqual(receipt.sourceFrame, sourceFrame);
  assert.deepEqual(receipt.animationOpeningFrame, { index: 0, timeSeconds: 0, width: selected.width, height: selected.height, sha256: "c".repeat(64) });
  assert.equal(receipt.preparationInputKey, request.preparationInputKey);
  assert.match(queued.input.referenceImageUrls[0], new RegExp(`/${selected.sourceSha256}/${"c".repeat(64)}\\.png$`));
  assert.match(queued.input.referenceImageUrls[1], new RegExp(`/${selected.sourceSha256}/${selected.sha256}\\.png$`));
  assert.deepEqual(queued.input.referenceImageUrls.slice(2), [asset(MAIN).url, asset(SUPPORT).url]);
  assert.match(queued.input.prompt, /Image 1 is the sole blueprint for output time t=0\.000/);
  assert.match(queued.input.prompt, /Image 2 is the reviewed later source moment at t=2\.333333/);
  assert.match(queued.input.prompt, /Image 3 is the main identity photo and the only person/);
  assert.equal(count("openingFrameRead"), 1); assert.equal(count("snapshot"), 2);
  assert.equal(count("reserve"), 1); assert.equal(count("dispatch"), 1);
});

test("canonical non-Hook preparations retain legacy receipt provenance and derive their job format from server source", async () => {
  for (const workflow of ["wall_text", "talking_head"]) {
    source.workflow = workflow;
    const response = await handleHookKeyframeGeneration(post(body({ referenceId: `${workflow}-fixture` })));
    assert.equal(response.status, 202);
    const job = calls.findLast(call => call.create)?.create;
    assert.equal(job.input.exploreFormat, workflow === "wall_text" ? "wall_text" : "hook");
    assert.equal(job.input.hookKeyframe.purpose, "hook_starting_frame");
    assert.equal(job.input.hookKeyframe.referenceId, `${workflow}-fixture`);
  }
});

test("non-Hook image preparations reject non-animatable source shapes before storage and billing", async () => {
  source.workflow = "wall_text"; source.width = 1024; source.height = 1024;
  assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 400);
  assert.equal(count("reserve"), 0); assert.equal(count("create"), 0); assert.equal(count("snapshot"), 0);
});
test("request parser rejects unowned URLs, duplicate IDs, excess photos and malformed instructions before credit reservation", async () => {
  for (const change of [{ sourceUrl: "https://foreign.test/file" }, { personImageAssetIds: [] }, { personImageAssetIds: [MAIN, MAIN.toUpperCase()] },
    { personImageAssetIds: Array.from({ length: 6 }, () => crypto.randomUUID()) }, { instructions: "x".repeat(2001) }, { instructions: "x\u0000" }, { sourceSha256: "stale" }, { draftId: "bad" }]) {
    assert.equal((await handleHookKeyframeGeneration(post(body(change)))).status, 400);
  }
  assert.equal((await handleHookKeyframeGeneration(post(body({ instructions: "é".repeat(17000) })))).status, 413);
  assert.equal(count("reserve"), 0); assert.equal(count("photoRead"), 0);
});
test("missing environment, unavailable photos, unsupported source and stale exact source are precredit errors", async () => {
  missing = true; assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 501); missing = false;
  for (const change of [{ user_id: "foreign" }, { status: "uploading" }, { deleted_at: "now" }, { mime_type: "image/gif" }, { collection: "video" },
    { file_size_bytes: -1 }, { file_size_bytes: 1.5 }, { file_size_bytes: 25 * 1024 ** 2 + 1 }, { url: "https://foreign.test/photo.png" }]) {
    assets.set(MAIN, { ...asset(MAIN), ...change }); assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 400);
  }
  assets.set(MAIN, asset(MAIN)); source.width = 719;
  assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 400); source.width = 720;
  assert.equal((await handleHookKeyframeGeneration(post(body({ sourceSha256: "c".repeat(64) })))).status, 409);
  assets.set(SUPPORT, { ...asset(SUPPORT), url: asset(MAIN).url });
  assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 400);
  assert.equal(count("snapshot"), 0); assert.equal(count("reserve"), 0);
});
test("combined 50 MiB admission includes canonical source PNG, accepts the bound and rejects one byte over", async () => {
  for (const id of [MAIN, SUPPORT]) assets.get(id).file_size_bytes = 20 * 1024 ** 2;
  assets.get(THIRD).file_size_bytes = 10 * 1024 ** 2 - source.png.byteLength;
  const input = body({ personImageAssetIds: [MAIN, SUPPORT, THIRD] });
  assert.equal((await handleHookKeyframeGeneration(post(input))).status, 202);
  const reserved = count("reserve"), snapshots = count("snapshot");
  assets.get(THIRD).file_size_bytes++;
  const response = await handleHookKeyframeGeneration(post({ ...input, idempotencyKey: crypto.randomUUID() }));
  assert.equal(response.status, 400); assert.match((await response.json()).message, /50 MiB/);
  assert.equal(count("reserve"), reserved); assert.equal(count("snapshot"), snapshots);
});
test("actual object size and type are checked for both private uploads and generated influencer photos with missing size metadata", async () => {
  assets.get(MAIN).metadata = { storageLocation: "private_user_media" };
  Object.assign(assets.get(SUPPORT), { collection: "influencer", file_size_bytes: null, source_type: "generated_image" });
  assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 202);
  assert.ok(calls.some(call => call.head === assets.get(MAIN).storage_key && call.privateObject));
  assert.ok(calls.some(call => call.head === assets.get(SUPPORT).storage_key && !call.privateObject));
  const reserved = count("reserve");
  for (const changed of [{ ContentLength: 25 * 1024 ** 2 + 1 }, { ContentLength: undefined }, { ContentLength: 0 }, { ContentType: "image/webp" }]) {
    objectOverrides = changed; assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 400);
  }
  assert.equal(count("reserve"), reserved);
});
test("ordered scene/main/support contract and source hash are persisted before the single billed dispatch", async () => {
  const input = body(), response = await handleHookKeyframeGeneration(post(input));
  assert.equal(response.status, 202); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const queued = calls.find(call => call.create).create, receipt = queued.input.hookKeyframe;
  assert.equal(receipt.ownerId, OWNER); assert.equal(receipt.sourceSha256, input.sourceSha256);
  assert.equal(receipt.version, 2); assert.equal(receipt.promptVersion, 4); assert.equal(receipt.imageModel, "nano_banana_2");
  assert.deepEqual(receipt.personImageAssetIds, [MAIN, SUPPORT]); assert.equal(receipt.sourceFrame.index, 0);
  assert.equal(queued.maxAttempts, 1); assert.equal(queued.input.model, "nano_banana_2"); assert.equal(queued.input.exploreFormat, "hook");
  assert.deepEqual(queued.input.referenceImageUrls.slice(1), [asset(MAIN).url, asset(SUPPORT).url]);
  assert.match(queued.input.referenceImageUrls[0], new RegExp(`/${"a".repeat(64)}/${"b".repeat(64)}\\.png$`));
  assert.match(queued.input.prompt, /^Generate a new photograph of my influencer/); assert.match(queued.input.prompt, /Image 2 is the main face/); assert.match(queued.input.prompt, /Image 3 is an additional view/);
  assert.ok(calls.findIndex(call => call.snapshot) < calls.findIndex(call => call.reserve));
  assert.ok(calls.findIndex(call => call.reserve) < calls.findIndex(call => call.create));
  assert.equal(count("reserve"), 1); assert.equal(count("dispatch"), 1);
});
test("snapshot failure or mismatched content-addressed storage URL cannot reserve credits", async () => {
  storageError = Error("storage unavailable"); assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 503); storageError = undefined;
  for (const url of ["https://foreign.test/scene.png", "https://owned-media.example.test/wrong.png"]) {
    snapshotUrl = url; assert.equal((await handleHookKeyframeGeneration(post(body()))).status, 503);
  }
  assert.equal(count("reserve"), 0); assert.equal(count("dispatch"), 0);
});
test("sequential same-key replay reads accepted job without new preparation, reservation or dispatch", async () => {
  const input = body(), first = await (await handleHookKeyframeGeneration(post(input))).json();
  const before = { reserves: count("reserve"), dispatches: count("dispatch"), snapshots: count("snapshot") };
  assets.clear(); source = null;
  const replay = await (await handleHookKeyframeGeneration(post(input))).json();
  assert.equal(replay.jobId, first.jobId); assert.deepEqual(replay.receipt, first.receipt);
  assert.deepEqual({ reserves: count("reserve"), dispatches: count("dispatch"), snapshots: count("snapshot") }, before);
  const conflict = await handleHookKeyframeGeneration(post({ ...input, instructions: "Different instructions" }));
  assert.equal(conflict.status, 409); assert.equal(count("reserve"), before.reserves);
});

test("an accepted legacy image prompt remains recoverable without recompiling it as V2 or dispatching another request", async () => {
  const input = body();
  assert.equal((await handleHookKeyframeGeneration(post(input))).status, 202);
  const existing = [...saved.values()][0];
  const { hookKeyframeGenerationInputKey, hookKeyframePromptSha256 } = await import("../../worker/src/lib/hook-keyframe-generation-contract.ts");
  existing.input.prompt = "Legacy Image 1 scene and Image 2 face instructions.";
  existing.input.hookKeyframe.promptVersion = 1;
  existing.input.hookKeyframe.version = 1; delete existing.input.hookKeyframe.imageModel;
  existing.input.hookKeyframe.inputKey = hookKeyframeGenerationInputKey(existing.input.hookKeyframe);
  existing.input.hookKeyframe.promptSha256 = hookKeyframePromptSha256(existing.input.prompt);
  calls.length = 0;
  const replay = await handleHookKeyframeGeneration(post({ ...input, imageModel: undefined }));
  assert.equal(replay.status, 202);
  const response = await replay.json();
  assert.equal(response.receipt.promptVersion, 1);
  assert.equal(existing.input.prompt, "Legacy Image 1 scene and Image 2 face instructions.");
  assert.equal(count("frameRead"), 0); assert.equal(count("reserve"), 0); assert.equal(count("dispatch"), 0);
});

test("model selection is explicit before new reservation, priced for that model, and cannot reuse another model's request", async () => {
  for (const model of ["gemini_3_pro", "nano_banana_2", "gpt_image", "gpt_image_2_5", "seedream_5_pro"]) {
    const costResponse = await handleHookKeyframeStatus(get(`cost=1&model=${model}`));
    const quote = await costResponse.json(); assert.equal(costResponse.status, 200); assert.equal(quote.model, model);
    const input = body({ imageModel: model });
    const response = await handleHookKeyframeGeneration(post(input)); assert.equal(response.status, 202);
    const created = calls.filter(call => call.create).at(-1).create;
    assert.equal(created.input.model, model); assert.equal(created.input.hookKeyframe.imageModel, model);
    assert.equal(calls.filter(call => call.reserve).at(-1).reserve.amount, quote.creditCost);
    assert.equal(created.input.creditCost, quote.creditCost);
    assert.equal(JSON.parse(created.input.hookKeyframe.inputKey).imageModel, model);
    const reserved = count("reserve");
    assert.equal((await handleHookKeyframeGeneration(post({ ...input, imageModel: model === "gemini_3_pro" ? "nano_banana_2" : "gemini_3_pro" }))).status, 409);
    assert.equal(count("reserve"), reserved);
  }
  const reserved = count("reserve");
  for (const imageModel of [undefined, "unsupported", "gpt_image_unsupported"]) assert.equal((await handleHookKeyframeGeneration(post(body({ imageModel })))).status, 400);
  const five = [MAIN, SUPPORT, THIRD, crypto.randomUUID(), crypto.randomUUID()];
  assert.equal((await handleHookKeyframeGeneration(post(body({ imageModel: "nano_banana_2", personImageAssetIds: five })))).status, 400);
  assert.equal((await handleHookKeyframeStatus(get("cost=1&model=unsupported"))).status, 400);
  assert.equal(count("reserve"), reserved);
});
test("concurrent identical delivery coalesces to one job and independently consumable responses", async () => {
  const input = body(); let release; concurrentGate = new Promise(resolve => { release = resolve; });
  const first = handleHookKeyframeGeneration(post(input));
  while (!count("snapshot")) await new Promise(resolve => setTimeout(resolve, 0));
  const second = handleHookKeyframeGeneration(post(input));
  release(); const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map(response => response.status), [202, 202]);
  const results = await Promise.all(responses.map(response => response.json()));
  assert.equal(results[0].jobId, results[1].jobId); assert.equal(count("snapshot"), 1); assert.equal(count("reserve"), 1); assert.equal(count("dispatch"), 1);
});
test("concurrent different preparations with the same key are rejected without touching the accepted reservation", async () => {
  const input = body(); let release; concurrentGate = new Promise(resolve => { release = resolve; });
  const first = handleHookKeyframeGeneration(post(input));
  while (!count("snapshot")) await new Promise(resolve => setTimeout(resolve, 0));
  const conflict = await handleHookKeyframeGeneration(post({ ...input, personImageAssetIds: [SUPPORT, MAIN] }));
  assert.equal(conflict.status, 409); release(); assert.equal((await first).status, 202);
  assert.equal(count("reserve"), 1); assert.equal(count("dispatch"), 1);
});
test("uncertain dispatch retains saved request and polling/replay never charges or dispatches again", async () => {
  const input = body(); queueError = Error("queue response lost");
  assert.equal((await handleHookKeyframeGeneration(post(input))).status, 503); queueError = undefined;
  const creates = count("create"), reserves = count("reserve"), snapshots = count("snapshot");
  const recovered = await handleHookKeyframeStatus(get(`requestKey=${input.idempotencyKey}`));
  assert.equal(recovered.status, 200); const status = await recovered.json(); assert.equal(status.job.status, "queued");
  assert.equal((await handleHookKeyframeGeneration(post(input))).status, 202);
  assert.equal(count("reserve"), reserves); assert.equal(count("create"), creates); assert.equal(count("snapshot"), snapshots); assert.equal(count("dispatch"), 0);
});
test("a cross-instance job collision is rechecked before dispatch and cannot release the old accepted reservation", async () => {
  const original = body(); await handleHookKeyframeGeneration(post(original));
  collision = structuredClone([...saved.values()][0]);
  // Simulate a previously accepted row discovered by the durable create-or-get
  // operation after this instance's initial lookup returned empty.
  saved.clear(); calls.length = 0;
  const response = await handleHookKeyframeGeneration(post(body({ instructions: "Different photo edit" })));
  assert.equal(response.status, 409); assert.equal(count("dispatch"), 0);
  assert.deepEqual(collision.input.hookKeyframe.personImageAssetIds, original.personImageAssetIds);
});
test("GET cost/status is read-only, owner scoped and rejects ambiguous or unknown request IDs", async () => {
  const cost = await handleHookKeyframeStatus(get("cost=1")); assert.equal(cost.status, 200); assert.equal((await cost.json()).creditCost, 5);
  for (const query of ["", `jobId=${crypto.randomUUID()}&requestKey=${crypto.randomUUID()}`, "cost=2", "jobId=bad", `requestKey=${crypto.randomUUID()}&extra=1`]) assert.equal((await handleHookKeyframeStatus(get(query))).status, 400);
  assert.equal((await handleHookKeyframeStatus(get(`requestKey=${crypto.randomUUID()}`))).status, 404);
  const input = body(); const accepted = await (await handleHookKeyframeGeneration(post(input))).json();
  const previous = count("reserve"); assert.equal((await handleHookKeyframeStatus(get(`jobId=${accepted.jobId}`))).status, 200);
  assert.equal(count("reserve"), previous); assert.equal(count("dispatch"), 1);
  assert.ok(calls.filter(call => call.jobRead).every(call => call.userId === OWNER));
});
test("completed status rejects missing collection output rather than falling back to a portrait or scene", async () => {
  const accepted = await (await handleHookKeyframeGeneration(post(body()))).json(), stored = [...saved.values()][0];
  stored.status = "completed"; stored.output = { url: asset(MAIN).url };
  assert.equal((await handleHookKeyframeStatus(get(`jobId=${accepted.jobId}`))).status, 409); assert.equal(count("reserve"), 1); assert.equal(count("dispatch"), 1);
});

test("audit all twelve creator frames through actual API, every image model, retry recovery and retained legacy v2", {skip:privateCreatorCatalog.accounts.length===0&&"Private creator fixtures or package key are unavailable in this public clone."},async () => {
  const fs = await import('node:fs');
  const catalog = privateCreatorCatalog;
  const {creatorSceneCanonicalUrl} = await import('../../worker/src/lib/creator-scene-delivery.ts');
  const scenarios=[];
  process.env.CREATOR_REFERENCE_SIGNING_SECRET='offline-audit-test-key-at-least-32-characters';
  for(const account of catalog.accounts)for(const item of account.items)for(const imageModel of ['gemini_3_pro','nano_banana_2','seedream_5_pro']){
    calls.length=0;saved.clear();
    const frame=item.startingFrame;
    source={frameIndex:frame.index,frameTimeSeconds:frame.timeSeconds,frameSha256:frame.sha256,sourceSha256:item.sourceSha256,width:frame.width,height:frame.height,png:readCreatorPrivateFile(`creator-account-media/${frame.sha256}.png`)};
    openingSource={...source,frameIndex:0,frameTimeSeconds:0,frameSha256:item.posterSha256,png:readCreatorPrivateFile(`creator-account-media/${item.sourceSha256}.png`)};
    // Exercise main-photo changes as well as the default picker order.
    const selectedPhotos=imageModel==='nano_banana_2'?[SUPPORT,MAIN]:[MAIN,SUPPORT];
    const input=body({referenceId:item.id,sourceSha256:item.sourceSha256,imageModel,personImageAssetIds:selectedPhotos});
    const sourceFrame={index:frame.index,timeSeconds:frame.timeSeconds,sha256:frame.sha256,width:frame.width,height:frame.height};
    input.preparationInputKey=hookKeyframeGenerationInputKey({version:3,imageModel,ownerId:OWNER,draftId:input.draftId,referenceId:input.referenceId,sourceSha256:input.sourceSha256,sourceFrame,personImageAssetIds:input.personImageAssetIds,instructions:input.instructions});
    const response=await handleHookKeyframeGeneration(post(input));
    assert.equal(response.status,202,`${item.id}/${imageModel}: ${await response.clone().text()}`);
    const accepted=await response.json();
    assert.equal(accepted.receipt.version,frame.index>0?4:3);assert.deepEqual(accepted.receipt.sourceFrame,sourceFrame);
    assert.equal(count('snapshot'),0);assert.equal(count('reserve'),1);assert.equal(count('create'),1);
    assert.equal((await handleHookKeyframeGeneration(post(input))).status,202);assert.equal(count('reserve'),1);assert.equal(count('create'),1);
    const stored=[...saved.values()][0],receipt=stored.input.hookKeyframe;
    assert.deepEqual(receipt.personImageAssetIds,selectedPhotos);
    assert.deepEqual(stored.input.referenceImageUrls,frame.index>0?[creatorSceneCanonicalUrl(receipt,"opening"),creatorSceneCanonicalUrl(receipt),...selectedPhotos.map(id=>asset(id).url)]:[creatorSceneCanonicalUrl(receipt),...selectedPhotos.map(id=>asset(id).url)],`${item.id}/${imageModel}: original opening, clarity and selected photos stay ordered`);
    if(frame.index>0){assert.match(stored.input.prompt,/original video t=0/);assert.match(stored.input.prompt,/Image 3 is the selected influencer/);assert.equal(receipt.animationOpeningFrame.sha256,item.posterSha256);}
    else {assert.match(stored.input.prompt,/Image 2 is the main face photo/);assert.match(stored.input.prompt,/Image 3 is an additional view of the SAME person/);assert.match(stored.input.prompt,/recognizable likeness takes priority/);}
    if(receipt.version===4){delete receipt.animationOpeningFrame;delete receipt.preparationInputKey;receipt.promptVersion=4;stored.input.referenceImageUrls.splice(1,1);}
    receipt.version=2;receipt.sourceFrame={index:0,timeSeconds:0,sha256:item.posterSha256,width:item.width,height:item.height};
    receipt.inputKey=hookKeyframeGenerationInputKey(receipt);
    stored.input.referenceImageUrl=creatorSceneCanonicalUrl(receipt);stored.input.referenceImageUrls[0]=stored.input.referenceImageUrl;
    input.preparationInputKey=receipt.inputKey;
    const before=count('frameRead');
    assert.equal((await handleHookKeyframeGeneration(post(input))).status,202,`Legacy replay ${item.id}/${imageModel}`);
    assert.equal(count('reserve'),1);assert.equal(count('create'),1);assert.equal(count('frameRead'),before);
    scenarios.push({referenceId:item.id,imageModel,index:frame.index,sourceSha256:item.sourceSha256,sourceFrameSha256:frame.sha256,version3:true,publicSnapshotWrites:0,charges:1,replayedWithoutCharge:true,legacyV2ReplayedWithoutSourceRead:true});
  }
  fs.mkdirSync('.tmp/creator-parity-audit',{recursive:true});fs.writeFileSync('.tmp/creator-parity-audit/api-all12-results.json',JSON.stringify({scenarios,networkCalls:0,paidCalls:0,limitation:'Actual API with mocked auth, owned-photo records, credit reservation and job persistence. No live billing or provider calls.'},null,2));
  delete process.env.CREATOR_REFERENCE_SIGNING_SECRET;
});
