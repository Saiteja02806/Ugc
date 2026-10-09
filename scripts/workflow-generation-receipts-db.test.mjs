import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261003190747_explore_atomic_generation_requests.sql", import.meta.url), "utf8");
const key = "11111111-1111-4111-8111-111111111111";
const fingerprint = "a".repeat(64);
async function fixture(credits = 100) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,job_type text,project_id text,idempotency_key text,input_json jsonb,status text default 'queued',unique(user_id,job_type,idempotency_key));
    create table billing_credit_reservations(user_id text,idempotency_key text,job_type text,amount int,unique(user_id,idempotency_key));
    create table balances(user_id text primary key,remaining int);
    insert into balances values('owner-a',${credits}),('owner-b',100);
    create function reserve_billing_credits(p_user_id text,p_key text,p_type text,p_amount int) returns jsonb language plpgsql as $$
      begin
        perform pg_advisory_xact_lock(hashtextextended('billing-credits:'||p_user_id,0));
        update public.balances set remaining=remaining-p_amount where user_id=p_user_id and remaining>=p_amount;
        if not found then raise exception 'insufficient_billing_credits'; end if;
        insert into public.billing_credit_reservations values(p_user_id,p_key,p_type,p_amount);
        return '{}'::jsonb;
      end;
    $$;
    create function create_or_get_background_job_v1(p_key text,p_input jsonb,p_reference text,p_type text,p_attempts int,p_project text,p_queue text,p_user text) returns jsonb language plpgsql as $$
      declare v_job public.background_jobs;
      begin
        select * into v_job from public.background_jobs where user_id=p_user and job_type=p_type and idempotency_key=p_key;
        if found then return jsonb_build_object('created',false,'job',to_jsonb(v_job)); end if;
        insert into public.background_jobs(user_id,job_type,project_id,idempotency_key,input_json) values(p_user,p_type,p_project,p_key,p_input) returning * into v_job;
        return jsonb_build_object('created',true,'job',to_jsonb(v_job));
      end;
    $$;
    grant select,insert,update on background_jobs,billing_credit_reservations,balances to service_role;
    grant execute on function reserve_billing_credits(text,text,text,int),create_or_get_background_job_v1(text,jsonb,text,text,int,text,text,text) to service_role;
  `);
  await db.exec(migration);
  return db;
}
const inputs = (quantity = 2, owner = "owner-a", kind = "hook", fp = fingerprint) => Array.from({ length: quantity }, (_, index) => ({
  userId: owner, projectId: "ai-studio", promptMode: "direct", workflowKind: kind, workflowRequestKey: key,
  workflowRequestFingerprint: fp, batchSize: quantity, batchIndex: index + 1,
  videoId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, hookIdea: "Only my own words.",
}));
const start = (db, { owner = "owner-a", kind = "hook", quantity = 2, fp = fingerprint, cost = 4, input = inputs(quantity, owner, kind, fp) } = {}) => db.query(
  "select explore_create_reserved_generation_batch($1,$2,$3,$4,$5,$6::jsonb) result", [owner,key,kind,fp,cost,JSON.stringify(input)],
);
const resolve = (db, owner = "owner-a", kind = "hook", quantity = 2) => db.query("select explore_resolve_generation_request($1,$2,$3,$4) result",[owner,key,kind,quantity]);
const counts = async (db) => (await db.query("select (select count(*)::int from background_jobs) jobs,(select count(*)::int from billing_credit_reservations) reservations,(select count(*)::int from explore_generation_requests) receipts")).rows[0];

test("every job, credit reservation and receipt commit together; replay keeps all IDs and cost", async () => {
  const db = await fixture();
  try {
    await db.exec("set role service_role");
    const first = (await start(db)).rows[0].result;
    assert.equal(first.created,true); assert.equal(first.jobs.length,2);
    const again = (await start(db)).rows[0].result;
    assert.equal(again.created,false); assert.deepEqual(again.jobs,first.jobs);
    assert.deepEqual(await counts(db),{jobs:2,reservations:2,receipts:1});
    assert.equal((await db.query("select remaining from balances where user_id='owner-a'")).rows[0].remaining,92);
    assert.equal((await resolve(db)).rows[0].result.outcome,"accepted");
    assert.deepEqual(await counts(db),{jobs:2,reservations:2,receipts:1});
  } finally { await db.close(); }
});

test("WAN's three-second batch keeps its provider, settings and credits when an acknowledgement is replayed", async () => {
  const db = await fixture();
  const input = inputs().map((entry) => ({
    ...entry, model: "wan_3_0", provider: "openrouter", durationSeconds: 3, resolution: "1080p",
    referenceImageUrls: ["https://cdn.example.com/reference.png"],
  }));
  try {
    await db.exec("set role service_role");
    const first = (await start(db, { input, cost: 12 })).rows[0].result;
    const replay = (await start(db, { input, cost: 12 })).rows[0].result;
    assert.equal(first.created, true);
    assert.equal(replay.created, false);
    assert.deepEqual(replay.jobs, first.jobs);
    assert.deepEqual(await counts(db), { jobs: 2, reservations: 2, receipts: 1 });
    assert.equal((await db.query("select remaining from balances where user_id='owner-a'")).rows[0].remaining, 76);
    const rows = (await db.query("select input_json from background_jobs order by input_json->>'batchIndex'")).rows;
    assert.deepEqual(rows.map((row) => row.input_json), input);
    assert.equal((await resolve(db)).rows[0].result.outcome, "accepted");
  } finally { await db.close(); }
});

test("failure on a later reservation rolls back the entire batch instead of stranding partial jobs", async () => {
  const db = await fixture(6);
  try {
    await assert.rejects(start(db),/insufficient_billing_credits/);
    assert.deepEqual(await counts(db),{jobs:0,reservations:0,receipts:0});
    assert.equal((await db.query("select remaining from balances where user_id='owner-a'")).rows[0].remaining,6);
  } finally { await db.close(); }
});

test("explicit resolution fences an unreceived request; neither a late batch nor the old API may insert it", async () => {
  const db = await fixture();
  try {
    const receipt = (await resolve(db)).rows[0].result;
    assert.equal(receipt.outcome,"not_started"); assert.deepEqual(receipt.job_ids,[]);
    assert.deepEqual((await resolve(db)).rows[0].result,receipt);
    await assert.rejects(start(db),/idempotency_conflict/);
    await assert.rejects(db.query("insert into background_jobs(user_id,job_type,project_id,idempotency_key,input_json) values('owner-a','generate_hook_video','ai-studio',$1,$2)",[`explore:${key}:1`,JSON.stringify(inputs()[0])]),/request_closed/);
    assert.deepEqual(await counts(db),{jobs:0,reservations:0,receipts:1});
  } finally { await db.close(); }
});

test("request identity is owner-scoped and rejects changed workflow, quantity or fingerprint", async () => {
  const db = await fixture();
  try {
    await start(db);
    for (const args of [{kind:"phone"},{quantity:1},{fp:"b".repeat(64)}]) await assert.rejects(start(db,args),/idempotency_conflict/);
    await assert.rejects(resolve(db,"owner-a","phone"),/idempotency_conflict/);
    await start(db,{owner:"owner-b"});
    assert.deepEqual(await counts(db),{jobs:4,reservations:4,receipts:2});
  } finally { await db.close(); }
});

test("malformed batches cannot reserve, commit duplicate output IDs or impersonate another owner", async () => {
  const db = await fixture();
  try {
    const malformed = [inputs(3),inputs().map((input)=>({...input,userId:"owner-b"})),inputs().map((input)=>({...input,batchIndex:1})),inputs().map((input)=>({...input,videoId:inputs()[0].videoId}))];
    for (const input of malformed) await assert.rejects(start(db,{input}),/input_invalid/);
    assert.deepEqual(await counts(db),{jobs:0,reservations:0,receipts:0});
    await db.exec("insert into background_jobs(user_id,job_type,project_id,idempotency_key,input_json) values('owner-a','generate_hook_video','ai-studio','legacy-request','{}')");
    assert.equal((await counts(db)).jobs,1); // Existing namespaces are unaffected.
  } finally { await db.close(); }
});

test("anonymous/authenticated roles cannot read receipts or execute privileged creation/resolution", async () => {
  const db = await fixture();
  try {
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from explore_generation_requests"),/permission denied/);
      await assert.rejects(start(db),/permission denied/);
      await assert.rejects(resolve(db),/permission denied/);
      await db.exec("reset role");
    }
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='explore_generation_requests'::regclass")).rows[0].relrowsecurity,true);
  } finally { await db.close(); }
});
