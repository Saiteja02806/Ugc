import assert from "node:assert/strict";
import test from "node:test";

import type { MediaAssetRow } from "../media/media-storage.ts";
import {
  CHARACTER_SOURCE,
  CharacterIdentityError,
  CharacterSelectionRequestSchema,
  createCharacterIdentityService,
  type CharacterIdentityStore,
  type CharacterSourceJob,
} from "./identity-service.ts";

const USER_ID = "verified-firebase-owner";
const JOB_ID = "b2222222-2222-4222-8222-222222222222";
const ASSET_ID = "a1111111-1111-4111-8111-111111111111";
const GENERATION_ID = "c3333333-3333-4333-8333-333333333333";
const KEY = `images/generated/${USER_ID}/characters/${GENERATION_ID}.png`;
const URL = `https://media.example.com/${KEY}`;

function fixture() {
  const job: CharacterSourceJob = {
    id: JOB_ID,
    userId: USER_ID,
    jobType: "generate_image",
    status: "completed",
    input: {
      characterSource: CHARACTER_SOURCE,
      characterVersion: 1,
      generationId: GENERATION_ID,
      gender: "female",
      model: "gpt_image",
      businessProfileId: "private-business-profile",
      businessProfileVersion: 7,
      candidateIndex: 1,
      characterPlan: { creativeBrief: "Private audience/business brief." },
      prompt: "Private image generation prompt.",
      characterSpec: {
        creatorType: "An approachable productivity creator",
        gender: "female",
        age: 29,
        appearance: "Brown wavy hair, natural facial features and natural skin texture",
        wardrobe: "A simple charcoal cotton shirt",
        environment: "A lived-in home office with a wooden desk",
        expression: "A relaxed, welcoming smile",
        framing: "Vertical smartphone portrait, face and upper torso clearly visible",
        lighting: "Soft daylight from a nearby window",
      },
    },
    output: { generationId: GENERATION_ID, key: KEY, url: URL, model: "gpt_image", provider: "openai" },
    // The real worker uses a stable, prefixed generation ID, not the storage key.
    outputReference: `generationId:${GENERATION_ID}`,
  };
  let asset: MediaAssetRow = {
    id: ASSET_ID,
    user_id: USER_ID,
    project_id: "characters",
    collection: "image",
    source_type: "generated_image",
    source_record_id: JOB_ID,
    parent_asset_id: null,
    title: "Generated image",
    storage_key: KEY,
    url: URL,
    thumbnail_url: URL,
    mime_type: "image/png",
    file_name: null,
    file_size_bytes: null,
    duration_seconds: null,
    width: 1024,
    height: 1536,
    ratio: "9:16",
    status: "ready",
    metadata: { backgroundJobId: JOB_ID, provider: "openai" },
    deleted_at: null,
    created_at: "2026-10-02T12:00:00.000Z",
    updated_at: "2026-10-02T12:00:00.000Z",
  };
  let promotions = 0;
  const store: CharacterIdentityStore = {
    getJob: async () => structuredClone(job),
    getAsset: async () => structuredClone(asset),
    getCandidateAsset: async () => structuredClone(asset),
    listSelectedAssets: async () => [structuredClone(asset)],
    promoteCandidate: async (input) => {
      if (asset.collection !== "image" || input.asset.updated_at !== asset.updated_at) return false;
      promotions += 1;
      asset = {
        ...asset,
        title: input.name,
        collection: "influencer",
        metadata: { ...(asset.metadata as object), characterIdentity: input.marker },
        updated_at: input.marker.selectedAt,
      };
      return true;
    },
  };
  return {
    job,
    store,
    service: createCharacterIdentityService(store),
    asset: () => asset,
    mutateAsset: (changes: Partial<MediaAssetRow>) => { Object.assign(asset, changes); },
    promotions: () => promotions,
  };
}

function expectIdentityError(status: number) {
  return (error: unknown) => error instanceof CharacterIdentityError && error.status === status;
}

test("Google model identities remain selectable, restorable and usable as references", async () => {
  for (const model of ["gemini_3_pro", "nano_banana_2"]) {
    const f = fixture();
    f.job.input = { ...(f.job.input as object), model };
    f.job.output = { ...(f.job.output as object), model, provider: "gemini" };
    f.mutateAsset({ metadata: { backgroundJobId: JOB_ID, provider: "gemini" } });
    const saved = await f.service.select({ jobId: JOB_ID, userId: USER_ID });
    assert.equal(saved.model, model);
    assert.equal(saved.id, ASSET_ID);
    const restored = await f.service.get(ASSET_ID, USER_ID);
    assert.equal(restored?.model, model);
    assert.equal(restored?.referenceImageUrl, URL);
  }
});

