import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const paidMigration = readMigration("20260910105839_add_complimentary_plan_grants");
const baseline = readMigration("20260829093001_production_baseline_v1");
const functionSQL = (source, name) => {
  const sql = source.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$function\\$\\s*;`, "iu"))?.[0];
  assert.ok(sql, `Missing real function ${name}`);
  return sql;
};

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table billing_webhook_events(webhook_id text primary key,event_type text,event_timestamp timestamptz,payload jsonb,status text default 'pending',processed_at timestamptz,error_message text);
    create table billing_customers(user_id text primary key,dodo_customer_id text,email text,updated_at timestamptz);
    create table billing_subscriptions(dodo_subscription_id text primary key,user_id text,dodo_customer_id text,product_id text,plan_key text,billing_interval text,status text,current_period_start timestamptz,current_period_end timestamptz,cancel_at_period_end boolean,cancelled_at timestamptz,last_event_at timestamptz,last_webhook_id text,metadata jsonb,updated_at timestamptz);
    create table user_subscription_plans(user_id text,plan_key text,is_active boolean,source text,updated_at timestamptz);
    create table billing_credit_balances(user_id text primary key,dodo_subscription_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,credit_cycle_anchor timestamptz,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table complimentary_plan_grants(id uuid primary key default gen_random_uuid(),user_id text,plan_key text,revoked_at timestamptz,expires_at timestamptz,granted_at timestamptz default now());
    create table complimentary_plan_credit_balances(grant_id uuid primary key,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,status text default 'queued',completed_at timestamptz,
      attempt_count int default 0,max_attempts int default 3,stage text,progress numeric,error_code text,error_message text,failed_at timestamptz,cancel_requested_at timestamptz,queued_at timestamptz,next_attempt_at timestamptz,
      queue_message_id text,last_delivery_at timestamptz,last_heartbeat_at timestamptz,locked_at timestamptz,claim_token uuid,worker_id text,worker_execution_id text,updated_at timestamptz default now());
    create table background_job_events(id uuid primary key default gen_random_uuid(),job_id uuid,event_type text,metadata jsonb);
    create table billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount int check(amount>0),credit_period_start timestamptz,complimentary_plan_grant_id uuid,status text default 'reserved',background_job_id uuid,settled_at timestamptz,updated_at timestamptz default now(),unique(user_id,idempotency_key));
    create table billing_usage_outbox(event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,generation_kind text,credit_cost int,occurred_at timestamptz);
    grant select,insert,update on billing_credit_reservations,billing_subscriptions,complimentary_plan_grants to service_role;
  `);
  await db.exec(functionSQL(baseline, "resolve_billing_credit_cycle"));
  await db.exec(functionSQL(baseline, "normalize_billing_credit_cycle"));
  await db.exec(functionSQL(baseline, "append_background_job_event"));
  await db.exec(functionSQL(paidMigration, "reserve_billing_credits"));
  await db.exec(functionSQL(paidMigration, "settle_billing_credit_reservation"));
  await db.exec(functionSQL(paidMigration, "settle_billing_from_background_job"));
  await db.exec(readMigration("20261003110411_one_time_free_generation_credits"));
  await db.exec(readMigration("20261003114017_fund_generation_job_retries"));
  await db.exec(`
    create trigger normalize_cycle before insert or update on billing_credit_balances for each row execute function normalize_billing_credit_cycle();
    create trigger settle_billing after update on background_jobs for each row execute function settle_billing_from_background_job();
  `);
  return db;
}
const reserve = (db, key, amount = 1, user = "free-user") => db.query("select reserve_billing_credits($1,$2,'generate_image',$3) result", [user, key, amount]);
const job = async (db, key, user = "free-user") => (await db.query("insert into background_jobs(user_id,idempotency_key,job_type) values($1,$2,'generate_image') returning id", [user, key])).rows[0].id;
const transition = (db, id, status) => db.query("update background_jobs set status=$2 where id=$1", [id, status]);
const retry = (db, id, user = "free-user") => db.query("select * from retry_background_job($1,$2)", [id, user]);
const reservation = async (db, key, user = "free-user") => (await db.query("select * from billing_credit_reservations where user_id=$1 and idempotency_key=$2", [user, key])).rows[0];
const freeBalance = async (db) => (await db.query("select * from free_generation_credit_balances where user_id='free-user'")).rows[0];
const paidBalance = async (db) => (await db.query("select * from billing_credit_balances where user_id='paid-user'")).rows[0];
const compBalance = async (db) => (await db.query("select * from complimentary_plan_credit_balances")).rows[0];
async function paid(db, limit = 2) {
  await db.exec(`insert into billing_subscriptions(dodo_subscription_id,user_id,plan_key,status,current_period_start,last_event_at)
    values('paid-sub','paid-user','starter','active',now()-interval '2 days',now());
    insert into billing_credit_balances(user_id,dodo_subscription_id,plan_key,credit_limit) values('paid-user','paid-sub','starter',${limit});`);
}
async function complimentary(db, limit = 2) {
  const id = (await db.query("insert into complimentary_plan_grants(user_id,plan_key) values('comp-user','growth') returning id")).rows[0].id;
  await db.query("insert into complimentary_plan_credit_balances(grant_id,credit_limit,period_start,period_end) values($1,$2,date_trunc('month',now()),date_trunc('month',now())+interval '1 month')", [id, limit]);
  return id;
}

