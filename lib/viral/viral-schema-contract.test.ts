import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260812112037_create_viral_hook_data_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

test("stores Instagram references without storing original media", () => {
  assert.match(migration, /create table if not exists public\.viral_references/i);
  assert.match(migration, /source_url text not null unique/i);
  assert.match(migration, /embed_html text not null/i);
  assert.match(migration, /platform text not null default 'instagram'/i);
  assert.doesNotMatch(migration, /viral_score|video_mp4|storage_path|download_url/i);
});

test("keeps one source URL in exactly one Viral section", () => {
  assert.match(
    migration,
    /section in \('hook_video', 'wall_of_text', 'slideshow'\)/i,
  );
  assert.match(migration, /source_url text not null unique/i);
  assert.match(
    migration,
    /publish_status in \('pending_review', 'published', 'hidden'\)/i,
  );
  assert.match(
    migration,
    /embed_status in \('active', 'suspected_unavailable', 'unavailable'\)/i,
  );
});

test("stores only the reviewed zero-to-end hook boundary for now", () => {
  assert.match(migration, /create table if not exists public\.viral_hook_config/i);
  assert.match(
    migration,
    /hook_start_ms integer generated always as \(0\) stored/i,
  );
  assert.match(migration, /hook_end_ms integer not null[\s\S]*hook_end_ms > 0/i);
  assert.match(migration, /reviewed_at timestamptz not null default now\(\)/i);
  assert.match(migration, /reviewed_by text not null/i);
  assert.doesNotMatch(migration, /replication_blueprint|generation_ready/i);
});

test("rejects hook timing for references from another section", () => {
  assert.match(
    migration,
    /create or replace function public\.validate_viral_hook_reference_section\(\)[\s\S]*security invoker/i,
  );
  assert.match(
    migration,
    /reference\.id = new\.reference_id[\s\S]*reference\.section = 'hook_video'/i,
  );
  assert.match(
    migration,
    /before insert or update of reference_id[\s\S]*on public\.viral_hook_config/i,
  );
});

test("keeps reference and timing tables inaccessible to customer database roles", () => {
  assert.equal(
    (migration.match(/enable row level security/g) ?? []).length,
    2,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.viral_references[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.viral_hook_config[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.viral_references[\s\S]*to service_role/i,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.viral_hook_config[\s\S]*to service_role/i,
  );
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /grant [^;]* to (anon|authenticated)/i);
  assert.match(
    migration,
    /revoke all on function public\.validate_viral_hook_reference_section\(\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.validate_viral_hook_reference_section\(\)[\s\S]*to service_role/i,
  );
});

test("defers reports, usage tracking, and replication tables", () => {
  assert.doesNotMatch(migration, /create table[^;]*viral_reports/i);
  assert.doesNotMatch(migration, /create table[^;]*viral_reference_usage/i);
  assert.doesNotMatch(migration, /replication_blueprint|generation_ready/i);
});
