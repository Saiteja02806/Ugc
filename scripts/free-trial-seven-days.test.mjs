import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const allowanceMigration = readMigration("20260910112546_increase_free_trial_allowances.sql");
const guardMigration = readMigration("20260910113000_finalize_complimentary_plan_trial_guards.sql");
const migration = readMigration("20261003092157_extend_trending_free_trial_to_seven_days.sql");

test("seven-day migration extends active trials, preserves expired trials and usage, and enforces access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.free_trial_entitlements (
        user_id text primary key, started_at timestamptz not null,
        expires_at timestamptz not null, content_days_limit int not null default 3,
        daily_content_pieces int not null default 10,
        instagram_schedule_limit int not null default 5,
        updated_at timestamptz not null default now()
      );
      alter table public.free_trial_entitlements enable row level security;
      create table public.subscription_entitlements (plan_key text, daily_trending_limit int);
      create table public.billing_subscriptions (user_id text, status text);
      create table public.complimentary_plan_grants (user_id text, revoked_at timestamptz, expires_at timestamptz);
      create table public.daily_trending_feeds (user_id text, created_at timestamptz default now(), daily_limit int);
      create table public.free_trial_instagram_schedule_usage (user_id text, scheduled_post_target_id int);
      create table public.targets (id int, user_id text, platform text);
      create table public.profiles (user_id text, onboarding_status text, onboarding_version int, onboarding_completed_at timestamptz);
    `);
    await db.exec(allowanceMigration);
    await db.exec(guardMigration);
    await db.exec(`
      create trigger feed_guard before insert on public.daily_trending_feeds
        for each row execute function public.enforce_free_trial_daily_trending_feed();
      create trigger schedule_guard before insert on public.targets
        for each row execute function public.enforce_free_trial_instagram_schedule_limit();
      create trigger onboarding after insert or update on public.profiles
        for each row execute function public.grant_free_trial_on_onboarding_completion();
      insert into public.free_trial_entitlements (user_id, started_at, expires_at) values
        ('active', now() - interval '1 day', now() + interval '2 days'),
        ('recently-expired', now() - interval '4 days', now() - interval '1 day'),
        ('old-expired', now() - interval '30 days', now() - interval '27 days');
      insert into public.free_trial_entitlements (user_id, started_at, expires_at, content_days_limit) values
        ('longer-custom', now(), now() + interval '14 days', 14);
      insert into public.daily_trending_feeds (user_id, daily_limit)
        select 'active', 20 from generate_series(1, 3);
      insert into public.free_trial_instagram_schedule_usage values ('active', 0);
    `);
    const before = (await db.query("select * from public.free_trial_entitlements order by user_id")).rows;
    const feedsBefore = (await db.query("select * from public.daily_trending_feeds")).rows;
    const schedulesBefore = (await db.query("select * from public.free_trial_instagram_schedule_usage")).rows;
    await db.exec(migration);
    assert.equal((await db.query("select column_default from information_schema.columns where table_schema = 'public' and table_name = 'free_trial_entitlements' and column_name = 'content_days_limit'")).rows[0].column_default, "7");
    const after = (await db.query("select * from public.free_trial_entitlements order by user_id")).rows;
    const active = after.find((row) => row.user_id === "active");
    assert.equal(active.content_days_limit, 7);
    assert.equal(active.expires_at.getTime() - active.started_at.getTime(), 7 * 86_400_000);
    for (const row of before) {
      const saved = after.find((candidate) => candidate.user_id === row.user_id);
      assert.equal(saved.started_at.getTime(), row.started_at.getTime(), "original start is retained");
      assert.equal(saved.daily_content_pieces, row.daily_content_pieces);
      assert.equal(saved.instagram_schedule_limit, row.instagram_schedule_limit);
      if (row.user_id !== "active") assert.deepEqual(saved, row, "expired and longer custom trials are untouched");
    }
    assert.deepEqual((await db.query("select * from public.daily_trending_feeds")).rows, feedsBefore);
    assert.deepEqual((await db.query("select * from public.free_trial_instagram_schedule_usage")).rows, schedulesBefore);
    assert.equal((await db.query("select relrowsecurity from pg_class where oid = 'public.free_trial_entitlements'::regclass")).rows[0].relrowsecurity, true);

    await db.exec(migration);
    assert.deepEqual((await db.query("select * from public.free_trial_entitlements order by user_id")).rows, after, "replay does not extend again");
    await assert.rejects(db.exec("insert into public.daily_trending_feeds values ('active', now(), 21)"), /free_trial_daily_content_limit_exceeded/);
    await db.exec("insert into public.daily_trending_feeds (user_id, daily_limit) select 'active', 20 from generate_series(4, 7)");
    await assert.rejects(db.exec("insert into public.daily_trending_feeds values ('active', now(), 20)"), /free_trial_content_days_exhausted/);
    await assert.rejects(db.exec("insert into public.daily_trending_feeds values ('recently-expired', now(), 20)"), /free_trial_content_expired/);
    await assert.rejects(db.exec("insert into public.targets values (99, 'recently-expired', 'instagram')"), /free_trial_schedule_expired/);
    await db.exec("insert into public.targets select n, 'active', 'instagram' from generate_series(1, 25) n");
    assert.equal((await db.query("select count(*)::int as n from public.free_trial_instagram_schedule_usage where user_id = 'active'")).rows[0].n, 26);

    await db.exec(`
      insert into public.profiles values
        ('new', 'completed', 3, now()),
        ('incomplete', 'in_progress', 3, now()),
        ('old-onboarding-version', 'completed', 2, now()),
        ('recently-expired', 'completed', 3, now());
    `);
    const fresh = (await db.query("select * from public.free_trial_entitlements where user_id = 'new'")).rows[0];
    assert.equal(fresh.expires_at.getTime() - fresh.started_at.getTime(), 7 * 86_400_000);
    assert.equal(fresh.content_days_limit, 7);
    assert.equal(fresh.daily_content_pieces, 20);
    assert.equal(fresh.instagram_schedule_limit, null);
    assert.equal((await db.query("select count(*)::int as n from public.free_trial_entitlements where user_id in ('incomplete', 'old-onboarding-version')")).rows[0].n, 0);
    await db.exec("update public.profiles set onboarding_completed_at = now() + interval '1 day'");
    assert.deepEqual((await db.query("select * from public.free_trial_entitlements where user_id = 'new'")).rows[0], fresh, "onboarding replay does not reset the trial");
    assert.deepEqual((await db.query("select * from public.free_trial_entitlements where user_id = 'recently-expired'")).rows[0], before.find((row) => row.user_id === "recently-expired"), "onboarding cannot revive expired access");
    await db.exec("update public.free_trial_entitlements set expires_at = now() where user_id = 'new'");
    await assert.rejects(db.exec("insert into public.daily_trending_feeds values ('new', now(), 20)"), /free_trial_content_expired/);
    await assert.rejects(db.exec("insert into public.targets values (100, 'new', 'instagram')"), /free_trial_schedule_expired/);
    await assert.rejects(db.exec("insert into public.daily_trending_feeds values ('missing-trial', now(), 20)"), /free_trial_content_expired/);

    await db.exec(`
      insert into public.billing_subscriptions values ('paid', 'active'), ('cancelled', 'cancelled');
      insert into public.complimentary_plan_grants values
        ('complimentary', null, null), ('expired-grant', null, now() - interval '1 day'),
        ('revoked-grant', now(), null);
      insert into public.daily_trending_feeds values ('paid', now(), 50), ('complimentary', now(), 50);
      insert into public.targets values (101, 'paid', 'instagram'), (102, 'complimentary', 'instagram');
    `);
    for (const user of ["cancelled", "expired-grant", "revoked-grant"]) {
      await assert.rejects(db.exec(`insert into public.daily_trending_feeds values ('${user}', now(), 50)`), /free_trial_content_expired/);
    }
    for (const name of ["grant_free_trial_on_onboarding_completion", "enforce_free_trial_daily_trending_feed"]) {
      const permissions = (await db.query(`select
        has_function_privilege('anon', 'public.${name}()', 'EXECUTE') as anon,
        has_function_privilege('authenticated', 'public.${name}()', 'EXECUTE') as authenticated,
        has_function_privilege('service_role', 'public.${name}()', 'EXECUTE') as service_role,
        prosecdef from pg_proc where oid = 'public.${name}()'::regprocedure`)).rows[0];
      assert.deepEqual(permissions, { anon: false, authenticated: false, service_role: true, prosecdef: false });
    }
  } finally {
    await db.close();
  }
});
