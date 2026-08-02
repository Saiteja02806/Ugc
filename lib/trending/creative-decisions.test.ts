import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migrations/20260802044000_create_trending_creative_decisions.sql",
);
const route = readProjectFile(
  "app/api/trending/feed/decisions/route.ts",
);
const service = readProjectFile("lib/trending/creative-decisions.ts");

test("persists the required owner, creative, decision, and timestamp fields", () => {
  assert.match(migration, /create table if not exists public\.trending_creative_decisions/);
  assert.match(migration, /user_id text not null/);
  assert.match(migration, /creative_id uuid not null/);
  assert.match(migration, /decision text not null[\s\S]*'accepted'[\s\S]*'rejected'/);
  assert.match(migration, /decided_at timestamptz not null default now\(\)/);
  assert.match(
    migration,
    /unique \([\s\S]*user_id,[\s\S]*format,[\s\S]*creative_id[\s\S]*\)/,
  );
});

test("records all three formats and atomically retires their active assignments", () => {
  assert.match(migration, /create or replace function public\.record_trending_creative_decision/);

  for (const format of ["carousel", "hook_video", "wall_text"]) {
    assert.match(migration, new RegExp(`when '${format}' then`));
  }

  assert.match(migration, /update public\.user_carousel_assignments/);
  assert.match(migration, /update public\.user_hook_video_assignments/);
  assert.match(migration, /update public\.user_wall_text_assignments/);
  assert.match(migration, /when p_decision = 'accepted' then 'selected'/);
  assert.match(migration, /when p_decision = 'accepted' then 'accepted'/);
  assert.match(migration, /else 'completed_skipped'/);
  assert.match(migration, /not coalesce\(assignment_exists, false\)/);
  assert.match(migration, /not coalesce\(assignment_is_active, false\)/);
  assert.match(
    migration,
    /completion_action in \('accepted', 'skipped', 'saved', 'scheduled'\)/,
  );
});

test("makes repeated identical writes idempotent and conflicting writes fail closed", () => {
  assert.match(
    migration,
    /if recorded\.assignment_id <> p_assignment_id[\s\S]*or recorded\.decision <> p_decision/,
  );
  assert.match(migration, /raise exception 'trending_creative_decision_conflict'/);
  assert.match(migration, /return next recorded;[\s\S]*return;/);
});

test("keeps decision storage server-only", () => {
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /revoke all privileges on table public\.trending_creative_decisions[\s\S]*from anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.record_trending_creative_decision[\s\S]*from public, anon, authenticated/,
  );
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("authenticates the decision route and derives userId from Firebase", () => {
  assert.match(route, /requireFirebaseUser\(request\)/);
  assert.match(route, /userId = \(await requireFirebaseUser\(request\)\)\.uid/);
  assert.match(route, /decision: z\.enum\(\["accepted", "rejected"\]\)/);
  assert.match(route, /format: z\.enum\(\["carousel", "hook_video", "wall_text"\]\)/);
  assert.match(route, /recordTrendingCreativeDecision\(\{[\s\S]*userId/);
  assert.match(service, /record_trending_creative_decision/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
