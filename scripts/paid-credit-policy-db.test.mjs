import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const baseline = read("20260829093001_production_baseline_v1.sql");
const startup = read("20261101233000_add_startup_billing_plan.sql");
const correction = read("20261103193000_correct_paid_plan_credit_allowances.sql");
function definition(source, name) {
  const result = source.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$function\\$;`, "i"))?.[0];
  assert.ok(result, `Missing actual SQL function ${name}`); return result;
}
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table billing_webhook_events(webhook_id text primary key,event_type text,event_timestamp timestamptz,payload jsonb,status text default 'pending',processed_at timestamptz,error_message text);
    create table billing_customers(user_id text primary key,dodo_customer_id text,email text,updated_at timestamptz);
    create table billing_subscriptions(dodo_subscription_id text primary key,user_id text,dodo_customer_id text,product_id text,plan_key text,billing_interval text,status text,current_period_start timestamptz,current_period_end timestamptz,cancel_at_period_end boolean,cancelled_at timestamptz,last_event_at timestamptz,last_webhook_id text,metadata jsonb,updated_at timestamptz);
    create table user_subscription_plans(user_id text,plan_key text,is_active boolean,source text,updated_at timestamptz);
    create table billing_credit_balances(user_id text primary key,dodo_subscription_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,credit_cycle_anchor timestamptz,updated_at timestamptz,check(used_credits+reserved_credits<=credit_limit));
    create table complimentary_plan_grants(id uuid primary key default gen_random_uuid(),user_id text,plan_key text,credit_limit int,reason text,granted_by_user_id text,revoked_at timestamptz,revoked_by_user_id text,revocation_reason text,expires_at timestamptz,granted_at timestamptz default now(),updated_at timestamptz);
    create table complimentary_plan_credit_balances(grant_id uuid primary key,user_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz,check(used_credits+reserved_credits<=credit_limit));
    create table billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount int check(amount>0),credit_period_start timestamptz,complimentary_plan_grant_id uuid,uses_free_generation_credits boolean default false,status text default 'reserved',settled_at timestamptz,updated_at timestamptz default now(),unique(user_id,idempotency_key));
  `);
  for (const name of ["resolve_billing_credit_cycle", "normalize_billing_credit_cycle", "refresh_billing_credit_balance"]) await db.exec(definition(baseline, name));
  for (const name of ["apply_dodo_subscription_event", "grant_complimentary_plan", "reserve_subscription_billing_credits"]) await db.exec(definition(startup, name));
  await db.exec("create trigger normalize_billing_credit_cycle_trigger before insert or update on billing_credit_balances for each row execute function normalize_billing_credit_cycle();");
  return db;
}
async function event(db, owner, plan, interval = "monthly", webhook = `${owner}-active`, status = "active", timestamp = new Date().toISOString()) {
  return db.query(`select apply_dodo_subscription_event($1,'subscription.active',$2::timestamptz,$3,$4,'fixture@example.invalid',$5,$6,$7,$8,$9,now()-interval '2 days',now()+interval '1 year',false,null,'{}','{}') as result`,
    [webhook, timestamp, owner, `customer-${owner}`, `subscription-${owner}`, `product-${plan}-${interval}`, plan, interval, status]);
}
const balance = async (db, owner) => (await db.query("select credit_limit,used_credits,reserved_credits from billing_credit_balances where user_id=$1", [owner])).rows[0];
const reserve = (db, owner, key, amount) => db.query("select reserve_subscription_billing_credits($1,$2,'generate_image',$3) as result", [owner, key, amount]);

