import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260907065625_clear_resolved_daily_feed_recovery_errors.sql",
  "utf8",
);

test("a fully resolved daily feed clears only stale recovery diagnostics", () => {
  assert.match(migration, /slot\.state in \('planned', 'preparing', 'failed'\)/);
  assert.match(migration, /feed\.status in \('ready', 'completed'\)/);
  assert.match(migration, /last_recovery_error = null/);
});
