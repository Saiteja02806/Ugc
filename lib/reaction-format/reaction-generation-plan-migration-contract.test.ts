import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Reaction plan persistence resolves returned-column names to table columns", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260906210000_fix_reaction_generation_plan_sql_ambiguity.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /#variable_conflict use_column/);
  assert.match(migration, /from public\.reaction_generation_runs as run[\s\S]+where run\.id = p_run_id/);
  assert.match(migration, /update public\.reaction_generation_runs as run[\s\S]+where run\.id = p_run_id/);
  assert.match(migration, /returning creative\.id into creative_id/);
  assert.match(migration, /returning assignment\.id into assignment_id/);
});