test("prompt-driven characters can be saved, restored and listed without invented identity details", async () => {
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    const f = fixture();
    const prompt = "An adult presenter in a bright studio, wearing a green shirt.";
    f.job.input = {
      characterSource: CHARACTER_SOURCE, characterVersion: 2,
      mode: "custom", promptSource: "user", prompt, model,
      generationId: GENERATION_ID, candidateIndex: 1,
      businessProfileId: null, businessProfileVersion: null,
    };
    f.job.output = { ...(f.job.output as object), model };
    const saved = await f.service.select({ jobId: JOB_ID, userId: USER_ID });
    assert.equal(saved.gender, null);
    assert.equal(saved.model, model);
    const trusted = await f.service.get(ASSET_ID, USER_ID);
    assert.equal(trusted?.userPrompt, prompt);
    assert.equal(trusted?.characterSpec, null);
    assert.equal(trusted?.businessProfileId, null);
    assert.equal(trusted?.referenceImageUrl, URL);
    assert.deepEqual(await f.service.list(USER_ID), [saved]);
    assert.equal("userPrompt" in saved, false);
  }
});

test("prompt-driven provenance rejects planner additions and missing user prompts", async () => {
  for (const change of [{ mode: "assisted" }, { promptSource: "planner" }, { prompt: "" },
    { characterSpec: {} }, { characterPlan: {} }, { gender: "female" }, { businessProfileId: "business" }]) {
    const f = fixture();
    f.job.input = {
      characterSource: CHARACTER_SOURCE, characterVersion: 2,
      mode: "custom", promptSource: "user", prompt: "An adult presenter", model: "gpt_image",
      generationId: GENERATION_ID, candidateIndex: 1,
      businessProfileId: null, businessProfileVersion: null, ...change,
    };
    await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(400));
    assert.equal(f.promotions(), 0);
  }
});

test("select saves one durable identity using the original reference asset and private job snapshot", async () => {
  const f = fixture();
  const character = await f.service.select({ jobId: JOB_ID, userId: USER_ID, name: "  Maya  " });
  assert.deepEqual(Object.keys(character).sort(), ["createdAt", "gender", "id", "model", "name", "url"]);
  assert.equal(character.id, ASSET_ID);
  assert.equal(character.name, "Maya");
  assert.equal(character.url, URL);
  assert.equal(f.asset().collection, "influencer");
  assert.equal(f.asset().storage_key, KEY);
  assert.equal(f.promotions(), 1);
  const trusted = await f.service.get(character.id, USER_ID);
  assert.equal(trusted?.userId, USER_ID);
  assert.equal(trusted?.referenceMediaAssetId, ASSET_ID);
  assert.equal(trusted?.referenceImageUrl, URL);
  assert.equal(trusted?.referenceStorageKey, KEY);
  assert.equal(trusted?.businessProfileId, "private-business-profile");
  assert.equal(trusted?.businessProfileVersion, 7);
  assert.equal(trusted?.characterSpec?.age, 29);
  const publicText = JSON.stringify(character);
  const mediaMetadata = JSON.stringify(f.asset().metadata);
  for (const privateValue of ["private-business-profile", "Private audience/business brief", "Private image generation prompt", "Brown wavy hair"]) {
    assert.ok(!publicText.includes(privateValue));
    assert.ok(!mediaMetadata.includes(privateValue));
  }
});

test("repeated and simultaneous selection retains the first name and creates no duplicate", async () => {
  const f = fixture();
  const results = await Promise.all([
    f.service.select({ jobId: JOB_ID, userId: USER_ID, name: "First name" }),
    f.service.select({ jobId: JOB_ID, userId: USER_ID, name: "Second name" }),
  ]);
  assert.deepEqual(results[0], results[1]);
  const again = await f.service.select({ jobId: JOB_ID, userId: USER_ID, name: "Third name" });
  assert.deepEqual(again, results[0]);
  assert.equal(f.promotions(), 1);
  assert.equal((await f.service.list(USER_ID)).length, 1);
});

