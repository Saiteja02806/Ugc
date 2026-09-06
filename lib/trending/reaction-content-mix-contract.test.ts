import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialog = readProjectFile(
  "components/trending/trending-content-mix-dialog.tsx",
);
const route = readProjectFile("app/api/trending/content-mix/route.ts");
const database = readProjectFile("lib/trending/unified-daily-feed-db.ts");
const migration = readProjectFile(
  "supabase/migrations/20260906120000_add_reaction_trending_delivery.sql",
);

test("Adjust exposes Reaction Reels as an editable fourth format", () => {
  assert.match(dialog, /format: "reaction"/);
  assert.match(dialog, /label: "Reaction Reels"/);
  assert.match(dialog, /updateMix\(format, Number\(event\.target\.value\)\)/);
  assert.match(route, /reaction: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.match(
    route,
    /value\.carousel \+\s*value\.wall_text \+\s*value\.hook_video \+\s*value\.reaction !==\s*100/,
  );
});

test("saving and reserving a four-format mix includes Reaction percent", () => {
  assert.match(database, /p_reaction_percent: params\.mix\.reaction \?\? 0/);
  assert.match(
    database,
    /ensure_daily_trending_feed_plan[\s\S]*p_reaction_percent: params\.preference\.mix\.reaction \?\? 0/,
  );
  assert.match(
    migration,
    /create or replace function public\.save_trending_content_mix_preference \([\s\S]*p_reaction_percent[\s\S]*reaction_percent/,
  );
  assert.match(
    migration,
    /create or replace function public\.ensure_daily_trending_feed_plan \([\s\S]*p_reaction_percent[\s\S]*'reaction'/,
  );
  assert.match(
    migration,
    /create or replace function public\.replan_daily_trending_unbound_slots \([\s\S]*p_reaction_percent[\s\S]*reaction_assignment_id is null/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
