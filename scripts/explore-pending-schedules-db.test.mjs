import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
const migration = readFileSync(new URL("../supabase/migrations/20261012212532_explore_pending_video_schedules.sql", import.meta.url), "utf8");
const finishing = readFileSync(new URL("../supabase/migrations/20261004053418_explore_video_finishing.sql", import.meta.url), "utf8");
const sources = readFileSync(new URL("../supabase/migrations/20261007153742_explore_existing_video_sources.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = "a".repeat(64), fingerprint = "b".repeat(64);
const draft = () => ({ version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: null,
  demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null,
  composition: { version: 1, sourceEditing: null, demoEditing: null, sourceAudioAssetId: null, sourceAudioPlayback: "once" } });
const schedule = () => ({ caption: "Exact caption", title: "Hook + Demo", timezone: "Asia/Calcutta", scheduledFor: "2030-01-01T10:00:00Z",
  metadata: { plannedScheduledFor: "2030-01-01T10:00:00Z", plannedTargetsJson: JSON.stringify([{ connectionId: id(3), platform: "instagram", settings: { shareToFeed: true } }]), plannedConnectionIds: id(3) } });
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to service_role,anon,authenticated;
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,job_type text,project_id text,idempotency_key text,
      input_json jsonb,status text default 'queued',claim_token uuid,unique(user_id,job_type,idempotency_key));
    create table media_assets(id uuid primary key,user_id text,collection text,status text,deleted_at timestamptz,source_type text,mime_type text,
      source_record_id text,parent_asset_id uuid,project_id text,title text,storage_key text,url text,ratio text,duration_seconds numeric,file_size_bytes bigint,width integer,height integer,metadata jsonb);
    insert into media_assets(id,user_id,collection,status,mime_type) values('${id(1)}','owner-a','video','ready','video/mp4'),
      ('${id(2)}','owner-a','video','ready','video/mp4'),('${id(4)}','owner-b','audio','ready','audio/mpeg');
    create table scheduled_posts(id uuid primary key default gen_random_uuid(),user_id text,caption text,title text,timezone text,
      scheduled_for timestamptz,source_kind text,status text,media_asset_id uuid references media_assets(id),library_item_id uuid,project_id text,idempotency_key text,
      metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),unique(user_id,idempotency_key),
      check(source_kind='media_asset' and media_asset_id is not null and library_item_id is null));
    create table scheduled_post_targets(id uuid primary key,scheduled_post_id uuid);
    create table social_connections(id uuid primary key,user_id text,platform text,status text,revoked_at timestamptz);
    insert into social_connections values('${id(3)}','owner-a','instagram','connected',null);
    create function create_or_get_background_job_v1(p_key text,p_input jsonb,p_reference text,p_type text,p_attempts int,p_project text,p_queue text,p_user text)
    returns jsonb language plpgsql as $$ declare j public.background_jobs; begin
      insert into public.background_jobs(user_id,job_type,project_id,idempotency_key,input_json) values(p_user,p_type,p_project,p_key,p_input) returning * into j;
      return jsonb_build_object('created',true,'job',to_jsonb(j)); end; $$;
    create function claim_video_render_execution_slot(uuid,uuid,integer) returns boolean language plpgsql security definer as $$ begin
      return exists(select 1 from public.background_jobs where job_type in ('render_edit_video','final_render')); end; $$;
    grant select,insert,update on media_assets,background_jobs,scheduled_posts,scheduled_post_targets,social_connections to service_role;
    grant execute on function create_or_get_background_job_v1(text,jsonb,text,text,int,text,text,text) to service_role;`);
  await db.exec(finishing); await db.exec(sources); await db.exec(migration);
  const { rows } = await db.query(`select has_table_privilege('anon','explore_video_schedules','SELECT') as browser_read,
    has_table_privilege('authenticated','explore_video_schedules','INSERT') as browser_write,
    has_table_privilege('service_role','explore_video_schedules','DELETE') as service_delete,
    has_table_privilege('service_role','explore_video_schedules','TRUNCATE') as service_truncate,
    has_table_privilege('service_role','explore_video_schedules','UPDATE') as service_update`);
  assert.deepEqual(rows[0], { browser_read: false, browser_write: false, service_delete: false, service_truncate: false, service_update: true });
  await db.exec("set role service_role");
  return db;
}
async function reserve(db, key = id(10), owner = "owner-a", rawDraft = draft(), rawSchedule = schedule(), rawHash = hash) {
  return (await db.query("select explore_reserve_video_schedule($1,$2,$3,$4,$5::jsonb,$6::jsonb) result", [owner, key, rawHash, fingerprint, JSON.stringify(rawDraft), JSON.stringify(rawSchedule)])).rows[0].result;
}
test("atomic acceptance saves one finishing job, exact schedule details and outbox without publish targets", async () => {
  const db = await fixture(); try {
    const binding = await reserve(db), post = (await db.query("select * from scheduled_posts")).rows[0];
    assert.equal(binding.state, "pending"); assert.equal(post.status, "draft"); assert.equal(post.media_asset_id, id(1));
    assert.equal(post.caption, "Exact caption"); assert.equal(post.timezone, "Asia/Calcutta");
    assert.equal(post.metadata.exploreFinishRequestKey, id(10)); assert.equal(post.metadata.exploreFinishStatus, "preparing");
    assert.equal(post.metadata.plannedTargetsJson, schedule().metadata.plannedTargetsJson);
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from scheduled_post_targets")).rows[0].n, 0);
  } finally { await db.close(); }
});
test("same identity replays once, conflicting inputs reject, and cancellation never recreates the post", async () => {
  const db = await fixture(); try {
    const first = await reserve(db); assert.deepEqual(await reserve(db), first);
    await assert.rejects(reserve(db, id(10), "owner-a", draft(), schedule(), "c".repeat(64)), /explore_schedule_conflict/);
    await db.query("update scheduled_posts set status='cancelled' where id=$1", [first.schedule_id]);
    assert.equal((await reserve(db)).schedule_id, first.schedule_id);
    assert.equal((await db.query("select count(*)::int n from scheduled_posts")).rows[0].n, 1);
  } finally { await db.close(); }
});
test("nested audio owned by another user rolls back job, receipt, schedule and outbox", async () => {
  const db = await fixture(); try {
    const value = draft(); value.composition.sourceAudioAssetId = id(4);
    await assert.rejects(reserve(db, id(10), "owner-a", value), /explore_finish_asset_unavailable/);
    for (const table of ["background_jobs", "explore_video_finishes", "scheduled_posts", "explore_video_schedules"]) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
  } finally { await db.close(); }
});
test("owner mismatch, removed sources and expired deadlines cannot be accepted", async () => {
  const db = await fixture(); try {
    // The foreign connected account is rejected before any source reservation.
    await assert.rejects(reserve(db, id(10), "owner-b"), /explore_schedule_account_unavailable/);
    const expired = schedule(); expired.scheduledFor = "2000-01-01T00:00:00Z";
    await assert.rejects(reserve(db, id(10), "owner-a", draft(), expired), /explore_schedule_invalid/);
    await db.query("update media_assets set deleted_at=now() where id=$1", [id(2)]);
    await assert.rejects(reserve(db), /explore_finish_asset_unavailable/);
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n, 0);
  } finally { await db.close(); }
});
test("a recovery lease serializes duplicate callbacks and expired leases recover", async () => {
  const db = await fixture(); try {
    await reserve(db);
    const claim = async token => (await db.query("select explore_claim_video_schedule($1,$2,$3) result", ["owner-a", id(10), token])).rows[0].result;
    assert.equal((await claim(id(20))).lease_token, id(20)); assert.equal(await claim(id(21)), null);
    await db.exec("update explore_video_schedules set lease_until=now()-interval '1 second'");
    assert.equal((await claim(id(21))).lease_token, id(21));
    await db.exec("update explore_video_schedules set state='scheduled',lease_until=null");
    assert.equal(await claim(id(22)), null);
  } finally { await db.close(); }
});
test("browser roles cannot read or invoke pending schedule reservation", async () => {
  const db = await fixture(); try {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(db.query("select * from explore_video_schedules"), /permission denied/);
      await assert.rejects(reserve(db), /permission denied/);
    }
  } finally { await db.close(); }
});

test("transactional failure preserves cancellation, stored publishing targets and lease ownership", async () => {
  const db = await fixture(); try {
    const binding = await reserve(db);
    const claim = () => db.query("select explore_claim_video_schedule($1,$2,$3)", ["owner-a", id(10), id(20)]);
    const fail = () => db.query("select explore_fail_video_schedule($1,$2,$3,$4,$5) result", ["owner-a", id(10), id(20), "render_failed", "Video preparation failed"]);
    await claim();
    await db.query("update scheduled_posts set status='cancelled' where id=$1", [binding.schedule_id]);
    assert.equal((await fail()).rows[0].result.state, "cancelled");
    assert.equal((await db.query("select status from scheduled_posts")).rows[0].status, "cancelled");
    await assert.rejects(fail(), /explore_schedule_lease_lost/);

    await db.exec("update explore_video_schedules set state='pending'; update scheduled_posts set status='scheduling'");
    await db.query("insert into scheduled_post_targets(id,scheduled_post_id) values($1,$2)", [id(21), binding.schedule_id]);
    await claim(); await fail();
    assert.equal((await db.query("select status from scheduled_posts")).rows[0].status, "scheduling");
    assert.equal((await db.query("select count(*)::int n from scheduled_post_targets")).rows[0].n, 1);

    await db.exec("reset role; delete from scheduled_post_targets; set role service_role; update explore_video_schedules set state='pending'; update scheduled_posts set status='draft'");
    await claim(); await fail();
    const post = (await db.query("select status,metadata from scheduled_posts")).rows[0];
    assert.equal(post.status, "failed"); assert.equal(post.metadata.finalScheduleErrorCode, "render_failed");
  } finally { await db.close(); }
});