test("new monthly and annual subscriptions receive merchant-confirmed credits with monthly cycles", async () => {
  const db = await fixture();
  try {
    await db.exec(correction);
    for (const [plan, credits] of [["starter", 200], ["growth", 600], ["startup", 1200]]) {
      for (const interval of ["monthly", "yearly"]) {
        const owner = `${plan}-${interval}`;
        await event(db, owner, plan, interval);
        assert.deepEqual(await balance(db, owner), { credit_limit: credits, used_credits: 0, reserved_credits: 0 });
        const cycle = (await db.query("select extract(epoch from period_end-period_start)/86400 as days from billing_credit_balances where user_id=$1", [owner])).rows[0];
        assert(Number(cycle.days) >= 28 && Number(cycle.days) <= 31);
        const first = (await reserve(db, owner, "same", credits)).rows[0].result;
        const replay = (await reserve(db, owner, "same", credits)).rows[0].result;
        assert.equal(first.reservationId, replay.reservationId);
        await assert.rejects(reserve(db, owner, "excess", 1), /insufficient_billing_credits/);
        assert.equal((await event(db, owner, plan, interval)).rows[0].result.duplicate, true);
        assert.equal((await balance(db, owner)).reserved_credits, credits);
      }
    }
    assert.equal((await db.query("select has_function_privilege('anon','public.paid_plan_monthly_credit_limit(text)','execute') as allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});

test("current-cycle usage and reservations survive correction and same-cycle webhooks; future rollover corrects limits", async () => {
  const db = await fixture();
  try {
    for (const [plan, inflated] of [["starter", 360], ["growth", 720], ["startup", 1800]]) {
      await event(db, plan, plan);
      await reserve(db, plan, "in-flight", 24);
      await db.query("update billing_credit_balances set used_credits=$2 where user_id=$1", [plan, inflated - 24]);
    }
    const before = (await db.query("select * from billing_credit_balances order by user_id")).rows;
    await db.exec(correction);
    assert.deepEqual((await db.query("select * from billing_credit_balances order by user_id")).rows, before);
    for (const [plan, inflated, corrected] of [["starter", 360, 200], ["growth", 720, 600], ["startup", 1800, 1200]]) {
      await event(db, plan, plan, "monthly", `${plan}-updated`);
      assert.deepEqual(await balance(db, plan), { credit_limit: inflated, used_credits: inflated - 24, reserved_credits: 24 });
      // Move time in the isolated fixture without invoking the UPDATE trigger.
      await db.exec("alter table billing_credit_balances disable trigger normalize_billing_credit_cycle_trigger;");
      await db.query("update billing_credit_balances set period_end=now()-interval '1 day',credit_cycle_anchor=now()-interval '2 months' where user_id=$1", [plan]);
      await db.exec("alter table billing_credit_balances enable trigger normalize_billing_credit_cycle_trigger;");
      await db.query("select refresh_billing_credit_balance($1)", [plan]);
      assert.deepEqual(await balance(db, plan), { credit_limit: corrected, used_credits: 0, reserved_credits: 0 });
      assert.equal((await db.query("select count(*)::int as count from billing_credit_reservations where user_id=$1", [plan])).rows[0].count, 1);
    }
  } finally { await db.close(); }
});

test("new complimentary grants use corrected allowances while existing grants and current cycles remain intact", async () => {
  const db = await fixture();
  try {
    await db.query("select grant_complimentary_plan('old-grant','startup','existing gift','admin',null)");
    await reserve(db, "old-grant", "accepted", 24);
    await db.exec(correction);
    assert.equal((await db.query("select credit_limit from complimentary_plan_grants where user_id='old-grant'")).rows[0].credit_limit, 1800);
    assert.equal((await db.query("select credit_limit from complimentary_plan_credit_balances where user_id='old-grant'")).rows[0].credit_limit, 1800);
    await db.exec("update complimentary_plan_credit_balances set period_end=now()-interval '1 day' where user_id='old-grant'");
    await reserve(db, "old-grant", "next-cycle", 12);
    assert.deepEqual((await db.query("select credit_limit,used_credits,reserved_credits from complimentary_plan_credit_balances where user_id='old-grant'")).rows[0], { credit_limit: 1200, used_credits: 0, reserved_credits: 12 });
    for (const [plan, credits] of [["starter", 200], ["growth", 600], ["startup", 1200]]) {
      const grant = (await db.query("select grant_complimentary_plan($1,$2,'local verification','admin',null) as result", [`grant-${plan}`, plan])).rows[0].result;
      assert.equal(grant.creditLimit, credits);
    }
    await event(db, "held", "startup", "monthly", "held-active");
    await event(db, "held", "startup", "monthly", "held-event", "on_hold");
    await assert.rejects(reserve(db, "held", "cannot-spend", 1), /paid_subscription_required/);
  } finally { await db.close(); }
});

test("migration detects function drift and rolls back every change atomically", async () => {
  const db = await fixture();
  try {
    await db.exec(definition(startup, "grant_complimentary_plan").replace("when 'startup' then 1800", "when 'startup' then 1801"));
    await db.exec("begin");
    await assert.rejects(db.exec(correction), /credit_policy_complimentary_grant_drift/);
    await db.exec("rollback");
    assert.equal((await db.query("select to_regprocedure('public.paid_plan_monthly_credit_limit(text)') is null as missing")).rows[0].missing, true);
    await event(db, "untouched", "startup");
    assert.equal((await balance(db, "untouched")).credit_limit, 1800);
  } finally { await db.close(); }
});
