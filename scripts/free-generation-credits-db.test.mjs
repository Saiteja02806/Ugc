import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261003110411_one_time_free_generation_credits.sql", import.meta.url), "utf8");
const paidMigration = readFileSync(new URL("../supabase/migrations/20260910105839_add_complimentary_plan_grants.sql", import.meta.url), "utf8");
const paidFunction = (name) => paidMigration.match(new RegExp(`create or replace function public\\.${name} \\([\\s\\S]*?\\$function\\$;`, "iu"))?.[0];
const triggerFunction = paidMigration.match(/create or replace function public\.settle_billing_from_background_job\(\)[\s\S]*?\$function\$;/iu)?.[0];

async function fixture() {
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
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,status text default 'queued',completed_at timestamptz);
    create table billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount int check(amount>0),credit_period_start timestamptz,complimentary_plan_grant_id uuid,status text default 'reserved',background_job_id uuid,settled_at timestamptz,updated_at timestamptz default now(),unique(user_id,idempotency_key));
    create table billing_usage_outbox(event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,generation_kind text,credit_cost int,occurred_at timestamptz);
    grant select,insert,update on billing_credit_reservations,billing_subscriptions,complimentary_plan_grants to service_role;
  `);
  await db.exec(paidFunction("reserve_billing_credits"));
  await db.exec(paidFunction("settle_billing_credit_reservation"));
  await db.exec(triggerFunction);
  await db.exec(migration);
  await db.exec("create trigger settle_billing after update on background_jobs for each row execute function settle_billing_from_background_job()");
  return db;
}
const reserve = (db, key, amount = 1, user = "free-user", kind = "generate_image") => db.query(
  "select reserve_billing_credits($1,$2,$3,$4) result", [user, key, kind, amount],
);
const grant = (db, user = "free-user") => db.query("select ensure_free_generation_credit_balance($1) result", [user]);
const settle = (db, key, commit = true, user = "free-user") => db.query(
  "select settle_billing_credit_reservation($1,$2,null,$3) result", [user, key, commit],
);
const balance = async (db, user = "free-user") => (await db.query("select * from free_generation_credit_balances where user_id=$1", [user])).rows[0];

test("two lifetime credits survive repeated grants, spending, expiry, and attempted over-reservation", async () => {
  const db = await fixture();
  try {
    assert.deepEqual((await grant(db)).rows[0].result, { granted: 2, remaining: 2, reserved: 0, used: 0 });
    const first = (await reserve(db, "first")).rows[0].result;
    assert.equal((await reserve(db, "first")).rows[0].result.reservationId, first.reservationId);
    assert.equal((await balance(db)).reserved_credits, 1);
    await reserve(db, "second");
    await assert.rejects(reserve(db, "third"), /insufficient_billing_credits/u);
    await settle(db, "first");
    assert.equal((await settle(db, "first")).rows[0].result, false);
    await settle(db, "second");
    await db.exec("update free_generation_credit_balances set granted_at=now()-interval '1 year'");
    assert.deepEqual((await grant(db)).rows[0].result, { granted: 2, remaining: 0, reserved: 0, used: 2 });
    await assert.rejects(reserve(db, "fourth"), /insufficient_billing_credits/u);
    assert.equal((await db.query("select count(*)::int count from free_generation_credit_balances")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("failed/cancelled jobs refund free credits exactly once and completed jobs never report Dodo usage", async () => {
  const db = await fixture();
  try {
    await db.exec("insert into billing_customers values('free-user','historical-live-customer',null,now())");
    for (const status of ["failed", "cancelled", "completed"]) {
      await reserve(db, status);
      await db.query("insert into background_jobs(user_id,idempotency_key,job_type) values('free-user',$1,'generate_image')", [status]);
      await db.query("update background_jobs set status=$1 where idempotency_key=$1", [status]);
      assert.equal((await settle(db, status, status === "completed")).rows[0].result, false);
    }
    const current = await balance(db);
    assert.equal(current.used_credits, 1);
    assert.equal(current.reserved_credits, 0);
    assert.equal((await db.query("select count(*)::int count from billing_usage_outbox")).rows[0].count, 0);
    await assert.rejects(reserve(db, "failed"), /billing_credit_reservation_released/u);
  } finally { await db.close(); }
});

test("concurrent keys cannot exceed the budget and replay cannot change free reservation cost or kind", async () => {
  const db = await fixture();
  try {
    await grant(db);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserve(db, "parallel-" + i)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal((await balance(db)).reserved_credits, 2);
    await assert.rejects(reserve(db, "parallel-0", 2), /billing_credit_idempotency_conflict/u);
    await assert.rejects(reserve(db, "parallel-0", 1, "free-user", "generate_hook_video"), /billing_credit_idempotency_conflict/u);
    await assert.rejects(reserve(db, "unsupported", 1, "other-user", "publish_social_post"), /invalid_free_generation_job_type/u);
    await assert.rejects(reserve(db, "null-cost", null), /invalid_billing_credit_reservation/u);
  } finally { await db.close(); }
});

test("paid and complimentary reservation sources retain their original budgets and reporting behavior", async () => {
  const db = await fixture();
  try {
    await db.exec(`
      insert into billing_subscriptions(dodo_subscription_id,user_id,plan_key,status,last_event_at) values('paid-sub','paid-user','starter','active',now());
      insert into billing_credit_balances values('paid-user','paid-sub','starter',200,10,0,now(),now()+interval '1 month',now());
      insert into billing_customers values('paid-user','paid-customer',null,now());
      insert into complimentary_plan_grants(id,user_id,plan_key) values('00000000-0000-0000-0000-000000000001','comp-user','growth');
      insert into complimentary_plan_credit_balances values('00000000-0000-0000-0000-000000000001',600,0,0,now(),now()+interval '1 month',now());
    `);
    await reserve(db, "paid-image", 1, "paid-user");
    await reserve(db, "comp-image", 1, "comp-user");
    for (const user of ["paid-user", "comp-user"]) {
      await db.query("insert into background_jobs(user_id,idempotency_key,job_type) values($1,$2,'generate_image')", [user, user === "paid-user" ? "paid-image" : "comp-image"]);
      await db.query("update background_jobs set status='completed' where user_id=$1", [user]);
    }
    assert.equal((await db.query("select used_credits from billing_credit_balances")).rows[0].used_credits, 11);
    assert.equal((await db.query("select used_credits from complimentary_plan_credit_balances")).rows[0].used_credits, 1);
    assert.equal((await db.query("select count(*)::int count from billing_usage_outbox")).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::int count from free_generation_credit_balances")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("subscription changes cannot erase an outstanding free reservation or its lifetime accounting", async () => {
  const db = await fixture();
  try {
    await reserve(db, "free-before-paid");
    const apply = (id, subscription, status, offset) => db.query(
      "select apply_dodo_subscription_event($1,$2,now()+($3::int*interval '1 second'),'free-user','customer',null,$4,'product','starter','monthly',$5,null,null,false,null,'{}','{}')",
      [id, "subscription." + status, offset, subscription, status],
    );
    await apply("active-new", "new-sub", "active", 0);
    await reserve(db, "paid-pending");
    await apply("cancel-old", "old-sub", "cancelled", 1);
    assert.equal((await db.query("select credit_limit from billing_credit_balances")).rows[0].credit_limit, 200);
    await apply("hold-current", "new-sub", "on_hold", 2);
    const reservations = (await db.query("select idempotency_key,status from billing_credit_reservations order by idempotency_key")).rows;
    assert.deepEqual(reservations, [{ idempotency_key: "free-before-paid", status: "reserved" }, { idempotency_key: "paid-pending", status: "released" }]);
    await settle(db, "free-before-paid");
    assert.equal((await balance(db)).used_credits, 1);
    assert.equal((await balance(db)).reserved_credits, 0);
    assert.equal((await db.query("select used_credits from billing_credit_balances")).rows[0].used_credits, 0);
  } finally { await db.close(); }
});

test("browser roles cannot claim credits or mutate ledgers through the Data API", async () => {
  const db = await fixture();
  try {
    for (const role of ["anon", "authenticated"]) {
      for (const signature of [
        "public.ensure_free_generation_credit_balance(text)",
        "public.reserve_billing_credits(text,text,text,integer)",
        "public.reserve_subscription_billing_credits(text,text,text,integer)",
        "public.settle_billing_credit_reservation(text,text,uuid,boolean)",
        "public.settle_subscription_billing_credit_reservation(text,text,uuid,boolean)",
      ]) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') permitted", [role, signature])).rows[0].permitted, false);
      }
      assert.equal((await db.query("select has_table_privilege($1,'public.free_generation_credit_balances','INSERT') permitted", [role])).rows[0].permitted, false);
    }
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='free_generation_credit_balances'")).rows[0].relrowsecurity, true);
    assert.equal((await db.query("select has_function_privilege('service_role','public.ensure_free_generation_credit_balance(text)','EXECUTE') permitted")).rows[0].permitted, true);
    await db.exec("set role service_role");
    assert.equal((await grant(db)).rows[0].result.remaining, 2);
    await reserve(db, "service-claim");
  } finally { await db.close(); }
});
