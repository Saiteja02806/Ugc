import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260905150000_create_reaction_asset_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

test("reaction catalog stores only the approved reviewer tags", () => {
  assert.match(migration, /create table if not exists public\.reaction_clip_assets/u);
  assert.match(migration, /reactions text\[\]/u);
  assert.match(migration, /subject_count text/u);
  assert.match(migration, /composition text/u);
  assert.match(migration, /foreground_anchor text/u);
  assert.match(migration, /foreground_height_percent numeric/u);
  assert.match(migration, /create table if not exists public\.reaction_background_assets/u);
  assert.match(migration, /context_tags text\[\]/u);
  assert.match(migration, /foreground_placement text/u);
  assert.match(migration, /reaction_asset_tags_are_clean/u);
  assert.doesNotMatch(migration, /energy|rights_status|text_safe|supports_character_labels/u);
});

test("active catalog assets cannot bypass the agreed matching metadata", () => {
  assert.match(
    migration,
    /reaction_clip_assets_active_metadata_chk[\s\S]+has_alpha[\s\S]+nullif\(btrim\(source_storage_key\), ''\) is not null[\s\S]+cardinality\(reactions\) between 1 and 3[\s\S]+subject_count is not null[\s\S]+composition is not null[\s\S]+foreground_anchor is not null[\s\S]+foreground_height_percent is not null/u,
  );
  assert.match(
    migration,
    /reaction_background_assets_active_metadata_chk[\s\S]+nullif\(btrim\(source_storage_key\), ''\) is not null[\s\S]+cardinality\(context_tags\) >= 1[\s\S]+foreground_placement is not null/u,
  );
});

test("reaction catalog deduplicates source files and indexes active selection", () => {
  assert.match(
    migration,
    /create unique index if not exists reaction_clip_assets_source_sha256_idx[\s\S]+source_sha256/u,
  );
  assert.match(
    migration,
    /create unique index if not exists reaction_background_assets_source_sha256_idx[\s\S]+source_sha256/u,
  );
  assert.match(
    migration,
    /reaction_clip_assets_active_selection_idx[\s\S]+where status = 'active' and has_alpha/u,
  );
});

test("reaction catalog is service-only until a dedicated review surface exists", () => {
  assert.match(migration, /enable row level security/u);
  assert.match(
    migration,
    /revoke all on table public\.reaction_clip_assets, public\.reaction_background_assets[\s\S]+from public, anon, authenticated/u,
  );
  assert.match(migration, /to postgres, service_role/u);
});
