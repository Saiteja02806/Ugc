import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

// Exercise the real reservation/job functions in a disposable PostgreSQL
// runtime. This does not connect to Supabase or submit image-provider requests.
function functionSql(source, name) {
  const start = source.search(new RegExp(`create or replace function public\\.${name}\\s*\\(`, "i"));
  assert.ok(start >= 0, `${name} must exist in its current migration`);
  const end = source.indexOf("$function$;", start);
  assert.ok(end > start, `${name} must have a complete body`);
  return source.slice(start, end + "$function$;".length);
}

const source = async (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const jobMigration = await source("20260905123000_harden_wall_text_regeneration_recovery.sql");
const billingMigration = await source("20260910105839_add_complimentary_plan_grants.sql");
const characterMigration = await source("20261002192039_character_generation_batch.sql");
assert.ok(characterMigration.trim(), "Character generation migration must be saved before running its tests.");

const db = new PGlite();
const fingerprint = "a".repeat(64);
const callSql = "select * from public.character_create_reserved_generation_batch($1,$2,$3,$4,$5,$6,$7)";
let nextBatch = 0;
const batchKey = () => (++nextBatch).toString(16).padStart(64, "0");
const spec = {
  creatorType: "Approachable productivity creator", gender: "female", age: 29,
  appearance: "Shoulder-length brown hair and natural skin texture", wardrobe: "Casual blue cotton shirt",
  environment: "Home office by a window", expression: "Relaxed conversational smile",
  framing: "Eye-level smartphone portrait", lighting: "Soft natural daylight",
};

function inputs(key, count = 3, options = {}) {
  return Array.from({ length: count }, (_, index) => ({
    aspectRatio: "9:16", batchId: key, batchIndex: index + 1, batchSize: count,
    businessProfileId: randomUUID(), businessProfileVersion: 1, candidateIndex: index + 1,
    characterSource: "ugc-pilot-characters", characterVersion: 1,
    characterRequestFingerprint: fingerprint,
    characterPlan: { schemaVersion: 1, creativeBrief: "An approachable creator in an everyday home office.", candidates: [spec, spec, spec] },
    characterSpec: spec, generationId: randomUUID(), gender: "female", mode: "assisted", model: "gpt_image",
    prompt: "A realistic fictional adult social media creator.", referenceCharacterId: null, referenceImageUrl: null,
    ...options,
  }));
}

async function create({ owner, key = batchKey(), count = 3, amount = 1, free = false, overrides, requestFingerprint = fingerprint, queue = "ai-generation" }) {
  const payload = inputs(key, count, { ...overrides, characterRequestFingerprint: requestFingerprint });
  return {
    key, payload,
    result: (await db.query(callSql, [owner, key, requestFingerprint, amount, payload, queue, free])).rows,
  };
}

async function paid(owner, limit = 10) {
  await db.query("insert into public.billing_subscriptions(user_id,status,plan_key,dodo_subscription_id) values($1,'active','starter',$2)", [owner, `subscription-${owner}`]);
  await db.query("insert into public.billing_credit_balances(user_id,dodo_subscription_id,credit_limit,period_start,period_end) values($1,$2,$3,now() - interval '1 day',now() + interval '29 days')", [owner, `subscription-${owner}`, limit]);
}

async function state(owner) {
  return (await db.query(`select
    (select count(*)::int from public.background_jobs where user_id=$1) as jobs,
    (select count(*)::int from public.billing_credit_reservations where user_id=$1) as reservations,
    (select count(*)::int from public.character_free_generation_allowances where user_id=$1) as allowances,
    (select reserved_credits from public.billing_credit_balances where user_id=$1) as reserved`, [owner])).rows[0];
}

async function jobs(owner) {
  return (await db.query("select * from public.background_jobs where user_id=$1 order by input_json->>'candidateIndex'", [owner])).rows;
}

async function check(name, body) {
  await body();
  console.log(`PASS ${name}`);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.background_jobs (
      id uuid primary key default gen_random_uuid(), user_id text, idempotency_key text,
      job_type text not null, input_json jsonb not null, input_reference text,
      max_attempts integer not null, project_id text, queue_name text not null,
      queue_provider text not null, queued_at timestamptz, stage text, status text not null,
      completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint background_jobs_reject_prompt_check check(input_json->>'prompt' is distinct from 'reject-job')
    );
    create unique index background_jobs_owner_type_idempotency_uidx
      on public.background_jobs(coalesce(user_id,''),job_type,idempotency_key) where idempotency_key is not null;
    create table public.billing_credit_reservations (
      id uuid primary key default gen_random_uuid(), user_id text not null, idempotency_key text not null,
      job_type text not null, amount integer not null check(amount > 0), status text not null default 'reserved',
      credit_period_start timestamptz not null, complimentary_plan_grant_id uuid,
      background_job_id uuid references public.background_jobs(id), settled_at timestamptz,
      updated_at timestamptz not null default now(), unique(user_id,idempotency_key)
    );
    create table public.billing_subscriptions (
      user_id text not null, status text not null, plan_key text not null,
      dodo_subscription_id text, last_event_at timestamptz not null default now()
    );
    create table public.billing_credit_balances (
      user_id text primary key, dodo_subscription_id text, credit_limit integer not null,
      used_credits integer not null default 0, reserved_credits integer not null default 0,
      period_start timestamptz not null, period_end timestamptz not null, updated_at timestamptz not null default now()
    );
    create table public.complimentary_plan_grants (
      id uuid primary key default gen_random_uuid(), user_id text not null, plan_key text not null,
      revoked_at timestamptz, expires_at timestamptz, granted_at timestamptz not null default now()
    );
    create table public.complimentary_plan_credit_balances (
      grant_id uuid primary key, user_id text not null, credit_limit integer not null,
      used_credits integer not null default 0, reserved_credits integer not null default 0,
      period_start timestamptz not null, period_end timestamptz not null, updated_at timestamptz not null default now()
    );
    create table public.billing_customers(user_id text primary key,dodo_customer_id text);
    create table public.billing_usage_outbox(
      event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,
      generation_kind text,credit_cost integer,occurred_at timestamptz
    );
    grant select on public.background_jobs,public.billing_credit_reservations to service_role;
  `);
  await db.exec(functionSql(billingMigration, "reserve_billing_credits"));
  await db.exec(functionSql(billingMigration, "settle_billing_credit_reservation"));
  await db.exec(functionSql(billingMigration, "settle_billing_from_background_job"));
  await db.exec(functionSql(jobMigration, "create_or_get_background_job_v1"));
  await db.exec("create trigger settle_billing_background_job_trigger after update of status on public.background_jobs for each row execute function public.settle_billing_from_background_job()");
  await db.exec(characterMigration);
  // Reproduce Supabase's inherited service-role defaults before hardening.
  await db.exec("grant all on public.character_free_generation_allowances to service_role");
  await db.exec(await source("20261003041318_character_allowance_privileges.sql"));

  await check("paid generation creates exactly three owned jobs and credit reservations", async () => {
    const owner = "paid-three";
    await paid(owner);
    const first = await create({ owner });
    assert.equal(first.result.length, 3);
    assert.deepEqual(await state(owner), { jobs: 3, reservations: 3, allowances: 0, reserved: 3 });
    const rows = await jobs(owner);
    assert.deepEqual(rows.map((job) => job.input_json.candidateIndex), [1, 2, 3]);
    assert.ok(rows.every((job) => job.job_type === "generate_image" && job.project_id === "ai-studio" && job.queue_name === "ai-generation"));
    assert.ok(rows.every((job, index) => job.idempotency_key === `character:${first.key}:${index + 1}`));
    const replay = (await db.query(callSql, [owner, first.key, fingerprint, 1, first.payload, "ai-generation", false])).rows;
    assert.deepEqual(replay.map((entry) => entry.job.id), first.result.map((entry) => entry.job.id));
    assert.deepEqual(await state(owner), { jobs: 3, reservations: 3, allowances: 0, reserved: 3 });
    await db.query("update public.billing_subscriptions set status='cancelled' where user_id=$1", [owner]);
    const afterCancellation = (await db.query(callSql, [owner, first.key, fingerprint, 1, first.payload, "ai-generation", false])).rows;
    assert.deepEqual(afterCancellation.map((entry) => entry.job.id), first.result.map((entry) => entry.job.id));
    await assert.rejects(create({ owner, key: first.key, requestFingerprint: "b".repeat(64) }), /idempotency_conflict/);
  });

  await check("insufficient third-image credit rolls back the whole batch", async () => {
    const owner = "only-two-credits";
    await paid(owner, 2);
    await assert.rejects(create({ owner }), /insufficient_billing_credits/);
    assert.deepEqual(await state(owner), { jobs: 0, reservations: 0, allowances: 0, reserved: 0 });
  });

  await check("a third-job persistence failure also rolls back all paid reservations", async () => {
    const owner = "third-job-fails";
    await paid(owner);
    const key = batchKey(), payload = inputs(key);
    payload[2].prompt = "reject-job";
    await assert.rejects(db.query(callSql, [owner, key, fingerprint, 1, payload, "ai-generation", false]), /background_jobs_reject_prompt_check/);
    assert.deepEqual(await state(owner), { jobs: 0, reservations: 0, allowances: 0, reserved: 0 });
  });

  await check("one free assisted image needs no plan, credit reservation or usage event", async () => {
    const owner = "free-first";
    const first = await create({ owner, count: 1, amount: 0, free: true });
    assert.equal(first.result.length, 1);
    assert.deepEqual(await state(owner), { jobs: 1, reservations: 0, allowances: 1, reserved: null });
    const allowance = (await db.query("select batch_id from public.character_free_generation_allowances where user_id=$1", [owner])).rows[0];
    assert.equal(allowance.batch_id, first.key);
    const replay = (await db.query(callSql, [owner, first.key, fingerprint, 0, first.payload, "ai-generation", true])).rows;
    assert.equal(replay[0].job.id, first.result[0].job.id);
    await assert.rejects(create({ owner, count: 1, amount: 0, free: true }), /free.*(used|consumed|exhausted|unavailable)|allowance/);
    await db.query("insert into public.billing_customers(user_id,dodo_customer_id) values($1,$2)", [owner, "former-customer"]);
    await db.query("update public.background_jobs set status='completed' where user_id=$1", [owner]);
    assert.equal((await db.query("select count(*)::int as n from public.billing_usage_outbox where user_id=$1", [owner])).rows[0].n, 0);
    assert.equal((await db.query(callSql, [owner, first.key, fingerprint, 0, first.payload, "ai-generation", true])).rows[0].job.id, first.result[0].job.id);
    await assert.rejects(create({ owner, key: first.key, count: 1, amount: 0, free: true, requestFingerprint: "c".repeat(64) }), /idempotency_conflict/);
    await assert.rejects(create({ owner, key: first.key, count: 3, amount: 1, free: false }), /idempotency_conflict/);
  });

  await check("failed free generation retains its one-time allowance, while failed admission does not", async () => {
    const owner = "free-failure";
    const first = await create({ owner, count: 1, amount: 0, free: true });
    await db.query("update public.background_jobs set status='failed' where user_id=$1", [owner]);
    await assert.rejects(create({ owner, count: 1, amount: 0, free: true }), /free.*(used|consumed|exhausted|unavailable)|allowance/);
    assert.equal((await db.query(callSql, [owner, first.key, fingerprint, 0, first.payload, "ai-generation", true])).rows[0].job.id, first.result[0].job.id);
    const rejectedOwner = "free-admission-failure";
    await assert.rejects(create({ owner: rejectedOwner, count: 1, amount: 0, free: true, overrides: { prompt: "reject-job" } }), /background_jobs_reject_prompt_check/);
    assert.deepEqual(await state(rejectedOwner), { jobs: 0, reservations: 0, allowances: 0, reserved: null });
    await create({ owner: rejectedOwner, count: 1, amount: 0, free: true });
  });

  await check("simultaneous free requests cannot consume the allowance twice", async () => {
    // PGlite executes on one connection: this tests simultaneous callers and
    // the uniqueness invariant, not cross-session advisory-lock contention.
    const owner = "concurrent-free";
    const results = await Promise.allSettled([
      create({ owner, count: 1, amount: 0, free: true }),
      create({ owner, count: 1, amount: 0, free: true }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.match(results.find((result) => result.status === "rejected").reason.message, /free.*(used|consumed|exhausted|unavailable)|allowance/);
    assert.deepEqual(await state(owner), { jobs: 1, reservations: 0, allowances: 1, reserved: null });
  });

  await check("simultaneous matching requests return the same paid batch", async () => {
    const owner = "concurrent-paid-replay", key = batchKey();
    await paid(owner);
    const results = await Promise.all([create({ owner, key }), create({ owner, key })]);
    assert.deepEqual(results[0].result.map((entry) => entry.job.id), results[1].result.map((entry) => entry.job.id));
    assert.deepEqual(await state(owner), { jobs: 3, reservations: 3, allowances: 0, reserved: 3 });
  });

  await check("stray reservations and incomplete batches cannot be silently reused", async () => {
    const owner = "stray-reservation", key = batchKey();
    await paid(owner);
    await db.query("insert into public.billing_credit_reservations(user_id,idempotency_key,job_type,amount,credit_period_start) values($1,$2,'generate_image',1,now())", [owner, `character:${key}:3`]);
    await assert.rejects(create({ owner, key }), /reservation_conflict/);
    assert.deepEqual(await state(owner), { jobs: 0, reservations: 1, allowances: 0, reserved: 0 });
    const partialOwner = "partial-batch", partialKey = batchKey(), payload = inputs(partialKey);
    await db.query("select public.create_or_get_background_job_v1($1,$2,null,'generate_image',3,'ai-studio','ai-generation',$3)", [`character:${partialKey}:1`, payload[0], partialOwner]);
    await assert.rejects(create({ owner: partialOwner, key: partialKey }), /idempotency_conflict/);
    assert.deepEqual(await state(partialOwner), { jobs: 1, reservations: 0, allowances: 0, reserved: null });
  });

  await check("invalid paid/free inputs cannot create jobs or consume allowances", async () => {
    const owner = "invalid-inputs";
    await paid(owner);
    for (const options of [
      { count: 2 }, { count: 1 }, { amount: 0 }, { queue: "wrong-queue" },
      { count: 3, amount: 0, free: true }, { count: 1, amount: 1, free: true },
      { count: 1, amount: 0, free: true, overrides: { mode: "custom" } },
      { count: 1, amount: 0, free: true, overrides: { referenceCharacterId: randomUUID() } },
      { count: 1, amount: 0, free: true, overrides: { referenceImageUrl: "https://trusted.example/reference.png" } },
      { overrides: { model: "unsupported" } },
      { overrides: { model: null } },
      { overrides: { generationId: "" } },
      { overrides: { prompt: 123 } },
      { overrides: { characterSource: "ai-studio" } },
      { overrides: { prompt: "x".repeat(2_001) } },
    ]) {
      await assert.rejects(create({ owner, ...options }), /character.*input_invalid/);
    }
    assert.deepEqual(await state(owner), { jobs: 0, reservations: 0, allowances: 0, reserved: 0 });
    await assert.rejects(create({ owner: "no-plan" }), /paid_subscription_required/);
    assert.deepEqual(await state("no-plan"), { jobs: 0, reservations: 0, allowances: 0, reserved: null });
  });

  await check("paid terminal jobs settle individually without duplicate credit or Dodo usage", async () => {
    const owner = "paid-settlement";
    await paid(owner);
    await db.query("insert into public.billing_customers(user_id,dodo_customer_id) values($1,$2)", [owner, "customer"]);
    await create({ owner });
    const rows = await jobs(owner);
    await db.query("update public.background_jobs set status='completed' where id=$1", [rows[0].id]);
    await db.query("update public.background_jobs set status='completed' where id=$1", [rows[0].id]);
    await db.query("update public.background_jobs set status='failed' where id=$1", [rows[1].id]);
    await db.query("update public.background_jobs set status='cancelled' where id=$1", [rows[1].id]);
    assert.deepEqual((await db.query("select used_credits,reserved_credits from public.billing_credit_balances where user_id=$1", [owner])).rows[0], { used_credits: 1, reserved_credits: 1 });
    assert.equal((await db.query("select count(*)::int as n from public.billing_usage_outbox where user_id=$1", [owner])).rows[0].n, 1);
    const reservations = (await db.query("select status,count(*)::int as n from public.billing_credit_reservations where user_id=$1 group by status order by status", [owner])).rows;
    assert.deepEqual(reservations, [{ status: "committed", n: 1 }, { status: "released", n: 1 }, { status: "reserved", n: 1 }]);
  });

  await check("RPC and allowance table are isolated from browser roles and protected by RLS", async () => {
    const signature = "public.character_create_reserved_generation_batch(text,text,text,integer,jsonb,text,boolean)";
    const grants = (await db.query(`select
      has_function_privilege('anon',$1,'EXECUTE') as anon,
      has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,
      has_function_privilege('service_role',$1,'EXECUTE') as service`, [signature])).rows[0];
    assert.deepEqual(grants, { anon: false, authenticated: false, service: true });
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.character_free_generation_allowances'::regclass")).rows[0].relrowsecurity, true);
    assert.deepEqual((await db.query("select privilege_type from information_schema.role_table_grants where table_name='character_free_generation_allowances' and grantee='service_role' order by privilege_type")).rows.map(row => row.privilege_type), ["INSERT", "SELECT"]);
    const configuration = (await db.query("select proconfig from pg_proc where oid=$1::regprocedure", [signature])).rows[0].proconfig;
    assert.ok(configuration.some((value) => value === 'search_path=""' || value === "search_path="));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(db.query("select * from public.character_free_generation_allowances"), /permission denied/);
        const key = batchKey();
        await assert.rejects(db.query(callSql, ["forged-owner", key, fingerprint, 0, inputs(key, 1), "ai-generation", true]), /permission denied/);
      } finally {
        await db.exec("reset role");
      }
    }
    await db.exec("set role service_role");
    try {
      assert.ok((await db.query("select count(*)::int as n from public.character_free_generation_allowances")).rows[0].n > 0);
    } finally {
      await db.exec("reset role");
    }
  });
  console.log("Character generation migration: all local database checks passed.");
} finally {
  await db.close();
}