test("a refunded free job cannot retry after its two credits fund other jobs", async () => {
  const db = await fixture();
  try {
    await reserve(db, "failed");
    const id = await job(db, "failed");
    await transition(db, id, "failed");
    await reserve(db, "other-one"); await reserve(db, "other-two");
    await assert.rejects(retry(db, id), /insufficient_billing_credits/u);
    assert.equal((await freeBalance(db)).reserved_credits, 2);
    assert.equal((await reservation(db, "failed")).status, "released");
    assert.equal((await db.query("select status from background_jobs where id=$1", [id])).rows[0].status, "failed");
    assert.equal((await db.query("select count(*)::int count from background_job_events")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("a funded free retry commits exactly once and never produces Dodo usage", async () => {
  const db = await fixture();
  try {
    await db.exec("insert into billing_customers values('free-user','old-paid-customer',null,now())");
    await reserve(db, "retry"); const id = await job(db, "retry");
    await transition(db, id, "failed");
    assert.equal((await freeBalance(db)).reserved_credits, 0);
    assert.equal((await retry(db, id)).rows[0].status, "queued");
    assert.equal((await freeBalance(db)).reserved_credits, 1);
    assert.equal((await reservation(db, "retry")).settled_at, null);
    await transition(db, id, "completed"); await transition(db, id, "completed");
    const balance = await freeBalance(db);
    assert.equal(balance.used_credits, 1); assert.equal(balance.reserved_credits, 0);
    assert.equal((await reservation(db, "retry")).status, "committed");
    assert.equal((await db.query("select count(*)::int count from billing_usage_outbox")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("dispatch failure after a funded retry refunds once; concurrent retries do not double-reserve", async () => {
  const db = await fixture();
  try {
    await reserve(db, "dispatch"); const id = await job(db, "dispatch");
    await transition(db, id, "failed");
    const results = await Promise.allSettled([retry(db, id), retry(db, id)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await freeBalance(db)).reserved_credits, 1);
    await transition(db, id, "failed"); await transition(db, id, "failed");
    assert.equal((await freeBalance(db)).reserved_credits, 0);
    assert.equal((await freeBalance(db)).used_credits, 0);
    assert.equal((await db.query("select count(*)::int count from background_job_events")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("stalled funded jobs keep one reservation and separate failed retries contend for the same lifetime budget", async () => {
  const db = await fixture();
  try {
    await reserve(db, "stalled"); const stalled = await job(db, "stalled");
    await transition(db, stalled, "stalled"); await retry(db, stalled);
    assert.equal((await freeBalance(db)).reserved_credits, 1);
    const failed = [];
    for (const key of ["first", "second"]) {
      await reserve(db, key); const id = await job(db, key);
      await transition(db, id, "failed"); failed.push(id);
    }
    const results = await Promise.allSettled(failed.map((id) => retry(db, id)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await freeBalance(db)).reserved_credits, 2);
  } finally { await db.close(); }
});

test("owner, status, attempt, committed reservation and browser permission guards remain intact", async () => {
  const db = await fixture();
  try {
    await reserve(db, "guards"); const id = await job(db, "guards");
    assert.equal((await retry(db, id, "other-user")).rows.length, 0);
    await assert.rejects(retry(db, id), /not retryable/u);
    await transition(db, id, "failed");
    await db.query("update background_jobs set attempt_count=max_attempts where id=$1", [id]);
    await assert.rejects(retry(db, id), /maximum attempts/u);
    await db.query("update background_jobs set attempt_count=1 where id=$1", [id]);
    await db.query("update billing_credit_reservations set status='committed' where idempotency_key='guards'");
    await assert.rejects(retry(db, id), /billing_retry_already_committed/u);
    await db.query("update billing_credit_reservations set status='released',job_type='generate_hook_video' where idempotency_key='guards'");
    await assert.rejects(retry(db, id), /billing_retry_reservation_conflict/u);
    const privileges = (await db.query("select has_function_privilege('anon','retry_background_job(uuid,text)','execute') anon,has_function_privilege('authenticated','retry_background_job(uuid,text)','execute') authenticated,has_function_privilege('service_role','retry_background_job(uuid,text)','execute') service")).rows[0];
    assert.deepEqual(privileges, { anon: false, authenticated: false, service: true });
  } finally { await db.close(); }
});

test("paid retries reserve refunded monthly credits and reject overspending or inactive ownership", async () => {
  const db = await fixture();
  try {
    await paid(db);
    await reserve(db, "retry", 1, "paid-user"); const id = await job(db, "retry", "paid-user");
    await transition(db, id, "failed");
    await reserve(db, "spent", 2, "paid-user"); const spent = await job(db, "spent", "paid-user");
    await transition(db, spent, "completed");
    await assert.rejects(retry(db, id, "paid-user"), /insufficient_billing_credits/u);
    assert.equal((await paidBalance(db)).used_credits, 2);
    assert.equal((await paidBalance(db)).reserved_credits, 0);
    await db.exec("update billing_credit_balances set credit_limit=3; update billing_subscriptions set status='on_hold'");
    await assert.rejects(retry(db, id, "paid-user"), /paid_subscription_required/u);
    await db.exec("update billing_subscriptions set status='active'");
    await retry(db, id, "paid-user");
    assert.equal((await paidBalance(db)).reserved_credits, 1);
    await transition(db, id, "completed");
    assert.equal((await paidBalance(db)).used_credits, 3);
    assert.equal((await paidBalance(db)).reserved_credits, 0);
  } finally { await db.close(); }
});

test("paid stalled retries preserve same-cycle funding and fund an anniversary rollover exactly once", async () => {
  const db = await fixture();
  try {
    await paid(db);
    await reserve(db, "stalled", 1, "paid-user"); const id = await job(db, "stalled", "paid-user");
    await transition(db, id, "stalled"); await retry(db, id, "paid-user");
    assert.equal((await paidBalance(db)).reserved_credits, 1);
    await transition(db, id, "stalled");
    // Move the recorded cycle back while retaining the real deployed normalizer.
    await db.exec("alter table billing_credit_balances disable trigger normalize_cycle; update billing_credit_balances set credit_cycle_anchor=now()-interval '2 months 2 days',period_start=now()-interval '1 month 2 days',period_end=now()-interval '2 days'; alter table billing_credit_balances enable trigger normalize_cycle;");
    await db.exec("update billing_credit_reservations set credit_period_start=(select period_start from billing_credit_balances)");
    await retry(db, id, "paid-user");
    const current = await paidBalance(db);
    assert.equal(current.reserved_credits, 1); assert.equal(current.used_credits, 0);
    assert.equal((await reservation(db, "stalled", "paid-user")).credit_period_start.getTime(), current.period_start.getTime());
    await transition(db, id, "stalled"); await retry(db, id, "paid-user");
    assert.equal((await paidBalance(db)).reserved_credits, 1);
    await transition(db, id, "completed");
    assert.equal((await paidBalance(db)).used_credits, 1);
  } finally { await db.close(); }
});

test("complimentary retries retain their original grant and fail when revoked, expired, or out of credits", async () => {
  const db = await fixture();
  try {
    const grant = await complimentary(db);
    await reserve(db, "retry", 1, "comp-user"); const id = await job(db, "retry", "comp-user");
    await transition(db, id, "failed");
    await db.query("update complimentary_plan_grants set revoked_at=now() where id=$1", [grant]);
    await assert.rejects(retry(db, id, "comp-user"), /complimentary_generation_access_required/u);
    await db.query("update complimentary_plan_grants set revoked_at=null,expires_at=now()-interval '1 second' where id=$1", [grant]);
    await assert.rejects(retry(db, id, "comp-user"), /complimentary_generation_access_required/u);
    await db.query("update complimentary_plan_grants set expires_at=null where id=$1", [grant]);
    await reserve(db, "other", 2, "comp-user");
    await assert.rejects(retry(db, id, "comp-user"), /insufficient_billing_credits/u);
    await db.query("select settle_billing_credit_reservation('comp-user','other',null,false)");
    await retry(db, id, "comp-user"); await transition(db, id, "completed");
    assert.equal((await compBalance(db)).used_credits, 1);
    assert.equal((await compBalance(db)).reserved_credits, 0);
    assert.equal((await reservation(db, "retry", "comp-user")).complimentary_plan_grant_id, grant);
    assert.equal((await db.query("select count(*)::int count from free_generation_credit_balances")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("complimentary rollover re-funds stale stalled reservations once; unbilled jobs retain existing retry behavior", async () => {
  const db = await fixture();
  try {
    await complimentary(db);
    await reserve(db, "stalled", 1, "comp-user"); const id = await job(db, "stalled", "comp-user");
    await transition(db, id, "stalled");
    await db.exec("update complimentary_plan_credit_balances set period_start=date_trunc('month',now())-interval '1 month',period_end=date_trunc('month',now()); update billing_credit_reservations set credit_period_start=(select period_start from complimentary_plan_credit_balances)");
    await retry(db, id, "comp-user");
    assert.equal((await compBalance(db)).reserved_credits, 1);
    await transition(db, id, "stalled"); await retry(db, id, "comp-user");
    assert.equal((await compBalance(db)).reserved_credits, 1);
    await transition(db, id, "completed");
    assert.equal((await compBalance(db)).used_credits, 1);
    const unbilled = await job(db, "free-character", "unbilled-user");
    await transition(db, unbilled, "failed");
    assert.equal((await retry(db, unbilled, "unbilled-user")).rows[0].status, "queued");
  } finally { await db.close(); }
});
