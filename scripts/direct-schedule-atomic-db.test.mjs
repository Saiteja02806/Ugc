import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const baseline = read("20260829093001_production_baseline_v1.sql");
const migration = read("20261014141245_atomic_direct_schedule_creation.sql");
const jobs = read("20260905123000_harden_wall_text_regeneration_recovery.sql");
const billing = read("20260910113000_finalize_complimentary_plan_trial_guards.sql");
const earlyPublishing = read("20261003121102_prevent_early_social_publishing.sql");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = "a".repeat(64);
const post = () => ({ user_id: "owner-a", project_id: null, source_kind: "media_asset", media_asset_id: id(1), library_item_id: null,
  caption: "Exact post", title: "Talking head + demo", timezone: "UTC", scheduled_for: "2030-10-14T12:00:00Z", status: "scheduling", idempotency_key: `explore:${id(9)}`,
  metadata: { mediaMode: "single_video", exploreWorkflow: "hook", plannedScheduledFor: "2030-10-14T12:00:00Z" } });
const targets = () => [{ social_connection_id: id(2), platform: "instagram", settings: { shareToFeed: true } }];

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table media_assets(id uuid primary key,user_id text,status text,deleted_at timestamptz);
    create table library_items(id uuid primary key,user_id text,status text,deleted_at timestamptz);
    create table social_connections(id uuid primary key,user_id text,platform text,status text,revoked_at timestamptz);
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,project_id text,job_type text,idempotency_key text,
      input_json jsonb,input_reference text,max_attempts integer,queue_name text,queue_provider text,queued_at timestamptz,stage text,status text,updated_at timestamptz,
      next_attempt_at timestamptz,last_heartbeat_at timestamptz,locked_at timestamptz,last_delivery_at timestamptz,
      claim_token uuid,completed_at timestamptz,error_code text,error_message text,started_at timestamptz,worker_execution_id text,worker_id text,
      unique(user_id,job_type,idempotency_key));
    create table billing_subscriptions(user_id text,status text);
    create table complimentary_plan_grants(user_id text,revoked_at timestamptz,expires_at timestamptz);
    create table free_trial_entitlements(user_id text primary key,expires_at timestamptz,instagram_schedule_limit integer);
    insert into free_trial_entitlements values('owner-a',now()+interval '10 days',5);
    insert into media_assets values('${id(1)}','owner-a','ready',null),('${id(4)}','owner-b','ready',null);
    insert into library_items values('${id(5)}','owner-a','ready',null);
    insert into social_connections values('${id(2)}','owner-a','instagram','connected',null),
      ('${id(3)}','owner-a','instagram','connected',null),('${id(6)}','owner-b','instagram','connected',null);`);
  for (const table of ["scheduled_posts", "scheduled_post_targets"]) {
    const sql = baseline.match(new RegExp(`CREATE TABLE "public"\\."${table}" \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(sql, table); await db.exec(sql);
  }
  await db.exec(`create unique index scheduled_posts_user_idempotency_idx on scheduled_posts(user_id,idempotency_key) where idempotency_key is not null;
    create unique index scheduled_post_targets_post_connection_idx on scheduled_post_targets(scheduled_post_id,social_connection_id);
    create table free_trial_instagram_schedule_usage(user_id text,scheduled_post_target_id uuid unique references scheduled_post_targets(id));
    alter table scheduled_posts enable row level security; alter table scheduled_post_targets enable row level security;`);
  await db.exec(jobs.slice(0, jobs.indexOf("REVOKE ALL")));
  const trigger = billing.match(/create or replace function public\.enforce_free_trial_instagram_schedule_limit\(\)[\s\S]*?\$function\$;/)?.[0];
  assert.ok(trigger); await db.exec(trigger);
  await db.exec(`create trigger enforce_free_trial_instagram_schedule_limit after insert on scheduled_post_targets
      for each row execute function enforce_free_trial_instagram_schedule_limit();
    grant select,insert,update on all tables in schema public to service_role;
    grant execute on function create_or_get_background_job_v1(text,jsonb,text,text,integer,text,text,text),enforce_free_trial_instagram_schedule_limit() to service_role;`);
  await db.exec(migration); await db.exec("set role service_role");
  return db;
}
async function create(db, value = post(), destinations = targets(), requestHash = hash) {
  return (await db.query("select create_direct_scheduled_post($1::jsonb,$2::jsonb,$3,$4) result", [JSON.stringify(value), JSON.stringify(destinations), requestHash, "publish-test-queue"])).rows[0].result;
}
async function counts(db) {
  const result = {};
  for (const table of ["scheduled_posts", "scheduled_post_targets", "background_jobs", "free_trial_instagram_schedule_usage"]) result[table] = (await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
  return result;
}
const empty = { scheduled_posts: 0, scheduled_post_targets: 0, background_jobs: 0, free_trial_instagram_schedule_usage: 0 };

test("quota failure on a later target rolls back parent, every target, queued jobs and trial usage", async () => {
  const db = await fixture(); try {
    await db.exec("update free_trial_entitlements set instagram_schedule_limit=1");
    await assert.rejects(create(db, post(), [...targets(), { ...targets()[0], social_connection_id: id(3) }]), /free_trial_schedule_limit_reached/);
    assert.deepEqual(await counts(db), empty);
    const accepted = await create(db);
    assert.equal(accepted.created, true); assert.ok(accepted.targets[0].publish_job_id);
    assert.deepEqual(await counts(db), { scheduled_posts: 1, scheduled_post_targets: 1, background_jobs: 1, free_trial_instagram_schedule_usage: 1 });
  } finally { await db.close(); }
});
test("job creation fault rolls back the complete acknowledgement", async () => {
  const db = await fixture(); try {
    await db.exec(`reset role; create function fail_publish_job() returns trigger language plpgsql as $$ begin raise exception 'injected_publish_job_failure'; end; $$;
      create trigger fail_publish_job before insert on background_jobs for each row execute function fail_publish_job(); set role service_role;`);
    await assert.rejects(create(db), /injected_publish_job_failure/); assert.deepEqual(await counts(db), empty);
  } finally { await db.close(); }
});
test("same identity creates one parent, one destination and one durable job; changed snapshot conflicts", async () => {
  const db = await fixture(); try {
    const [first, second] = await Promise.all([create(db), create(db)]);
    assert.equal(first.created, true); assert.equal(second.created, false); assert.equal(first.post.id, second.post.id);
    assert.deepEqual(first.targets, second.targets);
    await assert.rejects(create(db, { ...post(), caption: "changed" }, targets(), "b".repeat(64)), /schedule_idempotency_conflict/);
    assert.deepEqual(await counts(db), { scheduled_posts: 1, scheduled_post_targets: 1, background_jobs: 1, free_trial_instagram_schedule_usage: 1 });
  } finally { await db.close(); }
});
test("accepted replay preserves identities after cancellation, removal, revocation or expired trial", async () => {
  const db = await fixture(); try {
    const first = await create(db);
    await db.exec(`update scheduled_posts set status='cancelled'; update media_assets set deleted_at=now();
      update social_connections set status='revoked',revoked_at=now(); update free_trial_entitlements set expires_at=now()-interval '1 day';`);
    const replay = await create(db); assert.equal(replay.created, false); assert.equal(replay.post.status, "cancelled");
    assert.equal(replay.post.id, first.post.id); assert.deepEqual(replay.targets, first.targets);
  } finally { await db.close(); }
});
test("foreign, deleted, mismatched and duplicate destinations cannot bind or consume usage", async () => {
  const db = await fixture(); try {
    await assert.rejects(create(db, { ...post(), media_asset_id: id(4) }), /schedule_source_unavailable/);
    await assert.rejects(create(db, post(), [{ ...targets()[0], social_connection_id: id(6) }]), /schedule_account_unavailable/);
    await assert.rejects(create(db, post(), [{ ...targets()[0], platform: "tiktok" }]), /schedule_account_unavailable/);
    await assert.rejects(create(db, post(), [...targets(), ...targets()]), /duplicate key/);
    assert.deepEqual(await counts(db), empty);
    await db.exec("update media_assets set deleted_at=now()"); await assert.rejects(create(db), /schedule_source_unavailable/);
    assert.deepEqual(await counts(db), empty);
  } finally { await db.close(); }
});
test("Library carousel creation retains the owned image source and per-target job", async () => {
  const db = await fixture(); try {
    const value = { ...post(), source_kind: "library_item", media_asset_id: null, library_item_id: id(5), metadata: { mediaMode: "carousel" } };
    const result = await create(db, value); assert.equal(result.post.library_item_id, id(5)); assert.equal(result.post.media_asset_id, null);
    const job = (await db.query("select * from background_jobs")).rows[0]; assert.equal(job.input_json.targetId, result.targets[0].id);
    assert.equal(job.job_type, "publish_social_post"); assert.equal(job.queue_name, "publish-test-queue");
  } finally { await db.close(); }
});
test("browser roles cannot invoke atomic schedule creation", async () => {
  const db = await fixture(); try {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`); await assert.rejects(create(db), /permission denied/);
    }
  } finally { await db.close(); }
});
test("time elapsed before a new transaction is an explicit rejection with no saved publishing work", async () => {
  const db = await fixture(); try {
    await assert.rejects(create(db, { ...post(), scheduled_for: "2000-01-01T00:00:00Z" }), /schedule_time_too_soon/);
    assert.deepEqual(await counts(db), empty);
  } finally { await db.close(); }
});
test("queued atomic publish jobs cannot be recovered or claimed early, while cancellation cleanup remains eligible", async () => {
  const db = await fixture(); try {
    await db.exec("reset role");
    // These are the exact deployed guard functions, not mirrored predicates.
    await db.exec(earlyPublishing.slice(0, earlyPublishing.indexOf("CREATE OR REPLACE FUNCTION public.recover_background_job")));
    await db.exec("set role service_role");
    const first = await create(db), jobId = first.targets[0].publish_job_id;
    await db.exec("update background_jobs set queued_at=now()-interval '2 hours'");
    assert.equal((await db.query("select * from list_recoverable_background_jobs(10,60)")).rows.length, 0);
    assert.equal((await db.query("select * from claim_background_job($1,$2,$3,60)", [jobId, "test-worker", id(20)])).rows.length, 0);
    await db.exec("update scheduled_post_targets set status='cancelled'; update scheduled_posts set status='cancelled'");
    assert.equal((await db.query("select * from list_recoverable_background_jobs(10,60)")).rows.length, 1);
    assert.equal((await db.query("select * from claim_background_job($1,$2,$3,60)", [jobId, "test-worker", id(20)])).rows.length, 1);
  } finally { await db.close(); }
});
