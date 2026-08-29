import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260809143646_add_hook_audio_format_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const privilegeMigration = readFileSync(
  new URL(
    "../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260809143921_restrict_hook_audio_format_foundation_privileges.sql",
    import.meta.url,
  ),
  "utf8",
);

const indexMigration = readFileSync(
  new URL(
    "../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260809144201_index_hook_audio_format_foundation_foreign_keys.sql",
    import.meta.url,
  ),
  "utf8",
);

const hookFormatIds = [
  "bedroom_reaction",
  "cafe_reaction",
  "desk_laptop_reaction",
  "fitness_workspace_reaction",
  "headphones_reaction",
  "indoor_selfie_closeup",
  "indoor_selfie_medium",
  "office_selfie",
  "phone_reaction",
  "sofa_reaction",
];

test("creates the three server-only Hook audio foundation tables", () => {
  for (const table of [
    "hook_formats",
    "hook_format_audio_preferences",
    "hook_audio_selections",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${table}\\b`, "u"),
      table,
    );
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "u",
      ),
      `${table} RLS`,
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table}[\\s\\S]+?from public, anon, authenticated`,
        "u",
      ),
      `${table} browser access`,
    );
    assert.match(
      privilegeMigration,
      new RegExp(
        `revoke all privileges on table public\\.${table}[\\s\\S]+?from public, anon, authenticated, service_role`,
        "u",
      ),
      `${table} default service-role access`,
    );
    assert.match(
      privilegeMigration,
      new RegExp(
        `grant select, insert, update, delete on table public\\.${table}[\\s\\S]+?to service_role`,
        "u",
      ),
      `${table} exact service-role access`,
    );
  }
});

test("seeds the 10 reviewed visual groups as Dynamic Hook formats", () => {
  for (const id of hookFormatIds) {
    assert.match(migration, new RegExp(`'${id}'`, "u"), id);
  }

  assert.match(
    migration,
    /audio_mode text not null default 'dynamic'/u,
  );
  assert.match(migration, /audio_mode in \('dynamic', 'preferred', 'locked'\)/u);
  assert.match(migration, /on conflict \(id\) do nothing/u);
});

test("adds and safely backfills hook_format_id for exactly 78 catalog videos", () => {
  assert.match(
    migration,
    /alter table public\.avatar_assets[\s\S]+add column if not exists hook_format_id text/u,
  );
  assert.match(migration, /expected_hook_count constant integer := 78/u);
  assert.match(migration, /expected_format_count constant integer := 10/u);
  assert.match(migration, /source_batch = 'hook-silent-2026-07-29'/u);
  assert.match(migration, /hook_format_id = asset\.visual_group/u);
  assert.match(migration, /populated_hook_count <> 78/u);
  assert.match(migration, /avatar_assets_hook_format_id_fkey/u);
  assert.doesNotMatch(migration, /set[\s\S]{0,80}visual_group\s*=/iu);
});

test("keeps Preferred mappings and audio selections empty during this phase", () => {
  assert.doesNotMatch(
    migration,
    /insert into public\.hook_format_audio_preferences/iu,
  );
  assert.doesNotMatch(migration, /insert into public\.hook_audio_selections/iu);
  assert.doesNotMatch(migration, /hook_video_audio_override/iu);
  assert.doesNotMatch(migration, /video_override/iu);
});

test("stores controlled and traceable future audio selections", () => {
  for (const column of [
    "hook_video_suggestion_id",
    "hook_video_draft_id",
    "hook_video_id",
    "hook_video_source",
    "hook_format_id",
    "audio_asset_id",
    "content_fingerprint",
    "audio_intent",
    "selection_source",
    "match_score",
    "matching_version",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, "u"), column);
  }

  assert.match(
    migration,
    /selection_source in \([\s\S]+?'format_locked',[\s\S]+?'format_preferred',[\s\S]+?'dynamic'[\s\S]+?\)/u,
  );
  assert.match(migration, /audio_intent ->> 'mood' in/u);
  assert.match(migration, /audio_intent ->> 'hookType' in/u);
  assert.match(migration, /audio_intent ->> 'energy' in/u);
});

test("indexes every foreign key used by the new Hook audio foundation", () => {
  assert.match(indexMigration, /hook_formats_locked_audio_asset_idx/u);
  assert.match(indexMigration, /hook_audio_selections_suggestion_idx/u);
  assert.match(indexMigration, /hook_audio_selections_format_idx/u);
});
