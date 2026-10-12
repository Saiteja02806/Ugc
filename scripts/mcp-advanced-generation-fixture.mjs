import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
function functionSql(source,name) {
 const match=source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\s*\\([\\s\\S]*?\\$function\\$;`,"i"));
 assert(match,`Missing authoritative function ${name}`);return match[0];
}
export async function advancedDb() {
 const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.background_jobs (
      id uuid primary key default gen_random_uuid(),
      user_id text,
      idempotency_key text,
      job_type text not null,
      input_json jsonb not null,
      input_reference text,
      max_attempts integer not null,
      project_id text,
      queue_name text not null,
      queue_provider text not null,
      completed_at timestamptz,
      queued_at timestamptz,
      stage text,
      status text not null,
      constraint background_jobs_reject_prompt_check check (input_json->>'prompt' is distinct from 'reject-job'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index background_jobs_owner_type_idempotency_uidx
      on public.background_jobs (coalesce(user_id, ''), job_type, idempotency_key)
      where idempotency_key is not null;
    create table public.billing_credit_reservations (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      idempotency_key text not null,
      job_type text not null,
      amount integer not null,
      status text not null default 'reserved',
      credit_period_start timestamptz not null,
      complimentary_plan_grant_id uuid,
      unique (user_id, idempotency_key)
    );
    create table public.billing_subscriptions (
      user_id text not null,
      status text not null,
      plan_key text not null,
      dodo_subscription_id text,
      last_event_at timestamptz not null default now()
    );
    create table public.billing_credit_balances (
      user_id text primary key,
      dodo_subscription_id text,
      credit_limit integer not null,
      used_credits integer not null default 0,
      reserved_credits integer not null default 0,
      period_start timestamptz not null,
      period_end timestamptz not null,
      updated_at timestamptz not null default now()
    );
    create table public.complimentary_plan_grants (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      plan_key text not null,
      revoked_at timestamptz,
      expires_at timestamptz,
      granted_at timestamptz not null default now()
    );
    create table public.complimentary_plan_credit_balances (
      grant_id uuid primary key,
      user_id text not null,
      credit_limit integer not null,
      used_credits integer not null default 0,
      reserved_credits integer not null default 0,
      period_start timestamptz not null,
      period_end timestamptz not null,
      updated_at timestamptz not null default now()
    );
  `);

 await db.exec(functionSql(await sql("20260910105839_add_complimentary_plan_grants.sql"), "reserve_billing_credits"));
 await db.exec(functionSql(await sql("20260905123000_harden_wall_text_regeneration_recovery.sql"), "create_or_get_background_job_v1"));
 await db.exec(await sql("20260927202613_mcp_atomic_generation_job.sql"));
 await db.exec(await sql("20260930144135_mcp_video_generation.sql"));
 // Actual current free-generation billing wrapper; settlement functions aren't called here.
 const free=await sql("20261003110411_one_time_free_generation_credits.sql");
 await db.exec(free.slice(0,free.indexOf("alter function public.settle_billing_credit_reservation")));
 await db.exec(await sql("20261012154819_mcp_advanced_generation.sql"));
 await db.exec(`grant select,insert,update on all tables in schema public to service_role;
 alter table background_jobs enable row level security;
 alter table billing_credit_reservations enable row level security;
 insert into billing_subscriptions(user_id,status,plan_key,dodo_subscription_id) values('owner-a','active','starter','subscription-a');
 insert into billing_credit_balances(user_id,dodo_subscription_id,credit_limit,period_start,period_end)
 values('owner-a','subscription-a',1000,now()-interval '1 day',now()+interval '29 days');`);
 return db;
}
export async function reserve(db,{owner="owner-a",key,kind="video",amount=40,hash="a".repeat(64),input}={}) {
 return (await db.query("select public.mcp_create_reserved_advanced_generation_job($1,$2,$3,$4,$5,$6::jsonb,'ai-generation') as result",
 [owner,key,kind==="image"?"generate_image":"generate_hook_video",amount,hash,JSON.stringify(input)])).rows[0].result;
}
