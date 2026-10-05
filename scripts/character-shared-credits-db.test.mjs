import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Execute the real migrations locally. No hosted database or provider calls.
const source = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const functionSql = (sql, name) => {
  const start = sql.search(new RegExp(`create or replace function public\\.${name}\\s*\\(`, "iu"));
  const end = sql.indexOf("$function$;", start);
  assert.ok(start >= 0 && end > start, `Missing function ${name}`);
  return sql.slice(start, end + "$function$;".length);
};
const sharedMigration = source("20261005045851_character_shared_generation_credits.sql");
const callSql = "select * from public.character_create_reserved_generation_batch($1,$2,$3,$4,$5,'ai-generation',$6)";
const fingerprint = "a".repeat(64);
let sequence = 0;
const batchKey = () => (++sequence).toString(16).padStart(64, "0");
const inputs = (key, count) => Array.from({ length: count }, (_, index) => ({
  batchId: key, batchSize: count, candidateIndex: index + 1,
  characterSource: "ugc-pilot-characters", characterVersion: 1,
  characterRequestFingerprint: fingerprint, model: "gpt_image",
  generationId: randomUUID(), prompt: "Realistic adult creator", characterSpec: {},
  mode: "assisted", referenceCharacterId: null, referenceImageUrl: null,
}));
const create = async (db, owner, count = 1, { amount = 1, key = batchKey(), legacy = false, payload = inputs(key, count), requestFingerprint = fingerprint } = {}) => ({
  key, payload,
  rows: (await db.query(callSql, [owner, key, requestFingerprint, amount, payload, legacy])).rows,
});
const reserveOther = (db, owner, key, amount = 1, kind = "generate_image") =>
  db.query("select public.reserve_billing_credits($1,$2,$3,$4)", [owner, key, kind, amount]);
const balance = async (db, owner) => (await db.query("select used_credits,reserved_credits from free_generation_credit_balances where user_id=$1", [owner])).rows[0];
const jobCount = async (db, owner) => (await db.query("select count(*)::int n from background_jobs where user_id=$1", [owner])).rows[0].n;

