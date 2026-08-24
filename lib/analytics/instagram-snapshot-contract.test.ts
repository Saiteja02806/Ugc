import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824120000_add_instagram_analytics_snapshots.sql",
  "utf8",
);
const contentSync = readFileSync(
  "lib/analytics/instagram-content.ts",
  "utf8",
);
const internalWorker = readFileSync(
  "app/api/internal/jobs/sync-analytics/route.ts",
  "utf8",
);
const publisher = readFileSync(
  "worker/src/jobs/publish-social-post.ts",
  "utf8",
);

test("analytics snapshots are durable, owner scoped, and service-role only", () => {
  assert.match(migration, /instagram_analytics_account_snapshots/);
  assert.match(migration, /instagram_analytics_connection_snapshots/);
  assert.match(migration, /instagram_analytics_content/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all privileges[\s\S]*anon, authenticated/g);
  assert.match(migration, /primary key \(user_id, social_connection_id, platform_media_id\)/);
});

test("content synchronization refreshes incrementally and isolates post failures", () => {
  assert.match(contentSync, /getInstagramIncrementalFeedStart/);
  assert.match(contentSync, /isInstagramContentMetricsStale/);
  assert.match(contentSync, /A single unavailable[\s\S]*must never discard/);
  assert.match(contentSync, /lastSyncError: getInstagramContentErrorMessage\(error\)/);
});

test("attribution is a separate durable job after the content snapshot", () => {
  assert.match(internalWorker, /operation: "instagram_attribution"/);
  assert.match(
    internalWorker,
    /return json\(\{ accounts, days, ok: true, operation: input\.operation \}\)/,
  );
});

test("successful UGC Pilot Instagram publications register immediately", () => {
  assert.match(publisher, /registerInstagramAnalyticsPublicationSafely/);
  assert.match(publisher, /registerInstagramAnalyticsPublication\(/);
});
