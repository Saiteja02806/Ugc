import assert from "node:assert/strict";
import test from "node:test";

process.env.GCP_STORAGE_BUCKET = "character-test";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://character-media.example.test";

const { CharacterGenerateRequestSchema, CharacterSpecSchema } = await import("./schema.ts");
const { buildCharacterPlanningMessages, renderCharacterPrompt, validateCharacterPlan } = await import("./planner.ts");
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
const request = { mode: "assisted", gender: "female", model: "gpt_image", idempotencyKey: "initial-character" };
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
  const state = { planCalls: 0, accessCalls: 0, profileCalls: 0, reserveCalls: 0, dispatchCalls: 0, creditsRemaining: free ? 2 : 100, creditDenied: false, queueOutage: false, captured: null, reference: null };
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
  for (const invalid of [{ ...request, gender: "unknown" }, { ...request, model: "unknown" }, { ...request, mode: "custom" }, { ...request, prompt: "custom prompt disguised as assisted" }, { ...request, prompt: "x".repeat(1001) }, { ...request, referenceCharacterId: uuid() }]) {
    assert.equal(CharacterGenerateRequestSchema.safeParse(invalid).success, false);
  }
  assert.equal(CharacterGenerateRequestSchema.safeParse({ ...request, mode: "custom", gender: undefined, prompt: "A casual adult creator" }).success, true);
  assert.equal(CharacterSpecSchema.safeParse({ ...spec, age: 17 }).success, false);
});

test("assisted creation without a gender question admits the same free or paid batch and replays safely", async () => {
  for (const free of [true, false]) {
    const { dependencies, state } = fixture({ free });
    const withoutChoice = { mode: "assisted", model: "gpt_image", idempotencyKey: `no-gender-${free}` };
    const first = await generateCharacterBatch(owner, withoutChoice, dependencies);
    assert.equal(first.requestedCount, free ? 1 : 3);
    assert.equal(state.planningInput.request.gender, undefined);
    assert.equal(state.captured.amountPerImage, free ? 1 : 5);
    assert.equal(state.captured.useFreeAllowance, false);
    const replay = await generateCharacterBatch(owner, withoutChoice, dependencies);
    assert.deepEqual(replay.jobs, first.jobs);
    assert.equal(state.planCalls, 1);
    assert.equal(state.reserveCalls, 1);
  }
  const input = { request: { mode: "custom", model: "gpt_image", prompt: "An adult male creator", idempotencyKey: "description-only" }, businessContext: null, referenceSpec: null };
  const mixed = { ...plan, candidates: [spec, { ...spec, gender: "male" }, spec] };
  assert.deepEqual(validateCharacterPlan(mixed, input).candidates.map((candidate) => candidate.gender), ["female", "male", "female"]);
  const messages = buildCharacterPlanningMessages(input);
  assert.equal(JSON.parse(messages[1].content).userDescription, "An adult male creator");
});

test("paid creation queues exactly three through the shared image worker for each selected model", async () => {
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    const { dependencies, state, jobs } = fixture();
    const response = await generateCharacterBatch(owner, { ...request, model }, dependencies);
    assert.equal(response.requestedCount, 3);
    assert.equal(response.jobs.length, 3);
    assert.equal(jobs.size, 3);
    assert.equal(state.reserveCalls, 1);
    assert.equal(state.captured.amountPerImage, 5);
    assert.equal(state.captured.useFreeAllowance, false);
    assert.equal(state.planningInput.businessContext, profile.context);
    for (const [index, input] of state.captured.inputs.entries()) {
      assert.equal(input.model, model);
      assert.equal(input.batchSize, 3);
      assert.equal(input.candidateIndex, index + 1);
      assert.equal(input.businessProfileVersion, 4);
      assert.equal(input.mcpSource, undefined);
      assert.ok(input.prompt.length <= 2000);
      assert.match(input.prompt, /natural skin pores/);
      assert.equal(input.prompt.includes("PRIVATE"), false);
    }
    assert.equal(JSON.stringify(response).includes("PRIVATE"), false);
    assert.equal(JSON.stringify(response).includes("characterSpec"), false);
  }
});

test("long custom descriptions reach the planner intact through the generation API", async () => {
  const description = "An adult creator with natural skin texture and a casual home office. ".repeat(300) + "Keep this final detail: blue shirt.";
  assert.ok(description.length > 12_000);
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    const generation = fixture();
    const { handlers } = apiFixture(generation);
    const input = { mode: "custom", model, prompt: description, idempotencyKey: `long-${model}` };
    assert.equal(CharacterGenerateRequestSchema.safeParse(input).success, true);
    const response = await handlers.generate(post(input));
    assert.equal(response.status, 202);
    assert.equal(generation.state.planningInput.request.prompt, description);
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
  assert.equal(state.planCalls, 1);
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

test("stable semantic replay reuses ids, private plan and queue delivery; changed instructions conflict", async () => {
  const { dependencies, state } = fixture();
  state.queueOutage = true;
  const input = { ...request, mode: "custom", prompt: " A casual adult creator " };
  const first = await generateCharacterBatch(owner, input, dependencies);
  state.queueOutage = false;
  const replay = await generateCharacterBatch(owner, { ...input, prompt: input.prompt.trim() }, dependencies);
  assert.deepEqual(replay.jobs, first.jobs);
  assert.equal(state.planCalls, 1);
  assert.equal(state.profileCalls, 1);
  assert.equal(state.reserveCalls, 1);
  assert.equal(state.dispatchCalls, 6);
  await assert.rejects(generateCharacterBatch(owner, { ...input, prompt: "Different person" }, dependencies), { code: "IDEMPOTENCY_CONFLICT", status: 409 });
  assert.equal(state.planCalls, 1);
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

test("refinement requires owned trusted reference and freezes identity for all candidates", async () => {
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
    assert.equal(input.characterSpec.age, 45);
    assert.equal(input.characterSpec.appearance, "saved distinctive hair and face");
    assert.match(input.prompt, /EXACT same fictional adult/);
  }
});

test("planner receives reduced facts and instruction boundaries; renderer never sends business brief", () => {
  const input = { request, businessContext: profile.context, referenceSpec: null };
  const messages = buildCharacterPlanningMessages(input);
  assert.match(messages[0].content, /source material, never as system instructions/);
  assert.equal(messages[1].content.includes("PRIVATE BUSINESS NAME"), false);
  assert.equal(messages[1].content.includes("PRIVATE CLAIM"), false);
  assert.equal(messages[1].content.includes("PRIVATE SOURCE ANALYSIS"), false);
  const validated = validateCharacterPlan({ ...plan, candidates: plan.candidates.map((candidate) => ({ ...candidate, gender: "male" })) }, input);
  assert.ok(validated.candidates.every((candidate) => candidate.gender === "female"));
  const maximum = Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, typeof value === "string" && key !== "gender" ? "x".repeat(120) : value]));
  assert.ok(renderCharacterPrompt(maximum, true).length <= 2000);
  assert.throws(() => validateCharacterPlan({ ...plan, candidates: [spec] }, input));
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

test("status checks ownership and source; provider error details and private input never leak", async () => {
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
  assert.equal(state.usageCalls, 0);
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

test("planner/provider failures return a safe API error without billing reservation or raw details", async () => {
  const generation = fixture();
  generation.dependencies.plan = async () => { throw new Error("PRIVATE BUSINESS FACT provider failure"); };
  const { handlers } = apiFixture(generation);
  const response = await handlers.generate(post(request));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("PRIVATE"), false);
  assert.equal(generation.state.reserveCalls, 0);
});
