import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migrations/20260906120000_add_reaction_trending_delivery.sql",
);
const provider = readProjectFile("lib/trending/reaction-feed.ts");
const unifiedFeed = readProjectFile("lib/trending/unified-daily-feed.ts");
const scheduleRoute = readProjectFile(
  "app/api/trending/reactions/schedules/route.ts",
);

test("delivers only a fully rendered Reaction creative to Trending", () => {
  assert.match(migration, /render_status in \('queued', 'rendering', 'preview_ready', 'failed'\)/);
  assert.match(
    migration,
    /render_status <> 'preview_ready'[\s\S]*rendered_media_asset_id is not null[\s\S]*preview_url ~ /,
  );
  assert.match(provider, /\.eq\("render_status", "preview_ready"\)/);
  assert.match(provider, /createReactionTrendingFeedProvider/);
  assert.match(unifiedFeed, /getTrendingReactionFeedProvider/);
});

test("binds Reaction cards to the shared durable daily-slot lifecycle", () => {
  assert.match(migration, /reaction_assignment_id uuid/);
  assert.match(migration, /format in \('carousel', 'hook_video', 'wall_text', 'reaction'\)/);
  assert.match(migration, /attach_daily_trending_feed_assignments[\s\S]*p_reaction_assignment_ids/);
  assert.match(migration, /reconcile_daily_trending_feed_slot_integrity[\s\S]*p_reaction_provider_resolved/);
  assert.match(migration, /p_format = 'reaction'[\s\S]*slot\.reaction_assignment_id/);
});

test("requires the accepted decision and uses one idempotent shared schedule", () => {
  assert.match(scheduleRoute, /recordTrendingCreativeDecision\([\s\S]*decision: "accepted"[\s\S]*format: "reaction"/);
  assert.match(scheduleRoute, /markDailyTrendingSlotDecided/);
  assert.match(
    scheduleRoute,
    /idempotencyKey: `reaction-trending-schedule:\$\{creative\.assignmentId\}`/,
  );
  assert.match(scheduleRoute, /source: \{ id: creative\.mediaAssetId, kind: "media_asset" \}/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
