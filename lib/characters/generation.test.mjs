import assert from "node:assert/strict";
import test from "node:test";

process.env.GCP_STORAGE_BUCKET = "character-test";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://character-media.example.test";

const { CharacterGenerateRequestSchema, CharacterSpecSchema } = await import("./schema.ts");
const { CharacterGenerationError, characterBatchId, characterChildIdempotencyKey, generateCharacterBatch } = await import("./generation-service.ts");
const { createCharacterGenerationHandlers, handleCharacterGeneration } = await import("./generation-api.ts");
const { FirebaseAuthRequestError } = await import("../firebase/server-auth.ts");
const { characterAccessFromCredits, characterRequestCount } = await import("./access-policy.ts");

const owner = "firebase-owner";
const spec = {
  creatorType: "approachable productivity creator", gender: "female", age: 28,
  appearance: "shoulder-length brown hair, naturally textured skin", wardrobe: "casual green cotton top",
  environment: "ordinary home office", expression: "relaxed conversational smile",
  framing: "eye-level chest-up smartphone portrait", lighting: "soft window daylight",
};
const plan = { schemaVersion: 1, creativeBrief: "PRIVATE INTERNAL BRIEF", candidates: [spec, { ...spec, appearance: "short dark curly hair" }, { ...spec, appearance: "long light brown hair" }] };
const profile = {
  id: "profile-owner", userId: owner, profileVersion: 4,
  context: {
    businessName: "PRIVATE BUSINESS NAME", category: "productivity", productSummary: "PRIVATE PRODUCT FACT",
    targetAudience: ["freelancers", "independent professionals"], mainProblem: "organization", brandTone: "friendly",
    visualKeywords: ["home office"], claimsToAvoid: ["PRIVATE CLAIM"], confidenceReason: "PRIVATE SOURCE ANALYSIS",
  },
};
const request = { mode: "custom", prompt: "A confident adult creator in a polished studio, wearing a black shirt.", model: "gpt_image", idempotencyKey: "initial-character" };
let fixtureCounter = 0;
function uuid() { return `11111111-1111-4111-8111-${(++fixtureCounter).toString(16).padStart(12, "0")}`; }
function makeJob(input, idempotencyKey, userId = owner) {
  return {
    id: uuid(), userId, jobType: "generate_image", status: "queued", input, output: null,
    idempotencyKey, queueName: "ai-generation", queueProvider: "gcp", queueMessageId: null,
    attemptCount: 0, maxAttempts: 3, errorCode: null, errorMessage: null, progress: null,
    stage: null, createdAt: "2026-10-02T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z",
  };
}
function fixture({ free = false } = {}) {
  const jobs = new Map();
  const imageCost = free ? 1 : 5;
  const state = { planCalls: 0, accessCalls: 0, profileCalls: 0, reserveCalls: 0, dispatchCalls: 0, creditsRemaining: free ? 2 : 100, creditDenied: false, queueOutage: false, captured: null, reference: null, referenceAsset: null, assetReads: [] };
  const dependencies = {
    async getExistingJob(key, userId) { const job = jobs.get(key); return job?.userId === userId ? job : null; },
    async requireAccess(_userId, input) {
      state.accessCalls++;
      if (state.creditDenied) throw new CharacterGenerationError("INSUFFICIENT_CREDITS", "No credits", 402);
      const count = characterRequestCount(characterAccessFromCredits(!free, state.creditsRemaining, imageCost), input);
      if (!count) throw new CharacterGenerationError("INSUFFICIENT_CREDITS", "No credits", 402);
      return { count, useFreeAllowance: false };
    },
    async getBusinessProfile() { state.profileCalls++; return profile; },
    async getReference() { return state.reference; },
    async getReferenceAsset(id, userId) { state.assetReads.push({ id, userId }); return state.referenceAsset; },
    async plan(input) { state.planCalls++; state.planningInput = input; return structuredClone(plan); },
    async reserveBatch(input) {
      state.reserveCalls++;
      state.captured = input;
      if (!jobs.has(characterChildIdempotencyKey(input.batchId, 1))) state.creditsRemaining -= input.amountPerImage * input.inputs.length;
      return input.inputs.map((candidate, index) => {
        const key = characterChildIdempotencyKey(input.batchId, index + 1);
        const job = jobs.get(key) || makeJob(candidate, key, input.userId);
        jobs.set(key, job);
        return job;
      });
    },
    async dispatch(job) {
      state.dispatchCalls++;
      if (!state.queueOutage) job.queueMessageId ||= "cloud-task";
      return job;
    },
    getImageCreditCost: () => imageCost,
    createId: uuid,
  };
  return { jobs, state, dependencies };
}
function apiFixture(generationFixture) {
  const state = { job: null, asset: null, usageCalls: 0, authError: null };
  const handlers = createCharacterGenerationHandlers({
    async authenticate() { if (state.authError) throw state.authError; return { uid: owner, emailVerified: true }; },
    async getAccess() { return { isPaid: true, canGenerate: true, freeGenerationAvailable: false, requestedCount: 3, creditsRequired: 15, creditsRemaining: 100, message: null }; },
    generation: generationFixture.dependencies,
    async getJob(_jobId, userId) { return state.job?.userId === userId ? state.job : null; },
    async getAsset(_id, userId) { return state.asset?.user_id === userId ? state.asset : null; },
    async deliverUsage() { state.usageCalls++; },
    requireRuntime() {},
  });
  return { state, handlers };
}
function post(body) { return new Request("https://www.getugcpilot.com/api/characters/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

test("generation requests cannot supply identity, business facts, quantity or arbitrary references", () => {
  for (const extra of [{ userId: "other" }, { quantity: 1 }, { characterSpec: spec }, { businessContext: profile.context }, { referenceImageUrl: "https://example.com/other.png" }]) {
    assert.equal(CharacterGenerateRequestSchema.safeParse({ ...request, ...extra }).success, false);
  }
  for (const invalid of [{ ...request, gender: "female" }, { ...request, model: "unknown" }, { ...request, mode: "assisted" }, { ...request, prompt: undefined }, { ...request, prompt: " " }, { ...request, prompt: "x".repeat(32001) }]) {
    assert.equal(CharacterGenerateRequestSchema.safeParse(invalid).success, false);
  }
  assert.equal(CharacterGenerateRequestSchema.safeParse({ ...request, prompt: "A casual adult creator" }).success, true);
  assert.equal(CharacterSpecSchema.safeParse({ ...spec, age: 17 }).success, false);
});

test("removed assisted generation is rejected before any access, planning or credit reservation", async () => {
  for (const free of [true, false]) {
    const { dependencies, state } = fixture({ free });
    const withoutChoice = { mode: "assisted", model: "gpt_image", idempotencyKey: `no-gender-${free}` };
    await assert.rejects(generateCharacterBatch(owner, withoutChoice, dependencies), { code: "INPUT_INVALID", status: 400 });
    assert.equal(state.accessCalls, 0);
    assert.equal(state.planCalls, 0);
    assert.equal(state.profileCalls, 0);
    assert.equal(state.reserveCalls, 0);
  }
});

test("paid creation queues exactly three through the shared image worker for each selected model", async () => {
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
    const { dependencies, state, jobs } = fixture();
    const response = await generateCharacterBatch(owner, { ...request, model }, dependencies);
    assert.equal(response.requestedCount, 3);
    assert.equal(response.jobs.length, 3);
    assert.equal(jobs.size, 3);
    assert.equal(state.reserveCalls, 1);
    assert.equal(state.captured.amountPerImage, 5);
    assert.equal(state.captured.useFreeAllowance, false);
    assert.equal(state.planCalls, 0);
    assert.equal(state.profileCalls, 0);
    for (const [index, input] of state.captured.inputs.entries()) {
      assert.equal(input.model, model);
      assert.equal(input.provider, model === "seedream_5_pro" ? "openrouter" : undefined);
      assert.equal(input.batchSize, 3);
      assert.equal(input.candidateIndex, index + 1);
      assert.equal(input.businessProfileVersion, null);
      assert.equal(input.businessProfileId, null);
      assert.equal(input.characterVersion, 2);
      assert.equal(input.promptSource, "user");
      assert.equal(input.characterSpec, undefined);
      assert.equal(input.characterPlan, undefined);
      assert.equal(input.gender, undefined);
      assert.equal(input.mcpSource, undefined);
      assert.equal(input.prompt, request.prompt);
      assert.equal(input.prompt.includes("PRIVATE"), false);
    }
    assert.equal(JSON.stringify(response).includes("PRIVATE"), false);
    assert.equal(JSON.stringify(response).includes("characterSpec"), false);
  }
});

test("selected skills reach every model job exactly once and recover the frozen prompt without extra reservations", async () => {
  const { CHARACTER_PROMPT_SKILLS, composeCharacterPrompt } = await import("./prompt-skills.ts");
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
    const f = fixture();
    const input = { ...request, model, skillIds: ["realistic-skin"] };
    const first = await generateCharacterBatch(owner, input, f.dependencies);
    const expected = composeCharacterPrompt(request.prompt, [CHARACTER_PROMPT_SKILLS[0]]);
    assert.ok(f.state.captured.inputs.every(job => job.prompt === expected && job.characterPromptPresentation.userPrompt === request.prompt));
    const api = apiFixture(f);
    api.state.job = [...f.jobs.values()][0];
    const response = await api.handlers.status(new Request(`https://app.test/api/characters/status?jobId=${api.state.job.id}`));
    const status = (await response.json()).job;
    assert.equal(status.prompt, expected);
    assert.equal(status.displayPrompt, request.prompt);
    assert.deepEqual(status.skills, [{ id: "realistic-skin", name: "Realistic Skin" }]);
    const replay = await generateCharacterBatch(owner, JSON.parse(JSON.stringify(input)), f.dependencies);
    assert.deepEqual(replay.jobs, first.jobs);
    assert.equal(f.state.reserveCalls, 1);
    await assert.rejects(generateCharacterBatch(owner, { ...input, skillIds: [] }, f.dependencies), { code: "IDEMPOTENCY_CONFLICT" });
  }
});

