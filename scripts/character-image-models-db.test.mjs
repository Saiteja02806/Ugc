import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fixture } from "./character-shared-credits-db.test.mjs";

// Apply the real additive migration to isolated Postgres. No hosted data or providers.
const sql = readFileSync(new URL("../supabase/migrations/20261009093932_character_seedream_sunburst_models.sql", import.meta.url), "utf8");
const signature = "public.character_create_reserved_generation_batch_v2(text,text,text,integer,jsonb,text,boolean)";
const call = "select * from public.character_create_reserved_generation_batch_v2($1,$2,$3,1,$4,'ai-generation',false)";
const fingerprint = "e".repeat(64);
const key = () => randomUUID().replaceAll("-", "").repeat(2);
const input = (batchId, model, prompt = "An adult presenter with natural skin texture") => ({
  characterSource: "ugc-pilot-characters", characterVersion: 2, promptSource: "user",
  characterRequestFingerprint: fingerprint, batchId, batchSize: 1, candidateIndex: 1,
  generationId: randomUUID(), model, mode: "custom", prompt,
  businessProfileId: null, businessProfileVersion: null, referenceCharacterId: null, referenceImageUrl: null,
});

test("the additive migration admits every influencer model and replays new models without another charge", async () => {
  const db = await fixture({ promptDriven: true });
  try {
    await db.exec(sql);
    for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
      const batchId = key(), owner = `model-${model}`, payload = [input(batchId, model)];
      const first = (await db.query(call, [owner, batchId, fingerprint, payload])).rows;
      assert.equal(first[0].job.input_json.model, model);
      const replay = (await db.query(call, [owner, batchId, fingerprint, payload])).rows;
      assert.equal(replay[0].job.id, first[0].job.id);
      assert.equal(replay[0].created, false);
      assert.equal((await db.query("select count(*)::int n from billing_credit_reservations where user_id=$1", [owner])).rows[0].n, 1);
    }
  } finally { await db.close(); }
});

test("Seedream limits and unknown models fail atomically while Sunburst retains long descriptions", async () => {
  const db = await fixture({ promptDriven: true });
  try {
    await db.exec(sql);
    for (const [model, prompt] of [["seedream_5_pro", "x".repeat(4001)], ["unknown", "A creator"], ["gpt_image_2_5", "x".repeat(32001)]]) {
      const batchId = key();
      await assert.rejects(db.query(call, ["rejected-owner", batchId, fingerprint, [input(batchId, model, prompt)]]), /character_generation_input_invalid/);
    }
    assert.equal((await db.query("select count(*)::int n from background_jobs where user_id='rejected-owner'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from billing_credit_reservations where user_id='rejected-owner'")).rows[0].n, 0);
    for (const [model, length] of [["seedream_5_pro", 4000], ["gpt_image_2_5", 32000]]) {
      const batchId = key(), prompt = "x".repeat(length);
      const result = (await db.query(call, [`limit-${model}`, batchId, fingerprint, [input(batchId, model, prompt)]])).rows;
      assert.equal(result[0].job.input_json.prompt, prompt);
    }
  } finally { await db.close(); }
});

test("rollout preserves admitted old jobs, rejects legacy creation and retains service-role-only access", async () => {
  const db = await fixture({ promptDriven: true });
  try {
    const batchId = key(), payload = [input(batchId, "gpt_image")];
    const first = (await db.query(call, ["existing-owner", batchId, fingerprint, payload])).rows;
    const legacySignature = "public.character_create_reserved_generation_batch(text,text,text,integer,jsonb,text,boolean)";
    const before = (await db.query("select pg_get_functiondef($1::regprocedure) definition", [legacySignature])).rows[0].definition;
    await db.exec(sql);
    const replay = (await db.query(call, ["existing-owner", batchId, fingerprint, payload])).rows;
    assert.equal(replay[0].job.id, first[0].job.id);
    assert.equal((await db.query("select pg_get_functiondef($1::regprocedure) definition", [legacySignature])).rows[0].definition, before);
    const legacyKey = key();
    await assert.rejects(db.query(call, ["legacy-owner", legacyKey, fingerprint, [{ ...input(legacyKey, "gpt_image"), characterVersion: 1, characterSpec: {} }]]), /character_generation_input_invalid/);
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed", [role, signature])).rows[0].allowed, false);
    }
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed", [signature])).rows[0].allowed, true);
  } finally { await db.close(); }
});
