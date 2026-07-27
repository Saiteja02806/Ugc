import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260725120000_add_trending_hook_ideas.sql",
    import.meta.url,
  ),
  "utf8",
);

test("stores pre-demo Hook text separately from demo-based composition text", () => {
  assert.match(
    migration,
    /suggestion_context\s+text\s+not null default 'composition'/i,
  );
  assert.match(migration, /suggestion_context in \('composition', 'trending'\)/i);
  assert.match(migration, /alter column demo_asset_id drop not null/i);
  assert.match(
    migration,
    /suggestion_context = 'trending'[\s\S]*demo_asset_id is null/i,
  );
});

test("tracks Hook feed assignments without changing Carousel assignments", () => {
  assert.match(
    migration,
    /create table if not exists public\.user_hook_video_assignments/i,
  );
  assert.match(
    migration,
    /state in \('active', 'completed_skipped', 'selected'\)/i,
  );
  assert.doesNotMatch(migration, /alter table public\.user_carousel_assignments/i);
});

test("persists variable source and trimmed Hook durations", () => {
  assert.match(migration, /duration_seconds numeric/i);
  assert.match(migration, /source_duration_seconds numeric/i);
  assert.match(migration, /trim_start numeric/i);
  assert.match(migration, /trim_end numeric/i);
});