test("long user descriptions reach every provider job intact, including their final details", async () => {
  const description = "An adult creator with natural skin texture and a casual home office. ".repeat(300) + "Keep this final detail: blue shirt.";
  assert.ok(description.length > 12_000);
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "gpt_image_2_5"]) {
    const generation = fixture();
    const { handlers } = apiFixture(generation);
    const input = { mode: "custom", model, prompt: description, idempotencyKey: `long-${model}` };
    assert.equal(CharacterGenerateRequestSchema.safeParse(input).success, true);
    const response = await handlers.generate(post(input));
    assert.equal(response.status, 202);
    assert.ok(generation.state.captured.inputs.every(job => job.prompt === description));
    assert.equal(generation.state.planCalls, 0);
  }
});

test("Seedream rejects overlong descriptions before access checks or credit reservations and preserves accepted prompts", async () => {
  const generation = fixture();
  const { handlers } = apiFixture(generation);
  const input = { ...request, model: "seedream_5_pro", prompt: "x".repeat(4001) };
  const rejected = await handlers.generate(post(input));
  assert.equal(rejected.status, 400);
  assert.match(JSON.stringify(await rejected.json()), /4,000 characters/);
  assert.equal(generation.state.accessCalls, 0);
  assert.equal(generation.state.reserveCalls, 0);
  assert.equal(generation.jobs.size, 0);
  const accepted = await handlers.generate(post({ ...input, prompt: "x".repeat(4000) }));
  assert.equal(accepted.status, 202);
  assert.ok(generation.state.captured.inputs.every(job => job.model === "seedream_5_pro" && job.provider === "openrouter" && job.prompt === "x".repeat(4000)));
});

