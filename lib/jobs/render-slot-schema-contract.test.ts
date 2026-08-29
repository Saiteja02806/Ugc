import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const migration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260828160000_add_durable_video_render_slots.sql",
);
const launcher = read("app/api/internal/jobs/launch-render/route.ts");
const jobs = read("lib/jobs/background-jobs.ts");

test("render capacity is a durable ten-slot database gate", () => {
  assert.match(migration, /create table if not exists public\.video_render_execution_slots/i);
  assert.match(migration, /generate_series\(1, 10\)/i);
  assert.match(migration, /background_job_id uuid unique/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /claim_video_render_execution_slot/i);
  assert.match(migration, /release_video_render_slot_on_background_job_state_change/i);
  assert.match(migration, /after update of status on public\.background_jobs/i);
});

test("the launcher claims capacity before Cloud Run and releases only a failed launch", () => {
  assert.match(jobs, /claimVideoRenderExecutionSlot/);
  assert.match(jobs, /attachVideoRenderExecutionSlot/);
  assert.match(jobs, /releaseVideoRenderExecutionSlot/);
  assert.match(
    launcher,
    /claimVideoRenderExecutionSlot\([\s\S]*?launchBackgroundRenderJob\(/,
  );
  assert.match(
    launcher,
    /launchBackgroundRenderJob\([\s\S]*?attachVideoRenderExecutionSlot\(/,
  );
  assert.match(
    launcher,
    /if \(!slotAttached\)[\s\S]*?Render launch is being confirmed/,
  );
  assert.match(
    launcher,
    /catch \(error\) \{[\s\S]*?releaseVideoRenderExecutionSlot\(/,
  );
  assert.match(launcher, /Render capacity is temporarily full/);
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
