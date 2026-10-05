import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fixture } from "./character-shared-credits-db.test.mjs";

const sql = readFileSync(new URL("../supabase/migrations/20261005140000_character_prompt_driven_generation.sql", import.meta.url), "utf8");
const legacyCall = "select * from public.character_create_reserved_generation_batch($1,$2,$3,1,$4,'ai-generation',false)";
const call = "select * from public.character_create_reserved_generation_batch_v2($1,$2,$3,1,$4,'ai-generation',false)";
const fingerprint = "d".repeat(64);
const key = () => randomUUID().replaceAll("-", "").repeat(2);
const input = (batchId, prompt) => ({
  characterSource: "ugc-pilot-characters", characterVersion: 2, promptSource: "user",
  characterRequestFingerprint: fingerprint, batchId, batchSize: 1, candidateIndex: 1,
  generationId: randomUUID(), model: "gpt_image", mode: "custom", prompt,
  businessProfileId: null, businessProfileVersion: null,
  referenceCharacterId: null, referenceImageUrl: null,
});

test("the prompt-driven RPC preserves long descriptions and shared-credit replay semantics", async () => {
  const db = await fixture({ promptDriven: true });
  try {
    const batchId = key();
    const prompt = "Studio portrait with glamorous makeup, smooth skin, rich pink lighting.\n".repeat(300) + "Hands outside the frame.";
    const payload = [input(batchId, prompt)];
    const first = (await db.query(call, ["prompt-owner", batchId, fingerprint, payload])).rows;
    assert.equal(first[0].job.input_json.prompt, prompt);
    const replay = (await db.query(call, ["prompt-owner", batchId, fingerprint, payload])).rows;
    assert.equal(replay[0].job.id, first[0].job.id);
    assert.equal((await db.query("select count(*)::int n from billing_credit_reservations where user_id='prompt-owner'")).rows[0].n, 1);
  } finally { await db.close(); }
});

test("assisted modes, planner metadata and excessive prompt lengths are rejected without charging credits", async () => {
  const db = await fixture({ promptDriven: true });
  try {
    for (const change of [{ mode: "assisted" }, { promptSource: "planner" }, { characterSpec: {} }, { characterPlan: {} },
      { gender: "female" }, { businessProfileId: "business" }, { businessProfileVersion: 1 },
      { prompt: "x".repeat(32001) }, { characterVersion: 1, characterSpec: {} }]) {
      const batchId = key();
      await assert.rejects(db.query(call, ["invalid-owner", batchId, fingerprint, [{ ...input(batchId, "An adult creator"), ...change }]]), /character_generation_input_invalid/u);
    }
    assert.equal((await db.query("select count(*)::int n from background_jobs where user_id='invalid-owner'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from billing_credit_reservations where user_id='invalid-owner'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test("already-admitted v1 jobs remain recoverable after the prompt-driven migration", async () => {
  const db = await fixture();
  try {
    const batchId = key();
    const legacy = { ...input(batchId, "Historical generated prompt"), characterVersion: 1, characterSpec: {}, mode: "assisted" };
    delete legacy.promptSource;
    const first = (await db.query(legacyCall, ["legacy-owner", batchId, fingerprint, [legacy]])).rows;
    await db.exec(sql);
    const replay = (await db.query(call, ["legacy-owner", batchId, fingerprint, [legacy]])).rows;
    assert.equal(replay[0].job.id, first[0].job.id);
    const newKey = key();
    await assert.rejects(db.query(call, ["legacy-owner", newKey, fingerprint, [{ ...legacy, batchId: newKey }]]), /character_generation_input_invalid/u);
  } finally { await db.close(); }
});


test("versioned rollout preserves the old reservation RPC and restricts v2 to service role", async () => {
  const db = await fixture();
  try {
    const signature = "public.character_create_reserved_generation_batch(text,text,text,integer,jsonb,text,boolean)";
    const before = (await db.query("select pg_get_functiondef($1::regprocedure) definition", [signature])).rows[0].definition;
    await db.exec(sql);
    const after = (await db.query("select pg_get_functiondef($1::regprocedure) definition", [signature])).rows[0].definition;
    assert.equal(after, before);
    const v2 = "public.character_create_reserved_generation_batch_v2(text,text,text,integer,jsonb,text,boolean)";
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed", [role,v2])).rows[0].allowed, false);
    }
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed", [v2])).rows[0].allowed, true);
  } finally { await db.close(); }
});