async function fixture({ applyShared = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table billing_webhook_events(webhook_id text primary key,event_type text,event_timestamp timestamptz,payload jsonb,status text default 'pending',processed_at timestamptz,error_message text);
    create table billing_customers(user_id text primary key,dodo_customer_id text,email text,updated_at timestamptz);
    create table billing_subscriptions(dodo_subscription_id text primary key,user_id text,dodo_customer_id text,product_id text,plan_key text,billing_interval text,status text,current_period_start timestamptz,current_period_end timestamptz,cancel_at_period_end boolean,cancelled_at timestamptz,last_event_at timestamptz,last_webhook_id text,metadata jsonb,updated_at timestamptz);
    create table user_subscription_plans(user_id text,plan_key text,is_active boolean,source text,updated_at timestamptz);
    create table billing_credit_balances(user_id text primary key,dodo_subscription_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table complimentary_plan_grants(id uuid primary key default gen_random_uuid(),user_id text,plan_key text,revoked_at timestamptz,expires_at timestamptz,granted_at timestamptz default now());
    create table complimentary_plan_credit_balances(grant_id uuid primary key,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table background_jobs(
      id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,status text default 'queued',completed_at timestamptz,
      input_json jsonb not null,input_reference text,max_attempts int,project_id text,queue_name text,queue_provider text,queued_at timestamptz,stage text,
      created_at timestamptz default now(),updated_at timestamptz default now(),
      constraint reject_job check(input_json->>'prompt' is distinct from 'reject-job')
    );
    create unique index jobs_owner_type_key on background_jobs(coalesce(user_id,''),job_type,idempotency_key) where idempotency_key is not null;
    create table billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount int check(amount>0),credit_period_start timestamptz,complimentary_plan_grant_id uuid,status text default 'reserved',background_job_id uuid,settled_at timestamptz,updated_at timestamptz default now(),unique(user_id,idempotency_key));
    create table billing_usage_outbox(event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,generation_kind text,credit_cost int,occurred_at timestamptz);
    grant select,insert,update on billing_credit_reservations,billing_subscriptions,complimentary_plan_grants to service_role;
  `);
  const billing = source("20260910105839_add_complimentary_plan_grants.sql");
  for (const name of ["reserve_billing_credits", "settle_billing_credit_reservation", "settle_billing_from_background_job"]) {
    await db.exec(functionSql(billing, name));
  }
  await db.exec(functionSql(source("20260905123000_harden_wall_text_regeneration_recovery.sql"), "create_or_get_background_job_v1"));
  await db.exec(source("20261002192039_character_generation_batch.sql"));
  await db.exec(source("20261003045651_character_gemini_3_pro_image.sql"));
  await db.exec(source("20261003041318_character_allowance_privileges.sql"));
  await db.exec(source("20261003110411_one_time_free_generation_credits.sql"));
  await db.exec("create trigger settle_billing after update of status on background_jobs for each row execute function settle_billing_from_background_job()");
  if (applyShared) await db.exec(sharedMigration);
  return db;
}

test("two free character images reserve shared credits, replay safely, settle once and deny a third", async () => {
  const db = await fixture();
  try {
    const first = await create(db, "free-two", 2);
    assert.equal(first.rows.length, 2);
    assert.deepEqual(await balance(db, "free-two"), { used_credits: 0, reserved_credits: 2 });
    const replay = await create(db, "free-two", 2, first);
    assert.deepEqual(replay.rows.map(row => row.job.id), first.rows.map(row => row.job.id));
    await assert.rejects(create(db, "free-two"), /insufficient_billing_credits/u);
    await db.query("update background_jobs set status='completed' where user_id=$1", ["free-two"]);
    await db.query("update background_jobs set status='completed' where user_id=$1", ["free-two"]);
    assert.deepEqual(await balance(db, "free-two"), { used_credits: 2, reserved_credits: 0 });
    assert.equal((await db.query("select count(*)::int n from billing_usage_outbox")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from character_free_generation_allowances")).rows[0].n, 0);
    assert.equal((await create(db, "free-two", 2, first)).rows.length, 2);
    await assert.rejects(create(db, "free-two", 1, { key: first.key }), /idempotency_conflict/u);
  } finally { await db.close(); }
});

test("Explore images and videos consume the same budget in both directions; denied batches roll back", async () => {
  const db = await fixture();
  try {
    await reserveOther(db, "image-first", "generic-image");
    await assert.rejects(create(db, "image-first", 2), /insufficient_billing_credits/u);
    assert.equal(await jobCount(db, "image-first"), 0);
    assert.deepEqual(await balance(db, "image-first"), { used_credits: 0, reserved_credits: 1 });
    await create(db, "image-first", 1);
    await assert.rejects(reserveOther(db, "image-first", "video-after", 1, "generate_hook_video"), /insufficient_billing_credits/u);
    await reserveOther(db, "video-first", "generic-video", 2, "generate_hook_video");
    await assert.rejects(create(db, "video-first"), /insufficient_billing_credits/u);
    await create(db, "character-first", 2);
    await assert.rejects(reserveOther(db, "character-first", "generic-image"), /insufficient_billing_credits/u);
    const key = batchKey(), payload = inputs(key, 2);
    payload[1].prompt = "reject-job";
    await assert.rejects(create(db, "persist-fails", 2, { key, payload }), /reject_job/u);
    assert.equal(await jobCount(db, "persist-fails"), 0);
    assert.equal((await db.query("select count(*)::int n from billing_credit_reservations where user_id='persist-fails'")).rows[0].n, 0);
    await create(db, "persist-fails", 2);
  } finally { await db.close(); }
});

test("paid quantities use per-image cost, repeated requests respect balance, and failures refund individually", async () => {
  const db = await fixture();
  try {
    await db.exec(`
      insert into billing_subscriptions(dodo_subscription_id,user_id,plan_key,status,last_event_at) values('paid-sub','paid','starter','active',now());
      insert into billing_credit_balances values('paid','paid-sub','starter',12,0,0,now(),now()+interval '1 month',now());
      insert into billing_customers values('paid','customer',null,now());
    `);
    for (const count of [1, 2, 3]) assert.equal((await create(db, "paid", count, { amount: 2 })).rows.length, count);
    assert.equal((await db.query("select reserved_credits from billing_credit_balances where user_id='paid'")).rows[0].reserved_credits, 12);
    await assert.rejects(create(db, "paid", 1, { amount: 2 }), /insufficient_billing_credits/u);
    assert.equal(await jobCount(db, "paid"), 6);
    const job = (await db.query("select id from background_jobs where user_id='paid' limit 1")).rows[0];
    await db.query("update background_jobs set status='failed' where id=$1", [job.id]);
    await db.query("update background_jobs set status='cancelled' where id=$1", [job.id]);
    await create(db, "paid", 1, { amount: 2 });
    await db.query("update background_jobs set status='completed' where user_id='paid' and status='queued'");
    assert.equal((await db.query("select used_credits from billing_credit_balances where user_id='paid'")).rows[0].used_credits, 12);
    assert.equal((await db.query("select count(*)::int n from billing_usage_outbox")).rows[0].n, 6);
    await assert.rejects(create(db, "paid", 0), /input_invalid/u);
    await assert.rejects(create(db, "paid", 4), /input_invalid/u);
    await assert.rejects(create(db, "paid", 1, { amount: 0 }), /input_invalid/u);
  } finally { await db.close(); }
});

test("custom free images share credits, terminal failures refund once, and concurrent callers cannot overdraw", async () => {
  const db = await fixture();
  try {
    const key = batchKey(), payload = inputs(key, 1);
    payload[0].mode = "custom";
    payload[0].referenceCharacterId = randomUUID();
    payload[0].referenceImageUrl = "https://example.test/owned-reference.png";
    await create(db, "free-custom", 1, { key, payload });
    await db.query("update background_jobs set status='failed' where user_id='free-custom'");
    await db.query("update background_jobs set status='failed' where user_id='free-custom'");
    assert.deepEqual(await balance(db, "free-custom"), { used_credits: 0, reserved_credits: 0 });
    await create(db, "free-custom", 2);
    // PGlite has one connection; this exercises simultaneous callers and the
    // budget invariant, not cross-session advisory-lock contention.
    const results = await Promise.allSettled([create(db, "parallel", 2), reserveOther(db, "parallel", "generic-image")]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.ok((await balance(db, "parallel")).reserved_credits <= 2);
  } finally { await db.close(); }
});

test("old zero-cost batches replay after migration, new legacy claims are blocked and browser roles cannot call the RPC", async () => {
  const db = await fixture({ applyShared: false });
  try {
    const legacy = await create(db, "legacy", 1, { amount: 0, legacy: true });
    await db.exec(sharedMigration);
    const replay = await create(db, "legacy", 1, { ...legacy, amount: 0, legacy: true });
    assert.equal(replay.rows[0].job.id, legacy.rows[0].job.id);
    await assert.rejects(create(db, "legacy", 1, { amount: 0, legacy: true }), /legacy_allowance_unavailable/u);
    await assert.rejects(create(db, "fresh", 1, { amount: 0, legacy: true }), /legacy_allowance_unavailable/u);
    await create(db, "legacy", 2);
    const signature = "public.character_create_reserved_generation_batch(text,text,text,integer,jsonb,text,boolean)";
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') permitted", [role, signature])).rows[0].permitted, false);
    }
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'EXECUTE') permitted", [signature])).rows[0].permitted, true);
    const config = (await db.query("select proconfig from pg_proc where oid=$1::regprocedure", [signature])).rows[0].proconfig;
    assert.ok(config.some(value => value === 'search_path=""' || value === 'search_path='));
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.free_generation_credit_balances'::regclass")).rows[0].relrowsecurity, true);
    await db.exec("set role service_role");
    await create(db, "service", 2);
  } finally { await db.close(); }
});
