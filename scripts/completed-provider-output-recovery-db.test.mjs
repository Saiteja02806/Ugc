import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261020150800_recover_completed_provider_output.sql", import.meta.url), "utf8");
const id = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table background_jobs (id uuid primary key, user_id text, job_type text, status text,
      error_code text, input_json jsonb, idempotency_key text, attempt_count int,
      max_attempts int check (max_attempts between 1 and 20),
      stage text, progress int, error_message text, failed_at timestamptz, completed_at timestamptz,
      cancel_requested_at timestamptz, queued_at timestamptz, next_attempt_at timestamptz,
      queue_message_id text, last_delivery_at timestamptz, last_heartbeat_at timestamptz,
      locked_at timestamptz, claim_token uuid, worker_id text, worker_execution_id text, updated_at timestamptz);
    create table generation_provider_operations (job_id uuid, operation_key text, provider text,
      status text, provider_operation_id text, request_fingerprint text);
    create table billing_credit_reservations (user_id text, idempotency_key text, job_type text,
      background_job_id uuid, status text, amount int);
    create table fixture_events (kind text);
    create table background_job_events (job_id uuid, event_type text);
    create function append_background_job_event(uuid,text,jsonb) returns void language sql as
      'insert into fixture_events values ($2); insert into background_job_events values ($1,$2)';
    create function settle_billing_from_background_job() returns trigger language plpgsql as $$
      begin if new.status in ('completed','failed','cancelled') and old.status is distinct from new.status
        then insert into fixture_events values ('billed'); end if; return new; end $$;
    create trigger settle_billing_background_job_trigger after update of status on background_jobs
      for each row execute function settle_billing_from_background_job();
    insert into background_jobs (id,user_id,job_type,status,error_code,input_json,idempotency_key,attempt_count,max_attempts)
      values ('${id}','owner','generate_hook_video','failed','PROVIDER_OUTPUT_COLLECTION_FAILED',
      '{"userId":"owner","provider":"reapi","model":"seedance_2_5"}','original',3,3);
    insert into generation_provider_operations values ('${id}','primary-reapi','reapi','provider_succeeded','saved-task','same-fingerprint');
    insert into billing_credit_reservations values ('owner','original','generate_hook_video','${id}','released',16);`);
  await db.exec(migration);
  return db;
}
const recover = db => db.query("select * from recover_completed_provider_output($1,$2)", [id, "owner"]);

test("exhausted collection recovery preserves identity, task, fingerprint and released credits; one bounded pass", async () => {
  const db = await fixture();
  try {
    assert.equal((await db.query("select * from recover_completed_provider_output($1,$2)", [id, "other-owner"])).rows.length, 0);
    const beforeOperation = (await db.query("select * from generation_provider_operations")).rows;
    const beforeBilling = (await db.query("select * from billing_credit_reservations")).rows;
    const { rows: [job] } = await recover(db);
    assert.equal(job.status, "queued"); assert.equal(job.attempt_count, 3); assert.equal(job.max_attempts, 4);
    assert.equal(job.input_json.providerOutputRecovery, "collection-only-v1");
    assert.deepEqual((await db.query("select * from generation_provider_operations")).rows, beforeOperation);
    await db.exec(`update background_jobs set status='completed' where id='${id}'`);
    assert.deepEqual((await db.query("select * from billing_credit_reservations")).rows, beforeBilling);
    assert.deepEqual((await db.query("select kind from fixture_events")).rows.map(x => x.kind), ["completed_provider_output_recovery"]);
    await db.exec(`update background_jobs set status='failed',error_code='PROVIDER_OUTPUT_COLLECTION_FAILED' where id='${id}'`);
    await assert.rejects(recover(db), /completed_output_recovery_not_allowed/);
  } finally { await db.close(); }
});

test("recovery refuses incomplete, uncertain or unowned task state and unsettled billing", async () => {
  for (const patch of [
    "update generation_provider_operations set status='submitted'",
    "update generation_provider_operations set provider_operation_id=null",
    "update generation_provider_operations set provider='openrouter'",
    "delete from generation_provider_operations",
    "update billing_credit_reservations set status='reserved'",
    "update billing_credit_reservations set background_job_id=null",
    "update background_jobs set error_code='provider_submission_uncertain'",
    "update background_jobs set job_type='generate_image'",
    `update background_jobs set input_json=input_json || '{"userId":"other"}'`,
  ]) {
    const db = await fixture();
    try {
      await db.exec(patch); await assert.rejects(recover(db));
      assert.equal((await db.query("select status from background_jobs")).rows[0].status, "failed");
    } finally { await db.close(); }
  }
});

test("unexhausted recovery is also complimentary; ordinary jobs still settle; RPC is service-only", async () => {
  const db = await fixture();
  try {
    await db.exec("update background_jobs set attempt_count=1");
    const { rows: [job] } = await recover(db);
    assert.equal(job.max_attempts, 2);
    await db.exec("set role authenticated");
    await assert.rejects(recover(db), /permission denied/);
    await db.exec("reset role");
    await db.exec(`update background_jobs set input_json=input_json - 'providerOutputRecovery',status='completed'`);
    assert.ok((await db.query("select kind from fixture_events")).rows.some(row => row.kind === "billed"));
    await db.exec("delete from fixture_events; delete from background_job_events");
    await db.exec(`update background_jobs set input_json=input_json || '{"providerOutputRecovery":"collection-only-v1"}',status='failed'`);
    assert.ok((await db.query("select kind from fixture_events")).rows.some(row => row.kind === "billed"), "a marker without the locked RPC's event cannot bypass billing");
  } finally { await db.close(); }
});

test("the final legal attempt budget is recoverable; the maximum boundary rejects without changing state", async () => {
  const db = await fixture();
  try {
    await db.exec("update background_jobs set attempt_count=19,max_attempts=20");
    assert.equal((await recover(db)).rows[0].max_attempts, 20);
    await db.exec("update background_jobs set status='failed',attempt_count=20,input_json=input_json - 'providerOutputRecovery'");
    await assert.rejects(recover(db), /completed_output_recovery_not_allowed/);
    const { rows: [job] } = await db.query("select * from background_jobs");
    assert.equal(job.status, "failed"); assert.equal(job.max_attempts, 20);
    assert.equal(job.input_json.providerOutputRecovery, undefined);
  } finally { await db.close(); }
});