test("new Seedream batches pin OpenRouter, while replay retains previously admitted Runway jobs and credit reservations", async () => {
  const f = fixture();
  const input = { ...request, model: "seedream_5_pro" };
  const first = await generateCharacterBatch(owner, input, f.dependencies);
  assert.ok([...f.jobs.values()].every(job => job.input.provider === "openrouter"));
  // Legacy admissions omitted the provider, preserving the original Runway route.
  for (const saved of f.jobs.values()) delete saved.input.provider;
  const credits = f.state.creditsRemaining;
  const replay = await generateCharacterBatch(owner, input, f.dependencies);
  assert.deepEqual(replay.jobs, first.jobs);
  assert.ok([...f.jobs.values()].every(job => job.input.provider === undefined));
  assert.equal(f.state.reserveCalls, 1);
  assert.equal(f.state.creditsRemaining, credits);
});

test("new influencer models recover the same admitted batch without reserving credits again", async () => {
  for (const model of ["seedream_5_pro", "gpt_image_2_5"]) {
    for (const imageCount of [1, 2, 3]) {
      const generation = fixture();
      const input = { ...request, model, imageCount };
      const first = await generateCharacterBatch(owner, input, generation.dependencies);
      const replay = await generateCharacterBatch(owner, input, generation.dependencies);
      assert.deepEqual(replay, first);
      assert.equal(first.requestedCount, imageCount);
      assert.equal(generation.state.reserveCalls, 1);
      assert.equal(generation.state.creditsRemaining, 100 - imageCount * 5);
    }
  }
});

test("oversized transport payloads fail before planning without a character-count field limit", async () => {
  const generation = fixture();
  const { handlers } = apiFixture(generation);
  const response = await handlers.generate(post({ mode: "custom", model: "gpt_image", prompt: "界".repeat(400_000), idempotencyKey: "transport-bound" }));
  assert.equal(response.status, 413);
  assert.equal(generation.state.planCalls, 0);
});

test("free users can spend their two shared credits on two images, without a separate allowance", async () => {
  const { dependencies, state, jobs } = fixture({ free: true });
  const first = await generateCharacterBatch(owner, request, dependencies);
  assert.equal(first.requestedCount, 1);
  assert.equal(first.jobs.length, 1);
  assert.equal(jobs.size, 1);
  assert.equal(state.captured.amountPerImage, 1);
  assert.equal(state.captured.useFreeAllowance, false);
  assert.equal(state.captured.inputs[0].batchSize, 1);
  const replay = await generateCharacterBatch(owner, request, dependencies);
  assert.deepEqual(replay, first);
  await assert.rejects(generateCharacterBatch(owner, { ...request, imageCount: 3 }, dependencies), { code: "IDEMPOTENCY_CONFLICT", status: 409 });
  assert.equal(state.planCalls, 0);
  assert.equal(state.reserveCalls, 1);
  assert.equal(state.accessCalls, 1);
  await generateCharacterBatch(owner, { ...request, mode: "custom", prompt: "new person", imageCount: 1, idempotencyKey: "second" }, dependencies);
  assert.equal(state.creditsRemaining, 0);
  await assert.rejects(generateCharacterBatch(owner, { ...request, idempotencyKey: "third" }, dependencies), { code: "INSUFFICIENT_CREDITS", status: 402 });
  assert.equal(jobs.size, 2);
});

