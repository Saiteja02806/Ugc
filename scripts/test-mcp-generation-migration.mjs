import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

function functionSql(source, name) {
  const start = source.search(new RegExp(`create or replace function public\\.${name}\\s*\\(`, "i"));
  assert.ok(start >= 0, `${name} must exist in its current migration`);
  const end = source.indexOf("$function$;", start);
  assert.ok(end > start, `${name} must have a complete body`);
  return source.slice(start, end + "$function$;".length);
}

const baseline = await readFile(new URL("../supabase/migrations/20260905123000_harden_wall_text_regeneration_recovery.sql", import.meta.url), "utf8");
const billing = await readFile(new URL("../supabase/migrations/20260910105839_add_complimentary_plan_grants.sql", import.meta.url), "utf8");
const mcp = await readFile(new URL("../supabase/migrations/20260927183258_mcp_atomic_generation_job.sql", import.meta.url), "utf8");
const videoMigration = await readFile(new URL("../supabase/migrations/20260930144135_mcp_video_generation.sql", import.meta.url), "utf8");
const db = new PGlite();

try {
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
  await db.exec(functionSql(billing, "reserve_billing_credits"));
  await db.exec(functionSql(baseline, "create_or_get_background_job_v1"));
  await db.exec(mcp);
  await db.exec(videoMigration);

  const privileges = await db.query(`select
    has_function_privilege('anon', 'public.mcp_create_reserved_generation_job(text,text,text,integer,text,jsonb,text)', 'EXECUTE') as anon,
    has_function_privilege('service_role', 'public.mcp_create_reserved_generation_job(text,text,text,integer,text,jsonb,text)', 'EXECUTE') as service`);
  assert.deepEqual(privileges.rows[0], { anon: false, service: true });

  await db.exec(`
    insert into public.billing_subscriptions (user_id,status,plan_key,dodo_subscription_id)
      values ('owner-a','active','starter','subscription-a');
    insert into public.billing_credit_balances
      (user_id,dodo_subscription_id,credit_limit,period_start,period_end)
      values ('owner-a','subscription-a',10,now() - interval '1 day',now() + interval '29 days');
  `);

  const fingerprint = "a".repeat(64);
  const key = `mcp:image:${"b".repeat(64)}:1`;
  const input = { mcpSource: "ugc-pilot-cloud-mcp", mcpRequestFingerprint: fingerprint, prompt: "Product image" };
  const callSql = `select public.mcp_create_reserved_generation_job($1,$2,$3,$4,$5,$6,$7) as result`;
  const args = ["owner-a", key, "generate_image", 4, fingerprint, input, "ai-generation"];
  const first = (await db.query(callSql, args)).rows[0].result;
  assert.equal(first.created, true);
  assert.equal(first.job.user_id, "owner-a");
  assert.equal(first.job.input_json.mcpRequestFingerprint, fingerprint);

  const retry = (await db.query(callSql, args)).rows[0].result;
  assert.equal(retry.created, false);
  assert.equal(retry.job.id, first.job.id);
  const state = await db.query(`select
    (select count(*)::int from public.background_jobs) as jobs,
    (select count(*)::int from public.billing_credit_reservations) as reservations,
    (select reserved_credits from public.billing_credit_balances where user_id='owner-a') as reserved`);
  assert.deepEqual(state.rows[0], { jobs: 1, reservations: 1, reserved: 4 });

  await assert.rejects(db.query(callSql, [
    ...args.slice(0, 4), "c".repeat(64), { ...input, mcpRequestFingerprint: "c".repeat(64) }, args[6],
  ]), /mcp_generation_idempotency_conflict/);
  await assert.rejects(db.query(callSql, [
    ...args.slice(0, 4), null, { mcpSource: "ugc-pilot-cloud-mcp" }, args[6],
  ]), /mcp_generation_input_invalid/);
  await assert.rejects(db.query(callSql, [
    ...args.slice(0, 6), "wrong-queue",
  ]), /mcp_generation_input_invalid/);
  await assert.rejects(db.query(callSql, [
    "owner-a", `mcp:image:${"d".repeat(64)}:2`, "generate_image", 7,
    fingerprint, input, "ai-generation",
  ]), /insufficient_billing_credits/);
  await assert.rejects(db.query(callSql, [
    "owner-a", `mcp:image:${"e".repeat(64)}:3`, "generate_image", 4,
    fingerprint, { ...input, prompt: "reject-job" }, "ai-generation",
  ]), /background_jobs_reject_prompt_check/);

  const afterFailures = await db.query(`select
    (select count(*)::int from public.background_jobs) as jobs,
    (select count(*)::int from public.billing_credit_reservations) as reservations,
    (select reserved_credits from public.billing_credit_balances where user_id='owner-a') as reserved`);
  assert.deepEqual(afterFailures.rows[0], { jobs: 1, reservations: 1, reserved: 4 });

  await assert.rejects(db.query(callSql, [
    "owner-b", `mcp:image:${"f".repeat(64)}:1`, "generate_image", 4,
    fingerprint, input, "ai-generation",
  ]), /paid_subscription_required/);

  await db.exec(`insert into public.billing_credit_reservations
    (user_id,idempotency_key,job_type,amount,credit_period_start)
    values ('owner-a','mcp:image:${"1".repeat(64)}:1','generate_image',4,now())`);
  await assert.rejects(db.query(callSql, [
    "owner-a", `mcp:image:${"1".repeat(64)}:1`, "generate_image", 4,
    fingerprint, input, "ai-generation",
  ]), /mcp_generation_reservation_conflict/);

  const videoKey = `mcp:video:${"2".repeat(64)}:1`;
  const videoInput = {
    ...input, promptMode: "direct", hookIdea: "Orange rotating", model: "google_omni",
    userId: "owner-a", projectId: "ai-studio", videoId: "22222222-2222-4222-8222-222222222222",
    aspectRatio: "9:16", durationSeconds: 3,
  };
  const videoArgs = ["owner-a", videoKey, "generate_hook_video", 3, fingerprint, videoInput, "ai-generation"];
  const firstVideo = (await db.query(callSql, videoArgs)).rows[0].result;
  assert.equal(firstVideo.created, true);
  assert.equal(firstVideo.job.job_type, "generate_hook_video");
  const videoRetry = (await db.query(callSql, videoArgs)).rows[0].result;
  assert.equal(videoRetry.created, false);
  assert.equal(videoRetry.job.id, firstVideo.job.id);
  assert.deepEqual((await db.query(`select
    (select count(*)::int from public.background_jobs where idempotency_key=$1) as jobs,
    (select count(*)::int from public.billing_credit_reservations where idempotency_key=$1) as reservations,
    (select reserved_credits from public.billing_credit_balances where user_id='owner-a') as reserved`, [videoKey])).rows[0],
  { jobs: 1, reservations: 1, reserved: 7 });
  for (const invalid of [
    { ...videoInput, userId: "owner-b" }, { ...videoInput, promptMode: "ugc_template" },
    { ...videoInput, aspectRatio: "1:1" }, { ...videoInput, durationSeconds: 11 },
    { ...videoInput, durationSeconds: null }, { ...videoInput, durationSeconds: "3" },
    { ...videoInput, hookIdea: "" }, { ...videoInput, referenceVideoUrl: "https://external.test/video.mp4" },
  ]) {
    await assert.rejects(db.query(callSql, [...videoArgs.slice(0, 5), invalid, "ai-generation"]), /mcp_generation_input_invalid/);
  }
  await assert.rejects(db.query(callSql, ["owner-a", key, "generate_hook_video", 3, fingerprint, videoInput, "ai-generation"]), /mcp_generation_input_invalid/);
  await assert.rejects(db.query(callSql, [...videoArgs.slice(0, 4), "9".repeat(64), { ...videoInput, mcpRequestFingerprint: "9".repeat(64) }, "ai-generation"]), /mcp_generation_idempotency_conflict/);
  await db.exec(`alter table public.background_jobs add constraint background_jobs_reject_video check (input_json->>'hookIdea' is distinct from 'reject-video')`);
  const failedVideoKey = `mcp:video:${"3".repeat(64)}:1`;
  await assert.rejects(db.query(callSql, ["owner-a", failedVideoKey, "generate_hook_video", 3, fingerprint, { ...videoInput, hookIdea: "reject-video" }, "ai-generation"]), /background_jobs_reject_video/);
  assert.equal((await db.query("select count(*)::int as count from public.billing_credit_reservations where idempotency_key=$1", [failedVideoKey])).rows[0].count, 0);
  assert.equal((await db.query("select reserved_credits from public.billing_credit_balances where user_id='owner-a'")).rows[0].reserved_credits, 7);

  await db.exec("set role anon");
  try {
    await assert.rejects(db.query(callSql, args), /permission denied/);
  } finally {
    await db.exec("reset role");
  }

  console.log("MCP atomic image/video migrations: role isolation, video inputs, duration billing, retry/conflict, insufficient credits, and rollback passed.");
} finally {
  await db.close();
}
