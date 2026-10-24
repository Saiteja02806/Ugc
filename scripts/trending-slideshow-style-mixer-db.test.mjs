import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });

before(async () => {
  await db.exec(
    "set time zone 'UTC'; create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;",
  );
  const applied = new Set();
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = (await readFile(new URL(file, migrations), "utf8")).replace(/\r\n/g, "\n");
    if (applied.has(sql)) continue;
    applied.add(sql);
    await db.exec(sql);
  }
  await db.exec(`
    insert into public.subscription_entitlements(plan_key,display_name,daily_carousel_limit,daily_trending_limit)
    values ('pro','Starter',50,50)
    on conflict (plan_key) do update set daily_carousel_limit=50,daily_trending_limit=50;
  `);
}, { timeout: 120000 });

after(() => db.close());

async function one(sql, params = []) {
  return (await db.query(sql, params)).rows[0];
}

async function createProfile() {
  const userId = `slideshow-mixer-${randomUUID()}`;
  const profile = await one(
    "insert into public.business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual','{}','mixer-fixture') returning id,profile_version",
    [userId],
  );
  await db.query(
    `insert into public.billing_subscriptions(
      dodo_subscription_id,user_id,dodo_customer_id,product_id,plan_key,
      billing_interval,status,last_event_at,last_webhook_id
    ) values($1,$2,'fixture-customer','fixture-product','growth','monthly','active',now(),$3)`,
    [`fixture-${randomUUID()}`, userId, `fixture-event-${randomUUID()}`],
  );
  return { profile, userId };
}

test("saves a 50/50 style preference and snapshots it only for a newly created daily pack", async () => {
  const { profile, userId } = await createProfile();
  const version = await one(
    "select public.save_trending_content_mix_preference($1,100,0,0,0,50,50) preference_version",
    [userId],
  );
  assert.equal(version.preference_version, 1);
  assert.deepEqual(
    await one(
      "select helpful_tips_percent,product_stories_cta_percent from public.trending_content_mix_preferences where user_id=$1",
      [userId],
    ),
    { helpful_tips_percent: 50, product_stories_cta_percent: 50 },
  );

  const feed = await one(
    `select public.ensure_daily_trending_feed_plan(
      $1,$2,1,current_date,'UTC','pro','Starter',50,100,0,0,0,1,
      array_fill('carousel'::text,array[50]),50,50
    ) feed_id`,
    [userId, profile.id],
  );
  assert.ok(feed.feed_id);
  assert.deepEqual(
    await one(
      "select helpful_tips_percent,product_stories_cta_percent,slideshow_style_mix_enabled from public.daily_trending_feeds where id=$1",
      [feed.feed_id],
    ),
    {
      helpful_tips_percent: 50,
      product_stories_cta_percent: 50,
      slideshow_style_mix_enabled: true,
    },
  );

  await one(
    `select public.ensure_daily_trending_feed_plan(
      $1,$2,1,current_date,'UTC','pro','Starter',50,100,0,0,0,2,
      array_fill('carousel'::text,array[50]),80,20
    ) feed_id`,
    [userId, profile.id],
  );
  assert.deepEqual(
    await one(
      "select helpful_tips_percent,product_stories_cta_percent,slideshow_style_mix_enabled from public.daily_trending_feeds where id=$1",
      [feed.feed_id],
    ),
    {
      helpful_tips_percent: 50,
      product_stories_cta_percent: 50,
      slideshow_style_mix_enabled: true,
    },
    "an existing daily pack keeps its original style snapshot",
  );
});

test("reserves an exact helpful/product batch sequence with no rotation takeover mode", async () => {
  const { profile } = await createProfile();
  const generationBatchId = randomUUID();
  const rows = (await db.query(
    "select structure_id,requested_structure_id,structure_selection_mode,structure_rotation_sequence from public.reserve_carousel_experiment_batches($1,1,$2,2,array['structure_1','structure_2']) order by batch_sequence",
    [profile.id, generationBatchId],
  )).rows;

  assert.deepEqual(rows, [
    {
      structure_id: "structure_1",
      requested_structure_id: "structure_1",
      structure_selection_mode: "account_preference",
      structure_rotation_sequence: null,
    },
    {
      structure_id: "structure_2",
      requested_structure_id: "structure_2",
      structure_selection_mode: "account_preference",
      structure_rotation_sequence: null,
    },
  ]);

  const replay = (await db.query(
    "select structure_id from public.reserve_carousel_experiment_batches($1,1,$2,2,array['structure_1','structure_2']) order by batch_sequence",
    [profile.id, generationBatchId],
  )).rows;
  assert.deepEqual(replay, [{ structure_id: "structure_1" }, { structure_id: "structure_2" }]);
  await assert.rejects(
    db.query(
      "select * from public.reserve_carousel_experiment_batches($1,1,$2,2,array['structure_2','structure_1'])",
      [profile.id, generationBatchId],
    ),
    /carousel_experiment_batch_structure_replay_mismatch/,
  );
});