test("selected one/two/three-image batches price correctly, survive replay and reject changed quantities", async () => {
  for (const free of [true, false]) {
    for (const imageCount of (free ? [1, 2] : [1, 2, 3])) {
      const { dependencies, state } = fixture({ free });
      const input = { ...request, imageCount };
      const first = await generateCharacterBatch(owner, input, dependencies);
      assert.equal(first.jobs.length, imageCount);
      assert.equal(first.requestedCount, imageCount);
      assert.equal(state.creditsRemaining, (free ? 2 : 100) - imageCount * (free ? 1 : 5));
      const replay = await generateCharacterBatch(owner, input, dependencies);
      assert.deepEqual(replay.jobs, first.jobs);
      assert.equal(state.reserveCalls, 1);
      await assert.rejects(generateCharacterBatch(owner, { ...input, imageCount: imageCount === 1 ? 2 : 1 }, dependencies), { code: "IDEMPOTENCY_CONFLICT" });
    }
  }
  for (const imageCount of [0, 4, 1.5, "2", null]) {
    assert.equal(CharacterGenerateRequestSchema.safeParse({ ...request, imageCount }).success, false);
  }
});

test("credit denial happens before the planner or reservation", async () => {
  const { dependencies, state } = fixture();
  state.creditDenied = true;
  await assert.rejects(generateCharacterBatch(owner, request, dependencies), { code: "INSUFFICIENT_CREDITS", status: 402 });
  assert.equal(state.planCalls, 0);
  assert.equal(state.reserveCalls, 0);
});

test("stable semantic replay reuses ids, user prompt and queue delivery; changed instructions conflict", async () => {
  const { dependencies, state } = fixture();
  state.queueOutage = true;
  const input = { ...request, mode: "custom", prompt: " A casual adult creator " };
  const first = await generateCharacterBatch(owner, input, dependencies);
  state.queueOutage = false;
  const replay = await generateCharacterBatch(owner, { ...input, prompt: input.prompt.trim() }, dependencies);
  assert.deepEqual(replay.jobs, first.jobs);
  assert.equal(state.planCalls, 0);
  assert.equal(state.profileCalls, 0);
  assert.equal(state.reserveCalls, 1);
  assert.equal(state.dispatchCalls, 6);
  await assert.rejects(generateCharacterBatch(owner, { ...input, prompt: "Different person" }, dependencies), { code: "IDEMPOTENCY_CONFLICT", status: 409 });
  assert.equal(state.planCalls, 0);
});

test("a partial persisted paid batch is never filled by a new request outside the transaction", async () => {
  const { dependencies, jobs, state } = fixture();
  await generateCharacterBatch(owner, request, dependencies);
  const batchId = characterBatchId(owner, request.idempotencyKey);
  jobs.delete(characterChildIdempotencyKey(batchId, 3));
  await assert.rejects(generateCharacterBatch(owner, request, dependencies), { code: "GENERATION_UNAVAILABLE", status: 503 });
  assert.equal(state.reserveCalls, 1);
});

test("simultaneous retries use the first committed candidate ids rather than duplicate images", async () => {
  const { dependencies, jobs } = fixture();
  const [first, second] = await Promise.all([
    generateCharacterBatch(owner, request, dependencies),
    generateCharacterBatch(owner, request, dependencies),
  ]);
  assert.equal(jobs.size, 3);
  assert.deepEqual(first.jobs, second.jobs);
});

test("multiple saved references are validated for ownership and preserved in order in every provider job", async () => {
  const ids = [uuid(), uuid(), uuid()];
  for (const model of ["gpt_image", "gpt_image_2_5", "nano_banana_2", "gemini_3_pro", "seedream_5_pro"]) {
    const { dependencies, state } = fixture();
    const reads = [];
    dependencies.getReference = async (id, userId) => {
      reads.push({ id, userId });
      return { id, userId: owner, referenceImageUrl: `https://character-media.example.test/${id}.png` };
    };
    const input = { ...request, model, referenceCharacterIds: ids };
    await generateCharacterBatch(owner, input, dependencies);
    assert.deepEqual(reads, ids.map(id => ({ id, userId: owner })));
    for (const job of state.captured.inputs) {
      assert.deepEqual(job.referenceCharacterIds, ids);
      assert.deepEqual(job.referenceImageUrls, ids.map(id => `https://character-media.example.test/${id}.png`));
      assert.equal(job.referenceImageUrl, job.referenceImageUrls[0]);
      assert.equal(job.prompt, request.prompt);
    }
    const credits = state.creditsRemaining;
    await generateCharacterBatch(owner, input, dependencies);
    assert.equal(state.creditsRemaining, credits);
    await assert.rejects(generateCharacterBatch(owner, { ...input, referenceCharacterIds: [...ids].reverse() }, dependencies), { code: "IDEMPOTENCY_CONFLICT" });
  }
});

