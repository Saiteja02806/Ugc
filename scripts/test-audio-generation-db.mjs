import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

// In-memory PostgreSQL only. No hosted database or storage calls.
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);
alter table storage.objects enable row level security;
grant select,insert on storage.objects to anon,authenticated;
grant usage on schema storage to anon,authenticated;
create policy legacy_broad_read on storage.objects for select to anon,authenticated using(true);
create policy legacy_broad_write on storage.objects for insert to anon,authenticated with check(true);
create table public.background_jobs(id uuid primary key default gen_random_uuid(),user_id text,job_type text,
  idempotency_key text,status text default 'queued',input_json jsonb,queue_name text,completed_at timestamptz,
  constraint background_jobs_job_type_check check(job_type in ('generate_image','sentinel_future_job')),
  unique(user_id,job_type,idempotency_key));
create table public.billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount integer,background_job_id uuid,status text default 'reserved',complimentary_plan_grant_id uuid,unique(user_id,idempotency_key));
create table public.billing_customers(user_id text,dodo_customer_id text);
create table public.billing_usage_outbox(event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,generation_kind text,credit_cost integer,occurred_at timestamptz);
-- Existing application tables already have service-role privileges in Supabase.
grant all on public.background_jobs,public.billing_credit_reservations,public.billing_customers,public.billing_usage_outbox to service_role;
create function public.settle_billing_credit_reservation(text,text,uuid,boolean) returns boolean language plpgsql as $$
begin update public.billing_credit_reservations set status=case when $4 then 'committed' else 'released' end where user_id=$1 and idempotency_key=$2 and status='reserved'; return found; end; $$;
create function public.reserve_billing_credits(text,text,text,integer) returns jsonb language plpgsql as $$
begin insert into public.billing_credit_reservations(user_id,idempotency_key,job_type,amount) values($1,$2,$3,$4); return '{}'::jsonb; end; $$;
create function public.create_or_get_background_job_v1(text,jsonb,text,text,integer,text,text,text) returns jsonb language plpgsql as $$
declare j public.background_jobs;
begin insert into public.background_jobs(user_id,job_type,idempotency_key,input_json,queue_name) values($8,$4,$1,$2,$7) returning * into j;
return jsonb_build_object('created',true,'job',to_jsonb(j)); end; $$;
`);
// Exercise audio terminal settlement alongside the actual existing billing
// trigger. Only its ledger primitive is stubbed in this disposable database.
const billingMigration = await readFile(new URL("../supabase/migrations/20260910105839_add_complimentary_plan_grants.sql", import.meta.url), "utf8");
const billingTrigger = billingMigration.match(/create or replace function public\.settle_billing_from_background_job\(\)[\s\S]*?\$function\$;/i)?.[0];
assert.ok(billingTrigger, "The production billing trigger must be present.");
await db.exec(billingTrigger);
await db.exec("create trigger settle_billing_background_job_trigger after update of status on public.background_jobs for each row execute function public.settle_billing_from_background_job();");
await db.exec(await readFile(new URL("../supabase/migrations/20261001120000_audio_generation.sql", import.meta.url), "utf8"));
after(async () => db.close());
async function create({ key = randomUUID(), id = randomUUID(), owner = "owner", script = "hello", period = "period", kind = "speech", payload = {}, characters = script.length, globalLimit = 9000, userLimit = 3000, cost = 0, costLimit = 5000000, requests = 30, credits = 0, fingerprint = "a".repeat(64) } = {}) {
  const result = await db.query(`select public.create_audio_generation_request($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14) as request`,
    [id,owner,key,fingerprint,kind,JSON.stringify({ script, voiceId: "voice", modelId: "eleven_flash_v2_5", name: "Test", testOnly: true, ...payload }),period,characters,cost,globalLimit,userLimit,costLimit,requests,credits]);
  return result.rows[0].request;
}
async function asset(owner, purpose = "reference", status = "ready") {
  const id = randomUUID();
  await db.query("insert into public.audio_assets(id,user_id,name,purpose,object_key,mime_type,size_bytes,status) values($1,$2,'Recording',$3,$4,'audio/mpeg',100,$5)", [id,owner,purpose,`${owner}/${id}/recording.mp3`,status]);
  return id;
}
async function profile(owner, source, status = "ready") {
  const id = randomUUID(), voice = `voice_${id}`;
  await db.query("insert into public.audio_voice_profiles(id,user_id,name,provider_voice_id,source_asset_id,consent_at,status) values($1,$2,'My voice',$3,$4,now(),$5)", [id,owner,voice,source,status]);
  return { id, voice };
}
async function retire(kind,id,owner) {
  return (await db.query(`select public.retire_audio_${kind}($1,$2) as retired`, [id,owner])).rows[0].retired;
}
test("migration retains unknown existing job types and adds audio", async () => {
  await db.exec("insert into public.background_jobs(job_type) values('sentinel_future_job'),('generate_image'),('generate_audio')");
  assert.equal((await db.query("select count(*)::int n from storage.buckets")).rows[0].n, 0);
});
test("same request creates one job, reservation and usage charge", async () => {
  const key = randomUUID(); const first = await create({ key, period: "duplicates", credits: 1 });
  const second = await create({ key, period: "duplicates", credits: 1 }); assert.equal(first.id, second.id);
  assert.equal((await db.query("select count(*)::int as n from public.billing_credit_reservations where background_job_id=$1", [first.job_id])).rows[0].n, 1);
  const count = (await db.query("select characters,requests from public.audio_usage_counters where scope='global' and period='duplicates'")).rows[0]; assert.equal(Number(count.characters), 5); assert.equal(count.requests, 1);
  await assert.rejects(create({ key, period: "duplicates", fingerprint: "b".repeat(64) }), /audio_request_conflict/);
});
test("concurrent submissions respect character and cost reservations", async () => {
  const settled = await Promise.allSettled([create({ period: "concurrent", globalLimit: 5 }), create({ period: "concurrent", globalLimit: 5 })]);
  assert.equal(settled.filter(r => r.status === "fulfilled").length, 1);
  assert.match(settled.find(r => r.status === "rejected").reason.message, /audio_quota_exceeded/);
  await assert.rejects(create({ period: "cost", cost: 100, costLimit: 99 }), /audio_quota_exceeded/);
});
test("clone and upload sources must belong to the request owner", async () => {
  const assetId = randomUUID(); await db.query("insert into public.audio_assets(id,user_id,name,purpose,object_key,mime_type,size_bytes,status) values($1,'alice','Sample','reference',$2,'audio/mpeg',100,'ready')", [assetId,assetId]);
  await assert.rejects(create({ owner: "bob", kind: "clone", characters: 0, payload: { sourceAssetId: assetId } }), /audio_source_invalid/);
  const result = await create({ owner: "alice", kind: "clone", characters: 0, payload: { sourceAssetId: assetId } }); assert.equal(result.user_id, "alice");
});
test("terminal failure releases unsubmitted usage exactly once", async () => {
  const req = await create({ period: "release", cost: 40 });
  await db.query("update public.background_jobs set status='failed' where id=$1", [req.job_id]);
  await db.query("update public.background_jobs set status='cancelled' where id=$1", [req.job_id]);
  const counter = (await db.query("select characters,cost_micros from public.audio_usage_counters where scope='global' and period='release'")).rows[0];
  assert.equal(Number(counter.characters), 0); assert.equal(Number(counter.cost_micros), 0);
});
test("different request IDs cannot create duplicate clones of one reference", async () => {
  const assetId = randomUUID(); await db.query("insert into public.audio_assets(id,user_id,name,purpose,object_key,mime_type,size_bytes,status) values($1,'cloner','Sample','reference',$2,'audio/mpeg',100,'ready')", [assetId,assetId]);
  const results = await Promise.all([create({ owner: "cloner", period: "clones", kind: "clone", characters: 0, payload: { sourceAssetId: assetId } }), create({ owner: "cloner", period: "clones", kind: "clone", characters: 0, payload: { sourceAssetId: assetId } })]);
  assert.equal(results[0].id, results[1].id);
  assert.equal((await db.query("select count(*)::int as n from public.background_jobs where user_id='cloner'")).rows[0].n, 1);
  assert.equal((await db.query("select requests from public.audio_usage_counters where scope='user:cloner' and period='clones'")).rows[0].requests, 1);
});
test("uncertain provider submissions retain their usage reservation", async () => {
  const req = await create({ period: "uncertain", cost: 40 });
  await db.query("update public.audio_generation_requests set status='uncertain',provider_started_at=now() where id=$1", [req.id]);
  await db.query("update public.background_jobs set status='failed' where id=$1", [req.job_id]);
  const row = (await db.query("select status,usage_released from public.audio_generation_requests where id=$1", [req.id])).rows[0]; assert.equal(row.status, "uncertain"); assert.equal(row.usage_released, false);
  const counter = (await db.query("select characters from public.audio_usage_counters where scope='global' and period='uncertain'")).rows[0]; assert.equal(Number(counter.characters), 5);
});
test("provider lease serializes account calls", async () => {
  const a = randomUUID(), b = randomUUID();
  assert.equal((await db.query("select public.claim_audio_provider($1) as acquired", [a])).rows[0].acquired, true);
  assert.equal((await db.query("select public.claim_audio_provider($1) as acquired", [a])).rows[0].acquired, false);
  assert.equal((await db.query("select public.claim_audio_provider($1) as acquired", [b])).rows[0].acquired, false);
  await db.query("select public.release_audio_provider($1)", [b]);
  assert.equal((await db.query("select public.claim_audio_provider($1) as acquired", [b])).rows[0].acquired, false);
  await db.query("select public.release_audio_provider($1)", [a]);
  assert.equal((await db.query("select public.claim_audio_provider($1) as acquired", [b])).rows[0].acquired, true);
});

test("submission marker is owner-scoped, exactly once, and refuses pending cancellation", async () => {
  const req = await create({ owner:"submission-owner",period:"submission" });
  async function start(owner = "submission-owner") {
    return (await db.query("select public.start_audio_provider_submission($1,$2) as started", [req.id,owner])).rows[0].started;
  }
  assert.equal(await start(),false); // The job is queued, not claimed by a worker.
  await db.query("update public.background_jobs set status='processing' where id=$1", [req.job_id]);
  assert.equal(await start("foreign"),false);
  await db.query("update public.background_jobs set status='cancel_requested' where id=$1", [req.job_id]);
  assert.equal(await start(),false);
  assert.equal((await db.query("select provider_started_at from public.audio_generation_requests where id=$1", [req.id])).rows[0].provider_started_at,null);
  await db.query("update public.background_jobs set status='processing' where id=$1", [req.job_id]);
  assert.equal(await start(),true); assert.equal(await start(),false);
  const failed = await create({ owner:"submission-owner",period:"submission-ended" });
  await db.query("update public.background_jobs set status='failed' where id=$1", [failed.job_id]);
  assert.equal((await db.query("select public.start_audio_provider_submission($1,$2) as started", [failed.id,"submission-owner"])).rows[0].started,false);
});

test("audio credits settle exactly once without entering the image/video usage outbox", async () => {
  const req = await create({ owner: "paid", period: "audio-billing", credits: 2 });
  await db.query("insert into public.billing_customers(user_id,dodo_customer_id) values('paid','customer')");
  await db.query("update public.background_jobs set status='completed' where id=$1", [req.job_id]);
  await db.query("update public.background_jobs set status='completed' where id=$1", [req.job_id]);
  const row = (await db.query("select status,amount from public.billing_credit_reservations where background_job_id=$1", [req.job_id])).rows[0];
  assert.equal(row.status, "committed"); assert.equal(row.amount, 2);
  assert.equal((await db.query("select count(*)::int as n from public.billing_usage_outbox")).rows[0].n, 0);
  const failed = await create({ owner: "paid", period: "audio-billing", credits: 1 });
  await db.query("update public.audio_generation_requests set status='uncertain',provider_started_at=now() where id=$1", [failed.id]);
  await db.query("update public.background_jobs set status='failed' where id=$1", [failed.job_id]);
  assert.equal((await db.query("select status from public.billing_credit_reservations where background_job_id=$1", [failed.job_id])).rows[0].status, "released");
  assert.equal((await db.query("select usage_released from public.audio_generation_requests where id=$1", [failed.id])).rows[0].usage_released, false);
});

test("retirement remains owner-scoped, preserves cleanup metadata and prevents future private voice admission", async () => {
  const source = await asset("retirement-owner"); const voice = await profile("retirement-owner",source);
  await assert.rejects(retire("voice",voice.id,"foreign"), /audio_voice_not_found/);
  await assert.rejects(retire("asset",source,"foreign"), /audio_asset_not_found/);
  const retired = await retire("voice",voice.id,"retirement-owner");
  assert.equal(retired.status,"deleted"); assert.equal(retired.provider_voice_id,voice.voice);
  await assert.rejects(create({ owner:"retirement-owner",period:"voice-retired",payload:{ voiceId:voice.voice, privateVoiceProfileId:voice.id } }), /audio_voice_unavailable/);
  await assert.rejects(retire("asset",source,"retirement-owner"), /audio_asset_in_use/);
  await db.query("update public.audio_voice_profiles set provider_voice_id=null where id=$1", [voice.id]);
  await assert.rejects(create({ owner:"retirement-owner",period:"voice-cleaned",payload:{ voiceId:voice.voice, privateVoiceProfileId:voice.id } }), /audio_voice_unavailable/);
  const retiredAsset = await retire("asset",source,"retirement-owner");
  assert.equal(retiredAsset.asset.status,"deleted"); assert.equal(retiredAsset.asset.cleanup_completed_at,null); assert.equal(retiredAsset.chunk_count,0);
  assert.equal((await retire("asset",source,"retirement-owner")).asset.object_key,retiredAsset.asset.object_key);
  await assert.rejects(create({ owner:"retirement-owner",kind:"clone",characters:0,payload:{ sourceAssetId:source } }), /audio_source_invalid/);
});

test("private voice retirement blocks queued and uncertain generation uses", async () => {
  const source = await asset("active-voice-owner"); const voice = await profile("active-voice-owner",source);
  const req = await create({ owner:"active-voice-owner",period:"active-voice",payload:{ voiceId:voice.voice,privateVoiceProfileId:voice.id } });
  assert.equal(req.voice_profile_id,voice.id);
  await assert.rejects(retire("voice",voice.id,"active-voice-owner"), /audio_voice_in_use/);
  await db.query("update public.audio_generation_requests set status='uncertain' where id=$1", [req.id]);
  await assert.rejects(retire("voice",voice.id,"active-voice-owner"), /audio_voice_in_use/);
  await db.query("update public.audio_generation_requests set status='failed' where id=$1", [req.id]);
  assert.equal((await retire("voice",voice.id,"active-voice-owner")).status,"deleted");
});

test("retirement and new requests serialize against the same ready reference", async () => {
  for (const deletionFirst of [false,true]) {
    const owner = `retirement-race-${deletionFirst}`; const source = await asset(owner);
    const actions = [() => create({ owner,period:owner,kind:"clone",characters:0,payload:{ sourceAssetId:source } }), () => retire("asset",source,owner)];
    if (deletionFirst) actions.reverse();
    const results = await Promise.allSettled(actions.map(action => action()));
    assert.equal(results.filter(result => result.status === "fulfilled").length,1);
    assert.match(results.find(result => result.status === "rejected").reason.message, /audio_source_invalid|audio_asset_in_use/);
  }
});

test("completed generated recordings expose chunk cleanup metadata while processing assets stay protected", async () => {
  const owner = "retire-generated"; const pending = await asset(owner,"exact","processing");
  await assert.rejects(retire("asset",pending,owner), /audio_asset_in_use/);
  const req = await create({ owner,period:owner }); const generated = await asset(owner,"generated");
  await db.query("update public.audio_assets set generation_id=$1 where id=$2", [req.id,generated]);
  await db.query("update public.audio_generation_requests set status='completed',output_asset_id=$1,chunk_count=3 where id=$2", [generated,req.id]);
  const retired = await retire("asset",generated,owner); assert.equal(retired.chunk_count,3);
  assert.equal(retired.asset.generation_id,req.id);
});
test("browser roles cannot reach private audio records or RPCs, and existing Supabase Storage policies are untouched", async () => {
  await db.exec("insert into storage.objects(bucket_id) values('existing-media');");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role};`);
    try {
    await assert.rejects(db.query("select * from public.audio_assets"), /permission denied/);
    await assert.rejects(db.query("select public.claim_audio_provider($1)", [randomUUID()]), /permission denied/);
    await assert.rejects(db.query("select public.retire_audio_asset($1,'owner')", [randomUUID()]), /permission denied/);
    await assert.rejects(db.query("select public.start_audio_provider_submission($1,'owner')", [randomUUID()]), /permission denied/);
    const objects = await db.query("select bucket_id from storage.objects"); assert.ok(objects.rows.every(row => row.bucket_id === "existing-media"));
    await db.query("insert into storage.objects(bucket_id) values('existing-media')");
    } finally { await db.exec("reset role;"); }
  }
});

test("service-role invoker can create, claim and settle a job without browser access or definer escalation", async () => {
  await db.exec("set role service_role;");
  try {
    const req = await create({ owner: "service-only", period: "service-runtime", credits: 1 });
    await db.query("update public.background_jobs set status='processing' where id=$1", [req.job_id]);
    assert.equal((await db.query("select public.start_audio_provider_submission($1,$2) as started", [req.id, "service-only"])).rows[0].started, true);
    await db.query("update public.background_jobs set status='completed' where id=$1", [req.job_id]);
    assert.equal((await db.query("select status from public.billing_credit_reservations where background_job_id=$1", [req.job_id])).rows[0].status, "committed");
  } finally { await db.exec("reset role;"); }
});