test("ownership is enforced on both source job and media asset even if a store returns foreign rows", async () => {
  for (const foreign of ["job", "asset"] as const) {
    const f = fixture();
    if (foreign === "job") f.job.userId = "another-user";
    else f.mutateAsset({ user_id: "another-user" });
    await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(404));
    assert.equal(f.promotions(), 0);
  }
});

test("generic image jobs and malformed or inconsistent character provenance cannot become characters", async () => {
  const changes = [
    { characterSource: "ai-studio" },
    { characterVersion: 2 },
    { characterSpec: { age: 12, gender: "female" } },
    { gender: "male" },
    { businessProfileVersion: null },
    { candidateIndex: 4 },
    { model: "unsupported" },
  ];
  for (const change of changes) {
    const f = fixture();
    f.job.input = { ...(f.job.input as object), ...change };
    await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(400));
    assert.equal(f.promotions(), 0);
  }
  const f = fixture();
  f.job.jobType = "generate_avatar";
  await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(400));
});

test("unfinished jobs, failed or deleted media, and output mismatch cannot be selected", async () => {
  for (const status of ["queued", "processing", "failed", "cancelled"] as const) {
    const f = fixture();
    f.job.status = status;
    await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(409));
    assert.equal(f.promotions(), 0);
  }
  const changes: Partial<MediaAssetRow>[] = [
    { status: "failed" },
    { deleted_at: "2026-10-02T12:01:00.000Z" },
    { source_type: "upload" },
    { source_record_id: "different-job" },
    { url: "https://attacker.example.com/reference.png" },
    { storage_key: "untrusted/reference.png" },
    { mime_type: "video/mp4" },
  ];
  for (const change of changes) {
    const f = fixture();
    f.mutateAsset(change);
    await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(409));
    assert.equal(f.promotions(), 0);
  }
  const f = fixture();
  f.job.output = { ...(f.job.output as object), generationId: "different-generation" };
  await assert.rejects(f.service.select({ jobId: JOB_ID, userId: USER_ID }), expectIdentityError(409));
});

test("client selection body rejects untrusted URLs, specs, owner IDs and blank or excessive names", () => {
  for (const extra of [{ url: URL }, { userId: USER_ID }, { characterSpec: {} }, { model: "gpt_image" }]) {
    assert.equal(CharacterSelectionRequestSchema.safeParse({ jobId: JOB_ID, ...extra }).success, false);
  }
  assert.equal(CharacterSelectionRequestSchema.safeParse({ jobId: JOB_ID, name: " " }).success, false);
  assert.equal(CharacterSelectionRequestSchema.safeParse({ jobId: JOB_ID, name: "x".repeat(81) }).success, false);
  assert.equal(CharacterSelectionRequestSchema.safeParse({ jobId: "not-a-uuid" }).success, false);
});

test("only selected owned characters appear in list and are usable for trusted refinement", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.list(USER_ID), []);
  assert.equal(await f.service.get(ASSET_ID, USER_ID), null);
  const character = await f.service.select({ jobId: JOB_ID, userId: USER_ID });
  const valid = structuredClone(f.asset());
  f.store.listSelectedAssets = async () => [
    valid,
    { ...valid, user_id: "foreign-owner" },
    { ...valid, metadata: {} },
    { ...valid, collection: "image" },
    { ...valid, metadata: { characterIdentity: { source: CHARACTER_SOURCE, version: 1, jobId: "wrong-job", selectedAt: character.createdAt } } },
  ];
  assert.deepEqual(await f.service.list(USER_ID), [character]);
  assert.equal(await f.service.get(ASSET_ID, "foreign-owner"), null);
  assert.equal(await f.service.get("invalid-id", USER_ID), null);
  f.job.status = "failed";
  assert.equal(await f.service.get(ASSET_ID, USER_ID), null);
  assert.deepEqual(await f.service.list(USER_ID), []);
});

test("database faults remain visible instead of silently dropping selected identities", async () => {
  const f = fixture();
  await f.service.select({ jobId: JOB_ID, userId: USER_ID });
  const failure = new Error("database gateway unavailable");
  f.store.getJob = async () => { throw failure; };
  await assert.rejects(f.service.get(ASSET_ID, USER_ID), (error) => error === failure);
  await assert.rejects(f.service.list(USER_ID), (error) => error === failure);
});