test("invalid, duplicate, mixed and foreign references fail before reserving credits", async () => {
  const ids = [uuid(), uuid()];
  for (const extra of [{ referenceCharacterIds: [] }, { referenceCharacterIds: [ids[0], ids[0]] },
    { referenceCharacterIds: Array.from({ length: 11 }, uuid) }, { referenceCharacterIds: ids, referenceCharacterId: ids[0] },
    { referenceCharacterIds: ids, referenceImageAssetId: ids[0] }]) {
    const { dependencies, state } = fixture();
    await assert.rejects(generateCharacterBatch(owner, { ...request, ...extra }, dependencies), { code: "INPUT_INVALID" });
    assert.equal(state.reserveCalls, 0);
  }
  for (const bad of [null, { id: ids[1], userId: "other", referenceImageUrl: "https://character-media.example.test/a.png" },
    { id: ids[1], userId: owner, referenceImageUrl: "https://untrusted.test/a.png" }]) {
    const { dependencies, state } = fixture();
    dependencies.getReference = async id => id === ids[0] ? { id, userId: owner, referenceImageUrl: "https://character-media.example.test/owned.png" } : bad;
    await assert.rejects(generateCharacterBatch(owner, { ...request, referenceCharacterIds: ids }, dependencies), { code: "REFERENCE_NOT_FOUND" });
    assert.equal(state.reserveCalls, 0);
  }
});

test("refinement uses only the owned reference image and the unchanged user prompt", async () => {
  const referenceId = uuid();
  const refine = { ...request, mode: "custom", prompt: "Move to an outdoor cafe", referenceCharacterId: referenceId };
  const { dependencies, state } = fixture();
  await assert.rejects(generateCharacterBatch(owner, refine, dependencies), { code: "REFERENCE_NOT_FOUND", status: 404 });
  state.reference = { id: referenceId, userId: "different-owner", referenceImageUrl: "https://character-media.example.test/ref.png", characterSpec: spec };
  await assert.rejects(generateCharacterBatch(owner, refine, dependencies), { code: "REFERENCE_NOT_FOUND", status: 404 });
  state.reference = { ...state.reference, userId: owner, referenceImageUrl: "https://untrusted.test/ref.png" };
  await assert.rejects(generateCharacterBatch(owner, refine, dependencies), { code: "REFERENCE_NOT_FOUND", status: 404 });
  state.reference = { ...state.reference, referenceImageUrl: "https://character-media.example.test/ref.png", characterSpec: { ...spec, age: 45, appearance: "saved distinctive hair and face" } };
  await generateCharacterBatch(owner, refine, dependencies);
  for (const input of state.captured.inputs) {
    assert.equal(input.referenceImageUrl, state.reference.referenceImageUrl);
    assert.equal(input.referenceCharacterId, referenceId);
    assert.equal(input.characterSpec, undefined);
    assert.equal(input.prompt, refine.prompt);
  }
});

const uploadedImage = (id = uuid()) => ({
  id, user_id: owner, collection: "image", status: "ready", deleted_at: null,
  mime_type: "image/png", file_size_bytes: 2048, storage_key: "uploaded-style.png",
  url: "https://character-media.example.test/uploaded-style.png", metadata: {}, source_type: "upload",
});

test("multiple uploaded references reach every model in order and retries preserve the original list", async () => {
  const assets = [uuid(), uuid()].map(id => ({ ...uploadedImage(id), storage_key: `${id}.png`, url: `https://character-media.example.test/${id}.png` }));
  for (const model of ["gpt_image", "gpt_image_2_5", "gemini_3_pro", "nano_banana_2", "seedream_5_pro"]) {
    const f = fixture(), reads = [];
    f.dependencies.getReferenceAsset = async (id, userId) => { reads.push({ id, userId }); return assets.find(asset => asset.id === id) ?? null; };
    const input = { ...request, model, imageCount: 1, referenceImageAssetIds: assets.map(asset => asset.id) };
    const first = await generateCharacterBatch(owner, input, f.dependencies);
    assert.deepEqual(reads, assets.map(asset => ({ id: asset.id, userId: owner })));
    assert.deepEqual(f.state.captured.inputs[0].referenceImageUrls, assets.map(asset => asset.url));
    assert.deepEqual(f.state.captured.inputs[0].referenceImageAssetIds, input.referenceImageAssetIds);
    assert.equal(f.state.captured.inputs[0].referenceImageUrl, assets[0].url);
    f.dependencies.getReferenceAsset = async () => { throw Error("Replay must use admitted references"); };
    assert.deepEqual((await generateCharacterBatch(owner, input, f.dependencies)).jobs, first.jobs);
    assert.equal(f.state.reserveCalls, 1);
    await assert.rejects(generateCharacterBatch(owner, { ...input, referenceImageAssetIds: [...input.referenceImageAssetIds].reverse() }, f.dependencies), { code: "IDEMPOTENCY_CONFLICT" });
  }
});

