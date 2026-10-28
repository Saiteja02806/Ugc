import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const owner = "library-owner";
process.env.SUPABASE_URL = "https://identity-list-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
mock.module("../jobs/background-jobs.ts", { namedExports: { getBackgroundJobForUser: async () => { throw new Error("Unexpected per-image job request"); } } });
mock.module("../media/media-storage.ts", { namedExports: { getMediaAssetForOwner: async () => null } });
mock.module("../storage/storage.ts", { namedExports: { isTrustedStorageUrl: () => true } });
mock.module("../supabase/gateway-retry-fetch.ts", { namedExports: { gatewayRetryFetch: (...args) => fetch(...args) } });
const { listCharactersForUser } = await import("./identity.ts");

let calls, records, databaseError;
function fixture(index) {
  const jobId = `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`;
  const assetId = `${String(index).padStart(8, "0")}-2222-4222-8222-222222222222`;
  const generationId = `generation-${index}`, url = `https://media.example.test/${generationId}.png`, key = `images/generated/${owner}/${generationId}.png`;
  const createdAt = "2026-10-12T12:00:00.000Z";
  return {
    job: { id: jobId, user_id: owner, job_type: "generate_image", status: "completed", created_at: createdAt,
      input_json: { characterSource: "ugc-pilot-characters", characterVersion: 2, prompt: `Presenter ${index}`,
        promptSource: "user", mode: "custom", model: "gpt_image", generationId, candidateIndex: 1,
        businessProfileId: null, businessProfileVersion: null },
      output_json: { mediaAssetId: assetId, url, key, model: "gpt_image", generationId }, output_reference: `generationId:${generationId}` },
    asset: { id: assetId, user_id: owner, source_record_id: jobId, source_type: "generated_image", status: "ready",
      deleted_at: null, collection: "influencer", mime_type: "image/png", storage_key: key, url,
      title: "My AI influencer", created_at: createdAt, updated_at: createdAt,
      metadata: { characterIdentity: { source: "ugc-pilot-characters", version: 1, jobId, selectedAt: createdAt, automatic: true } } },
  };
}

beforeEach(() => {
  calls = []; records = Array.from({ length: 123 }, (_, index) => fixture(123 - index)); databaseError = false;
  mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.href); calls.push(url);
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    if (url.pathname.endsWith("media_assets")) {
      assert.equal(url.searchParams.get("collection"), "eq.influencer");
      assert.equal(url.searchParams.get("source_type"), "eq.generated_image");
      assert.equal(url.searchParams.get("status"), "eq.ready");
      assert.equal(url.searchParams.get("deleted_at"), "is.null");
      assert.equal(url.searchParams.get("metadata"), 'cs.{"characterIdentity":{"source":"ugc-pilot-characters","version":1}}');
      assert.equal(url.searchParams.get("order"), "updated_at.desc,id.desc");
      const offset = Number(url.searchParams.get("offset")), limit = Number(url.searchParams.get("limit"));
      return Response.json(records.slice(offset, offset + limit).map(record => record.asset));
    }
    assert.ok(url.pathname.endsWith("background_jobs"));
    assert.equal(url.searchParams.get("job_type"), "eq.generate_image");
    assert.equal(url.searchParams.get("status"), "eq.completed");
    assert.equal(url.searchParams.get("input_json"), 'cs.{"characterSource":"ugc-pilot-characters"}');
    assert.ok(url.searchParams.get("id").startsWith("in.("));
    if (databaseError) return Response.json({ message: "fixture job query failed" }, { status: 400 });
    const ids = url.searchParams.get("id").slice(4, -1).split(",");
    assert.ok(ids.length <= 100);
    return Response.json(records.filter(record => ids.includes(record.job.id)).map(record => record.job));
  });
});
afterEach(() => mock.restoreAll());

test("My influencers returns all saved generations beyond 100 using bounded asset pages and bulk provenance", async () => {
  const result = await listCharactersForUser(owner);
  assert.equal(result.length, 123);
  assert.deepEqual(result.map(character => character.id), records.map(record => record.asset.id));
  assert.equal(calls.length, 4);
  assert.equal(calls.filter(url => url.pathname.endsWith("background_jobs")).length, 2);
  assert.ok(result.every(character => Object.keys(character).length === 7));
  assert.deepEqual(result.map(character => character.prompt), records.map(record => record.job.input_json.prompt));
});

test("an empty influencer library does not request background jobs", async () => {
  records = [];
  assert.deepEqual(await listCharactersForUser(owner), []);
  assert.equal(calls.length, 1);
});

test("saved prompts come from each verified source job, including frozen Skill instructions", async () => {
  records = [fixture(1), fixture(2)];
  records[0].job.input_json.prompt = "User portrait\nreduce face glow, normal human skin texture";
  records[0].job.input_json.characterPromptPresentation = { userPrompt: "User portrait", skills: [{ id: "realistic-skin", name: "Realistic Skin", instruction: "reduce face glow, normal human skin texture" }] };
  const result = await listCharactersForUser(owner);
  assert.equal(result[0].prompt, records[0].job.input_json.prompt);
  assert.equal(result[1].prompt, "Presenter 2");
  assert.equal(result[0].name, "My AI influencer");
  assert.equal(calls.length, 2, "prompts reuse the existing bulk source-job read");
});

test("bulk provenance continues to reject foreign and mismatched outputs and surfaces database errors", async () => {
  records = [fixture(1), fixture(2), fixture(3)];
  records[1].job.user_id = "foreign-owner";
  records[2].job.output_json.url = "https://foreign.example.test/image.png";
  assert.deepEqual((await listCharactersForUser(owner)).map(character => character.id), [records[0].asset.id]);
  databaseError = true;
  await assert.rejects(listCharactersForUser(owner), /Could not load saved character references/);
});
