import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260809114126_create_hook_audio_library.sql",
    import.meta.url,
  ),
  "utf8",
);

test("creates a separate server-only Hook audio library", () => {
  assert.match(migration, /create table if not exists public\.hook_audio_assets/u);
  assert.match(
    migration,
    /alter table public\.hook_audio_assets enable row level security/u,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.hook_audio_assets[\s\S]+from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.hook_audio_assets[\s\S]+to service_role/u,
  );
});

test("database prevents pending or incomplete clips from becoming active", () => {
  assert.match(migration, /constraint hook_audio_assets_active_review_check/u);
  assert.match(migration, /review_status = 'approved'/u);
  assert.match(migration, /reviewed_at is not null/u);
  assert.match(migration, /cardinality\(moods\) between 1 and 2/u);
  assert.match(migration, /cardinality\(hook_types\) between 2 and 4/u);
  assert.match(migration, /energy is not null/u);
});

test("database stores matching and technical metadata and forbids looping", () => {
  for (const column of [
    "source_package",
    "source_file_name",
    "duration_seconds",
    "codec",
    "sample_rate_hz",
    "channels",
    "bit_rate_bps",
    "moods",
    "hook_types",
    "energy",
    "impact_at_seconds",
    "sha256",
    "file_size_bytes",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, "u"), column);
  }
  assert.match(migration, /loopable boolean not null default false/u);
  assert.match(migration, /check \(not loopable\)/u);
});

test("does not create Preferred or override tables", () => {
  assert.doesNotMatch(migration, /preference/iu);
  assert.doesNotMatch(migration, /override/iu);
});