test("saved and uploaded references combine in preview order for every model and recover without re-admission", async () => {
  const savedIds = [uuid(), uuid(), uuid()];
  const assets = [uuid(), uuid()].map(id => ({ ...uploadedImage(id), storage_key: `${id}.png`, url: `https://character-media.example.test/${id}.png` }));
  for (const model of ["gpt_image", "gpt_image_2_5", "gemini_3_pro", "nano_banana_2", "seedream_5_pro"]) {
    for (const single of [false, true]) {
      const f = fixture(), saved = single ? savedIds.slice(0, 1) : savedIds, uploaded = single ? assets.slice(0, 1) : assets;
      f.dependencies.getReference = async (id, userId) => {
        assert.equal(userId, owner);
        return { id, userId: owner, referenceImageUrl: `https://character-media.example.test/${id}.png` };
      };
      f.dependencies.getReferenceAsset = async (id, userId) => {
        assert.equal(userId, owner);
        return uploaded.find(asset => asset.id === id) ?? null;
      };
      const input = { ...request, model, imageCount: 1, ...(single
        ? { referenceCharacterId: saved[0], referenceImageAssetId: uploaded[0].id }
        : { referenceCharacterIds: saved, referenceImageAssetIds: uploaded.map(asset => asset.id) }) };
      const first = await generateCharacterBatch(owner, input, f.dependencies);
      const job = f.state.captured.inputs[0];
      assert.deepEqual(job.referenceImageUrls, [...saved.map(id => `https://character-media.example.test/${id}.png`), ...uploaded.map(asset => asset.url)]);
      assert.equal(job.referenceImageUrl, job.referenceImageUrls[0]);
      f.dependencies.getReferenceAsset = f.dependencies.getReference = async () => { throw Error("Do not re-admit a replay"); };
      assert.deepEqual((await generateCharacterBatch(owner, input, f.dependencies)).jobs, first.jobs);
      assert.equal(f.state.reserveCalls, 1);
      await assert.rejects(generateCharacterBatch(owner, { ...input, referenceImageAssetId: undefined, referenceImageAssetIds: undefined }, f.dependencies), { code: "IDEMPOTENCY_CONFLICT" });
    }
  }
});

test("a missing mixed upload cannot silently submit only the saved references", async () => {
  const f = fixture();
  f.dependencies.getReference = async id => ({ id, userId: owner, referenceImageUrl: `https://character-media.example.test/${id}.png` });
  f.dependencies.getReferenceAsset = async () => null;
  await assert.rejects(generateCharacterBatch(owner, { ...request, referenceCharacterIds: [uuid(), uuid(), uuid()], referenceImageAssetId: uuid() }, f.dependencies), { code: "REFERENCE_NOT_FOUND" });
  assert.equal(f.state.reserveCalls, 0);
  assert.equal(f.state.dispatchCalls, 0);
});

test("invalid or unavailable uploaded lists fail before any reservation or dispatch", async () => {
  const assets = [uuid(), uuid()].map(id => ({ ...uploadedImage(id), storage_key: `${id}.png`, url: `https://character-media.example.test/${id}.png` }));
  for (const extra of [{ referenceImageAssetIds: [] }, { referenceImageAssetIds: [assets[0].id, assets[0].id] },
    { referenceImageAssetIds: Array.from({ length: 11 }, uuid) },
    { referenceImageAssetIds: [assets[0].id], referenceImageAssetId: assets[1].id },
    { referenceImageAssetIds: [assets[0].id], referenceCharacterIds: [assets[0].id] },
    { referenceImageAssetIds: [assets[0].id, assets[1].id], referenceCharacterIds: Array.from({ length: 9 }, uuid) }]) {
    const f = fixture(); await assert.rejects(generateCharacterBatch(owner, { ...request, ...extra }, f.dependencies), { code: "INPUT_INVALID" });
    assert.equal(f.state.reserveCalls, 0); assert.equal(f.state.dispatchCalls, 0);
  }
  for (const bad of [null, { ...assets[1], user_id: "other-owner" }, { ...assets[1], status: "uploading" },
    { ...assets[1], deleted_at: "2026-10-18" }, { ...assets[1], url: "https://untrusted.test/image.png" }]) {
    const f = fixture(); f.dependencies.getReferenceAsset = async id => id === assets[0].id ? assets[0] : bad;
    await assert.rejects(generateCharacterBatch(owner, { ...request, referenceImageAssetIds: assets.map(a => a.id) }, f.dependencies), { code: "REFERENCE_NOT_FOUND" });
    assert.equal(f.state.reserveCalls, 0); assert.equal(f.state.dispatchCalls, 0);
  }
});

test("an attached owned image and the unchanged style prompt are queued for every character model", async () => {
  const prompt = "Give me an adult influencer image in a similar style to this reference.\nUse the same lighting and color palette, with a new outfit.";
  for (const model of ["gpt_image", "gpt_image_2_5", "gemini_3_pro", "nano_banana_2", "seedream_5_pro"]) {
    const f = fixture();
    f.state.referenceAsset = uploadedImage();
    const { handlers } = apiFixture(f);
    const response = await handlers.generate(post({ ...request, model, imageCount: 2, prompt, referenceImageAssetId: f.state.referenceAsset.id }));
    assert.equal(response.status, 202);
    assert.deepEqual(f.state.assetReads, [{ id: f.state.referenceAsset.id, userId: owner }]);
    assert.equal(f.state.captured.inputs.length, 2);
    for (const input of f.state.captured.inputs) {
      assert.equal(input.referenceImageAssetId, f.state.referenceAsset.id);
      assert.equal(input.referenceImageUrl, f.state.referenceAsset.url);
      assert.equal(input.referenceCharacterId, null);
      assert.equal(input.prompt, prompt);
    }
  }
});

