import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export const readMigration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const paidMigration = readMigration("20260910105839_add_complimentary_plan_grants");
export const baseline = readMigration("20260829093001_production_baseline_v1");
export const functionSQL = (source, name) => {
  const sql = source.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$function\\$\\s*;`, "iu"))?.[0];
  assert.ok(sql, `Missing real function ${name}`);
  return sql;
};

export async function fixture({ realJobs = false } = {}) {
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
  if (realJobs) {
    const start = baseline.indexOf('CREATE TABLE "public"."background_jobs" (');
    assert.ok(start >= 0);
    // Local in-memory fixture only: replace the reduced job table with the
    // authoritative baseline table and its actual constraints.
    await db.exec('drop table background_jobs');
    await db.exec(baseline.slice(start, baseline.indexOf('\n);', start) + 3));
  }
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
