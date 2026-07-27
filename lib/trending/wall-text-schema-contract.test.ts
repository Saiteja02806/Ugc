import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260726100000_create_trending_wall_text_creatives.sql",
    import.meta.url,
  ),
  "utf8",
);

test("stores user-specific Wall ideas without duplicating source videos", () => {
  assert.match(
    migration,
    /create table if not exists public\.wall_text_creatives/i,
  );
  assert.match(
    migration,
    /overlay_media_asset_id uuid not null[\s\S]+references public\.overlay_media_assets/i,
  );
  assert.match(
    migration,
    /business_profile_id uuid not null[\s\S]+business_profile_version integer not null/i,
  );
  assert.match(
    migration,
    /constraint wall_text_creatives_profile_asset_key unique/i,
  );
});

test("validates profile ownership and ready video metadata in the database", () => {
  assert.match(
    migration,
    /profile\.user_id = new\.user_id[\s\S]+profile\.profile_version = new\.business_profile_version/i,
  );
  assert.match(
    migration,
    /asset\.asset_type = 'video'[\s\S]+asset\.aspect_ratio = '9:16'[\s\S]+asset\.status = 'active'[\s\S]+asset\.analysis_status = 'succeeded'[\s\S]+asset\.duration_seconds >= 6[\s\S]+asset\.motion_level[\s\S]+<> 'high'[\s\S]+asset\.text_capacity[\s\S]+<> 'low'/i,
  );
});

test("keeps assignment history server-only and updates source usage atomically", () => {
  assert.match(
    migration,
    /create table if not exists public\.user_wall_text_assignments/i,
  );
  assert.match(
    migration,
    /usage_count = asset\.usage_count \+ 1[\s\S]+last_used_at = now\(\)/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.user_wall_text_assignments[\s\S]+from anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.user_wall_text_assignments[\s\S]+to service_role/i,
  );
});

test("indexes Wall foreign keys for a growing creative library", () => {
  assert.match(
    migration,
    /wall_text_creatives_business_profile_idx[\s\S]+on public\.wall_text_creatives \(business_profile_id\)/i,
  );
  assert.match(
    migration,
    /wall_text_creatives_overlay_asset_idx[\s\S]+on public\.wall_text_creatives \(overlay_media_asset_id\)/i,
  );
  assert.match(
    migration,
    /user_wall_text_assignments_business_profile_idx[\s\S]+on public\.user_wall_text_assignments \(business_profile_id\)/i,
  );
  assert.match(
    migration,
    /user_wall_text_assignments_creative_idx[\s\S]+on public\.user_wall_text_assignments \(wall_text_creative_id\)/i,
  );
});
