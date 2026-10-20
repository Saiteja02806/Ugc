import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260924183540_reopen_trending_reconciliation_on_recompleted_jobs.sql",
  "utf8",
);

test("reopens only a completed reconciliation when its source job completes again", () => {
  assert.match(
    migration,
    /old\.status is not distinct from new\.status[\s\S]+new\.status <> 'completed'[\s\S]+new\.user_id is null/i,
  );
  assert.match(
    migration,
    /update public\.trending_feed_reconciliation_outbox[\s\S]+status = 'pending'[\s\S]+completed_at = null[\s\S]+where outbox\.source_job_id = new\.id[\s\S]+outbox\.status = 'completed'/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.reopen_completed_trending_feed_reconciliation\(\)[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /create trigger reopen_completed_trending_feed_reconciliation[\s\S]+after update of status on public\.background_jobs/i,
  );
});
