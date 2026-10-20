import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261017105341_social_publish_terminal_status_and_tiktok_retry.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function fixture(apply = true) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table background_jobs(id uuid primary key, user_id text, job_type text default 'publish_social_post',
      status text default 'processing', error_code text, error_message text, input_json jsonb);
    create table scheduled_posts(id uuid primary key, user_id text, status text default 'publishing',
      scheduled_for timestamptz default '2026-10-17T05:40:00Z', last_error_code text, published_at timestamptz, updated_at timestamptz);
    create table scheduled_post_targets(id uuid primary key, user_id text, scheduled_post_id uuid references scheduled_posts(id),
      publish_job_id uuid references background_jobs(id), platform text default 'tiktok', status text default 'publishing',
      scheduled_for timestamptz default '2026-10-17T05:40:00Z', platform_post_id text, published_at timestamptz,
      next_retry_at timestamptz default '2026-10-17T05:46:11Z', last_error_code text, last_error_message text,
      last_reconciled_at timestamptz, updated_at timestamptz);
    create table social_publish_operations(id uuid primary key, user_id text, scheduled_post_target_id uuid references scheduled_post_targets(id),
      status text default 'initialized', platform text default 'tiktok', provider_operation_id text default 'failed-tiktok-id',
      provider_operation_kind text default 'tiktok_publish', platform_post_id text, published_at timestamptz,
      last_error_code text default 'tiktok_file_format_check_failed', last_error_message text,
      active_job_id uuid, active_claim_token uuid, metadata jsonb default '{}', updated_at timestamptz);
    grant select, insert, update on all tables in schema public to service_role;
    insert into background_jobs(id,user_id,error_code,error_message,input_json)
      values('${id(1)}','owner','tiktok_file_format_check_failed','TikTok could not publish this video. Try again.','{"targetId":"${id(3)}"}');
    insert into scheduled_posts(id,user_id) values('${id(2)}','owner');
    insert into scheduled_post_targets(id,user_id,scheduled_post_id,publish_job_id,last_error_code)
      values('${id(3)}','owner','${id(2)}','${id(1)}','tiktok_file_format_check_failed');
    insert into social_publish_operations(id,user_id,scheduled_post_target_id)
      values('${id(4)}','owner','${id(3)}');`);
  if (apply) await db.exec(migration);
  return db;
}
async function state(db) {
  return (await db.query(`select t.status,t.next_retry_at,t.last_error_message,t.scheduled_for,
    p.status as parent_status,p.scheduled_for as parent_time from scheduled_post_targets t
    join scheduled_posts p on p.id=t.scheduled_post_id where t.id='${id(3)}'`)).rows[0];
}
const fail = db => db.exec(`update background_jobs set status='failed' where id='${id(1)}'`);

test("a terminal job atomically clears the impossible retry and settles target and parent", async () => {
  const db = await fixture(); try {
    await db.exec("set role service_role");
    await fail(db);
    const saved = await state(db);
    assert.equal(saved.status, "failed"); assert.equal(saved.parent_status, "failed");
    assert.equal(saved.next_retry_at, null);
    assert.match(saved.last_error_message, /media format/);
    assert.equal(saved.scheduled_for.toISOString(), "2026-10-17T05:40:00.000Z");
    assert.deepEqual(saved.parent_time, saved.scheduled_for);
    assert.equal((await db.query("select count(*)::int as count from background_jobs")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("migration repairs historical stale projections without retrying or moving the schedule", async () => {
  const db = await fixture(false); try {
    await fail(db); assert.equal((await state(db)).status, "publishing");
    await db.exec(migration);
    assert.equal((await state(db)).status, "failed");
    assert.equal((await state(db)).parent_time.toISOString(), "2026-10-17T05:40:00.000Z");
    assert.equal((await db.query("select status from background_jobs")).rows[0].status, "failed");
    assert.equal((await db.query("select provider_operation_id from social_publish_operations")).rows[0].provider_operation_id, "failed-tiktok-id");
  } finally { await db.close(); }
});

test("failure projection protects receipts, cancellations, owner/payload mismatches and replacement jobs", async () => {
  const changes = [
    "update social_publish_operations set status='published',platform_post_id='accepted'",
    "update social_publish_operations set platform_post_id='accepted'",
    "update scheduled_post_targets set status='published',platform_post_id='accepted'",
    "update scheduled_posts set status='cancelled'",
    "update scheduled_post_targets set status='cancelled'",
    "update scheduled_post_targets set status='action_required'",
    "update background_jobs set user_id='another-owner'",
    "update scheduled_posts set user_id='another-owner'",
    "update background_jobs set input_json='{}'",
    "update background_jobs set job_type='render_edit_video'",
    `insert into background_jobs(id,user_id) values('${id(8)}','owner'); update scheduled_post_targets set publish_job_id='${id(8)}'`,
  ];
  const db = await fixture(); try {
    for (const change of changes) {
      await db.exec("begin");
      await db.exec(change); const before = await state(db);
      await fail(db); assert.deepEqual(await state(db), before, change);
      await db.exec("rollback");
    }
  } finally { await db.close(); }
});

test("one failed account preserves sibling publications and reports partial failure", async () => {
  const db = await fixture(); try {
    await db.exec(`insert into scheduled_post_targets(id,user_id,scheduled_post_id,status,platform_post_id)
      values('${id(9)}','owner','${id(2)}','published','accepted-sibling');`);
    await fail(db);
    assert.equal((await state(db)).parent_status, "partially_failed");
    assert.equal((await db.query(`select status,platform_post_id from scheduled_post_targets where id='${id(9)}'`)).rows[0].platform_post_id, "accepted-sibling");
  } finally { await db.close(); }
});

test("a genuine manual retry clears only an inactive, format-rejected TikTok operation", async () => {
  const db = await fixture(); try {
    await fail(db);
    await db.exec(`insert into background_jobs(id,user_id,status,input_json)
      values('${id(8)}','owner','queued','{"targetId":"${id(3)}"}');`);
    const guards = [
      "update social_publish_operations set active_claim_token=gen_random_uuid()",
      `update social_publish_operations set active_job_id='${id(1)}'`,
      "update social_publish_operations set status='published',platform_post_id='accepted'",
      "update social_publish_operations set platform_post_id='accepted'",
      "update social_publish_operations set last_error_code='some_other_error'",
      `update background_jobs set user_id='another-owner' where id='${id(8)}'`,
      `update background_jobs set input_json='{}' where id='${id(8)}'`,
      `update background_jobs set status='processing' where id='${id(8)}'`,
    ];
    for (const guard of guards) {
      await db.exec("begin"); await db.exec(guard);
      await db.exec(`update scheduled_post_targets set status='scheduled',publish_job_id='${id(8)}'`);
      assert.equal((await db.query("select provider_operation_id from social_publish_operations")).rows[0].provider_operation_id, "failed-tiktok-id", guard);
      await db.exec("rollback");
    }
    // Merely changing status on the old job is insufficient.
    await db.exec("begin; update scheduled_post_targets set status='scheduled'");
    assert.equal((await db.query("select provider_operation_id from social_publish_operations")).rows[0].provider_operation_id, "failed-tiktok-id");
    await db.exec("rollback; set role service_role");
    await db.exec(`update scheduled_post_targets set status='scheduled',publish_job_id='${id(8)}'`);
    const operation = (await db.query("select * from social_publish_operations")).rows[0];
    assert.equal(operation.provider_operation_id, null); assert.equal(operation.status, "pending");
    assert.equal(operation.provider_operation_kind, null);
  } finally { await db.close(); }
});

test("new trigger functions do not grant browser roles publishing or table privileges", async () => {
  const db = await fixture(); try {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(fail(db), /permission denied/);
      await assert.rejects(db.query("select settle_failed_social_publish_job()"), /permission denied/);
      await db.exec("reset role");
    }
    const functions = await db.query("select prosecdef from pg_proc where proname in ('settle_failed_social_publish_job','reset_tiktok_format_failure_on_manual_retry')");
    assert.deepEqual(functions.rows.map(row => row.prosecdef), [false, false]);
  } finally { await db.close(); }
});