test("invalid attachments fail before credit reservation or dispatch rather than becoming text-only generation", async () => {
  const valid = uploadedImage();
  for (const asset of [null,
    { ...valid, id: uuid() }, { ...valid, user_id: "other-owner" },
    { ...valid, status: "uploading" }, { ...valid, status: "failed" },
    { ...valid, deleted_at: "2026-10-12T00:00:00Z" }, { ...valid, collection: "video" },
    { ...valid, mime_type: "image/svg+xml" }, { ...valid, file_size_bytes: 0 },
    { ...valid, file_size_bytes: 25 * 1024 * 1024 + 1 },
    { ...valid, url: "https://untrusted.test/style.png" },
    { ...valid, url: "https://character-media.example.test/other-image.png" },
    { ...valid, storage_key: "" },
  ]) {
    const f = fixture(); f.state.referenceAsset = asset;
    const { handlers } = apiFixture(f);
    const response = await handlers.generate(post({ ...request, referenceImageAssetId: valid.id }));
    assert.equal(response.status, 404);
    assert.equal(f.state.reserveCalls, 0);
    assert.equal(f.state.dispatchCalls, 0);
    assert.equal(f.state.creditsRemaining, 100);
  }
});

test("reference lookup outages and raw URLs cannot silently generate without the image", async () => {
  const f = fixture();
  f.dependencies.getReferenceAsset = async () => { throw new Error("PRIVATE LOOKUP FAILURE"); };
  const { handlers } = apiFixture(f);
  const response = await handlers.generate(post({ ...request, referenceImageAssetId: uuid() }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE/);
  for (const extra of [ { referenceImageUrl: "https://character-media.example.test/uploaded-style.png" },
    { referenceImageAssetId: "not-a-uuid" }, { referenceImageAssetId: uuid(), referenceImageAssetIds: [uuid()] } ]) {
    assert.equal((await handlers.generate(post({ ...request, ...extra }))).status, 400);
  }
  assert.equal(f.state.reserveCalls, 0); assert.equal(f.state.dispatchCalls, 0);
});

test("uploaded reference replay recovers the same jobs and rejects a changed or removed attachment", async () => {
  const f = fixture(); f.state.referenceAsset = uploadedImage();
  const attached = { ...request, imageCount: 1, referenceImageAssetId: f.state.referenceAsset.id };
  const first = await generateCharacterBatch(owner, attached, f.dependencies);
  f.state.referenceAsset = null; // Existing admissions retain their original input.
  const replay = await generateCharacterBatch(owner, attached, f.dependencies);
  assert.deepEqual(replay.jobs, first.jobs);
  assert.equal(f.state.reserveCalls, 1); assert.equal(f.state.assetReads.length, 1);
  await assert.rejects(generateCharacterBatch(owner, { ...attached, referenceImageAssetId: uuid() }, f.dependencies), { code: "IDEMPOTENCY_CONFLICT" });
  await assert.rejects(generateCharacterBatch(owner, { ...attached, referenceImageAssetId: undefined }, f.dependencies), { code: "IDEMPOTENCY_CONFLICT" });
});

test("private uploaded references keep canonical storage URLs and reject mismatched keys", async () => {
  const previous = process.env.GCP_PRIVATE_MEDIA_BUCKET;
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "character-private-test";
  try {
    const f = fixture();
    f.state.referenceAsset = { ...uploadedImage(), storage_key: "owned/style.png", url: "https://storage.googleapis.com/character-private-test/owned/style.png", metadata: { storageLocation: "private_user_media" } };
    await generateCharacterBatch(owner, { ...request, referenceImageAssetId: f.state.referenceAsset.id }, f.dependencies);
    assert.equal(f.state.captured.inputs[0].referenceImageUrl, f.state.referenceAsset.url);
    for (const patch of [{ storage_key: "other.png" }, { metadata: {} }]) {
      const rejected = fixture(); rejected.state.referenceAsset = { ...f.state.referenceAsset, ...patch };
      await assert.rejects(generateCharacterBatch(owner, { ...request, referenceImageAssetId: rejected.state.referenceAsset.id }, rejected.dependencies), { code: "REFERENCE_NOT_FOUND" });
      assert.equal(rejected.state.reserveCalls, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.GCP_PRIVATE_MEDIA_BUCKET;
    else process.env.GCP_PRIVATE_MEDIA_BUCKET = previous;
  }
});

test("the planner and business profile are never invoked or allowed to override user styling", async () => {
  const { dependencies, state } = fixture();
  dependencies.plan = async () => { throw new Error("The removed planner must never run."); };
  dependencies.getBusinessProfile = async () => { throw new Error("Business facts must never change the image prompt."); };
  const prompt = "An adult fashion influencer. Professional glamour lighting, smooth makeup, pink satin dress.\nCamera at eye level. Empty white studio. Hands out of frame.";
  await generateCharacterBatch(owner, { ...request, prompt }, dependencies);
  assert.ok(state.captured.inputs.every(input => input.prompt === prompt));
});

test("API authenticates before planning and rejects malformed request without work", async () => {
  const generation = fixture();
  const { handlers, state } = apiFixture(generation);
  state.authError = new FirebaseAuthRequestError("Sign in", 401);
  assert.equal((await handlers.generate(post(request))).status, 401);
  state.authError = new FirebaseAuthRequestError("Verify email", 403);
  assert.equal((await handlers.generate(post(request))).status, 403);
  state.authError = null;
  assert.equal((await handlers.generate(post({ ...request, userId: "other" }))).status, 400);
  assert.equal(generation.state.planCalls, 0);
  assert.equal((await handleCharacterGeneration(post(request))).status, 401);
});

test("status checks ownership and source; only the owned submitted prompt is returned without private provider details", async () => {
  const generation = fixture();
  const generated = await generateCharacterBatch(owner, request, generation.dependencies);
  const { handlers, state } = apiFixture(generation);
  const get = () => new Request(`https://www.getugcpilot.com/api/characters/status?jobId=${generated.jobs[0].jobId}`);
  const job = [...generation.jobs.values()][0];
  state.job = { ...job, userId: "other" };
  assert.equal((await handlers.status(get())).status, 404);
  state.job = { ...job, input: { ...job.input, characterSource: "other-flow" } };
  assert.equal((await handlers.status(get())).status, 404);
  state.job = { ...job, status: "failed", errorMessage: "PRIVATE PROVIDER PROMPT", errorCode: "PROVIDER_TIMEOUT" };
  const response = await handlers.status(get());
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(text.includes("PRIVATE"), false);
  assert.equal(text.includes("characterSpec"), false);
  const result = JSON.parse(text);
  assert.equal(result.job.prompt, request.prompt);
  assert.equal(result.job.batchId, job.input.batchId);
  assert.equal(result.job.input, undefined);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(state.usageCalls, 0);
  state.job = { ...job, input: { ...job.input, characterVersion: 1, promptSource: "planner", prompt: "PRIVATE LEGACY PLAN" } };
  const legacy = await handlers.status(get());
  assert.equal((await legacy.json()).job.prompt, null);
});

test("a failed candidate reports its admitted model and moderation reason without admitting a replacement", async () => {
  const generation = fixture();
  const admitted = await generateCharacterBatch(owner, { ...request, model: "gpt_image_2_5", imageCount: 2 }, generation.dependencies);
  const { handlers, state } = apiFixture(generation);
  const jobs = [...generation.jobs.values()];
  state.job = { ...jobs[1], status: "failed", errorCode: "moderation_blocked",
    errorMessage: "400 Your request was rejected by the safety system. request-private" };
  const response = await handlers.status(new Request(`https://www.getugcpilot.com/api/characters/status?jobId=${admitted.jobs[1].jobId}`));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.job.model, "gpt_image_2_5");
  assert.equal(result.job.isTerminal, true);
  assert.equal(result.job.output, null);
  assert.match(result.job.error, /blocked this generation through content moderation/);
  assert.doesNotMatch(JSON.stringify(result), /request-private/);
  assert.equal(generation.state.reserveCalls, 1);
  assert.equal(generation.jobs.size, 2);
});

test("completed status returns only a ready owned asset and validates durable output provenance", async () => {
  const generation = fixture();
  const generated = await generateCharacterBatch(owner, request, generation.dependencies);
  const { handlers, state } = apiFixture(generation);
  const job = [...generation.jobs.values()][0];
  const asset = { id: uuid(), user_id: owner, status: "ready", collection: "image", mime_type: "image/png", source_type: "generated_image", source_record_id: job.id, url: "https://character-media.example.test/new.png", storage_key: "new.png", width: 1080, height: 1920, ratio: "9:16" };
  state.asset = asset;
  state.job = { ...job, status: "completed", output: { mediaAssetId: asset.id, url: asset.url, key: asset.storage_key, generationId: job.input.generationId, model: job.input.model, privatePrompt: "PRIVATE OUTPUT" } };
  const get = () => new Request(`https://www.getugcpilot.com/api/characters/status?jobId=${generated.jobs[0].jobId}`);
  const response = await handlers.status(get());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.job.output.mediaAssetId, asset.id);
  assert.equal(body.job.model, job.input.model);
  assert.equal(body.job.prompt, request.prompt);
  assert.equal(body.job.output.privatePrompt, undefined);
  assert.equal(state.usageCalls, 1);
  state.asset = { ...asset, user_id: "other" };
  assert.equal((await handlers.status(get())).status, 503);
  state.asset = { ...asset, source_record_id: uuid() };
  assert.equal((await handlers.status(get())).status, 503);
  state.asset = asset;
  state.job.output.url = "https://untrusted.test/fake.png";
  assert.equal((await handlers.status(get())).status, 503);
});

test("reservation failures return a safe API error without leaking storage details", async () => {
  const generation = fixture();
  generation.dependencies.reserveBatch = async () => { throw new Error("PRIVATE DATABASE FAILURE"); };
  const { handlers } = apiFixture(generation);
  const response = await handlers.generate(post(request));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("PRIVATE"), false);
  assert.equal(generation.state.reserveCalls, 0);
});
