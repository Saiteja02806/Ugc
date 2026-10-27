import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261026105718_retry_reconnected_action_required_target.sql",
    import.meta.url,
  ),
  "utf8",
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function fixture({ connected = true, targetStatus = "action_required" } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;

    create table scheduled_posts (
      id uuid primary key,
      user_id text not null,
      status text not null default 'partially_failed',
      project_id text not null default 'project-1',
      media_asset_id uuid,
      library_item_id uuid,
      source_kind text not null default 'library_item',
      last_error_code text,
      published_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create table background_jobs (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      input_json jsonb not null default '{}',
      job_type text not null,
      next_attempt_at timestamptz,
      project_id text,
      queue_name text,
      status text not null,
      updated_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    create table social_connections (
      id uuid primary key,
      user_id text not null,
      platform text not null,
      status text not null,
      revoked_at timestamptz,
      expires_at timestamptz,
      refresh_token_ciphertext text,
      refresh_expires_at timestamptz
    );
    create table scheduled_post_targets (
      id uuid primary key,
      scheduled_post_id uuid not null references scheduled_posts(id),
      user_id text not null,
      platform text not null,
      social_connection_id uuid not null references social_connections(id),
      status text not null,
      last_error_code text,
      last_error_message text,
      publish_job_id uuid references background_jobs(id),
      last_reconciled_at timestamptz,
      next_retry_at timestamptz,
      platform_post_id text,
      platform_post_url text,
      published_at timestamptz,
      scheduled_for timestamptz,
      updated_at timestamptz not null default now()
    );
    create table social_publish_operations (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      scheduled_post_target_id uuid not null references scheduled_post_targets(id),
      status text not null,
      platform_post_id text,
      platform_post_url text,
      published_at timestamptz
    );
    create table library_items (
      id uuid primary key,
      user_id text not null,
      source_type text not null,
      media_type text not null,
      status text not null,
      deleted_at timestamptz
    );
    create table library_carousel_slides (
      id uuid primary key default gen_random_uuid(),
      library_item_id uuid not null references library_items(id),
      rendered_url text not null
    );
    create table media_assets (
      id uuid primary key,
      user_id text not null,
      status text not null,
      collection text not null,
      source_type text not null
    );

    insert into library_items(id, user_id, source_type, media_type, status)
      values ('${id(4)}', 'owner', 'generated_carousel', 'carousel', 'ready');
    insert into library_carousel_slides(library_item_id, rendered_url)
      values
        ('${id(4)}', 'https://cdn.example/slide-1.png'),
        ('${id(4)}', 'https://cdn.example/slide-2.png');
    insert into social_connections(
      id, user_id, platform, status, refresh_token_ciphertext, refresh_expires_at
    ) values (
      '${id(5)}',
      'owner',
      'tiktok',
      '${connected ? "connected" : "disconnected"}',
      'encrypted-refresh-token',
      '2027-10-26T00:00:00Z'
    );
    insert into background_jobs(id, user_id, input_json, job_type, status)
      values (
        '${id(1)}',
        'owner',
        '{"targetId":"${id(3)}"}',
        'publish_social_post',
        'failed'
      );
    insert into scheduled_posts(id, user_id, library_item_id)
      values ('${id(2)}', 'owner', '${id(4)}');
    insert into scheduled_post_targets(
      id, scheduled_post_id, user_id, platform, social_connection_id, status,
      last_error_code, last_error_message, publish_job_id
    ) values
      (
        '${id(3)}', '${id(2)}', 'owner', 'tiktok', '${id(5)}',
        '${targetStatus}', 'invalid_grant', 'Reconnect this account.', '${id(1)}'
      ),
      (
        '${id(6)}', '${id(2)}', 'owner', 'instagram', '${id(5)}',
        'published', null, null, null
      );
    update scheduled_post_targets
    set platform_post_id = 'published-sibling-receipt',
        platform_post_url = 'https://provider.example/published-sibling',
        published_at = '2026-10-23T10:00:00Z'
    where id = '${id(6)}';

    grant select, insert, update on all tables in schema public to service_role;
  `);
  await db.exec(migration);
  return db;
}

async function retry(db, userId = "owner") {
  return (
    await db.query(
      `select * from retry_social_publish_target('${id(2)}', '${id(3)}', '${userId}')`,
    )
  ).rows[0];
}

test("reconnected action-required target retries once without republishing siblings", async () => {
  const db = await fixture();
  try {
    await db.exec("set role service_role");
    const first = await retry(db);
    assert.equal(first.outcome, "retry_created");
    assert.ok(first.job_id);

    const retriedTarget = (
      await db.query(
        `select status, publish_job_id, last_error_code, scheduled_for
         from scheduled_post_targets where id = '${id(3)}'`,
      )
    ).rows[0];
    assert.equal(retriedTarget.status, "scheduled");
    assert.equal(retriedTarget.publish_job_id, first.job_id);
    assert.equal(retriedTarget.last_error_code, null);
    assert.ok(retriedTarget.scheduled_for);

    const sibling = (
      await db.query(
        `select status, platform_post_id, platform_post_url
         from scheduled_post_targets where id = '${id(6)}'`,
      )
    ).rows[0];
    assert.deepEqual(sibling, {
      status: "published",
      platform_post_id: "published-sibling-receipt",
      platform_post_url: "https://provider.example/published-sibling",
    });

    const second = await retry(db);
    assert.equal(second.outcome, "already_queued");
    assert.equal(second.job_id, first.job_id);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from background_jobs where status = 'queued'",
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});

test("an unrecovered action-required connection remains blocked without a new job", async () => {
  const db = await fixture({ connected: false });
  try {
    await db.exec("set role service_role");
    assert.deepEqual(await retry(db), { outcome: "action_required", job_id: null });
    assert.equal(
      (
        await db.query(
          `select status from scheduled_post_targets where id = '${id(3)}'`,
        )
      ).rows[0].status,
      "action_required",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from background_jobs where status = 'queued'",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});

test("failed targets retain the existing connection-unavailable outcome", async () => {
  const db = await fixture({ connected: false, targetStatus: "failed" });
  try {
    await db.exec("set role service_role");
    assert.deepEqual(await retry(db), {
      outcome: "connection_unavailable",
      job_id: null,
    });
  } finally {
    await db.close();
  }
});

test("retry remains owner-scoped and unavailable to browser roles", async () => {
  const db = await fixture();
  try {
    await db.exec("set role service_role");
    assert.deepEqual(await retry(db, "another-owner"), {
      outcome: "not_found",
      job_id: null,
    });
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(retry(db), /permission denied/);
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
