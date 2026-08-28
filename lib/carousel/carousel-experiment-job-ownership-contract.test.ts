import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const migration = read(
  "supabase/migrations/20260826100000_atomically_own_carousel_experiment_jobs.sql",
);
const jobStore = read("lib/jobs/background-jobs.ts");
const jobDispatch = read("lib/carousel/generation-jobs.ts");
const preparation = read("lib/carousel/prepare-business-profile.ts");

test("Carousel writer ownership is created before queue delivery in one database transaction", () => {
  assert.match(
    migration,
    /create or replace function public\.create_or_get_carousel_experiment_batch_job/i,
  );
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*carousel-experiment-job:/i);
  assert.match(migration, /insert into public\.background_jobs[\s\S]*generate_carousel/i);
  assert.match(
    migration,
    /carousel-experiment-batch:' \|\| p_experiment_batch_id::text/i,
  );
  assert.match(
    migration,
    /update public\.carousel_content_plan_items[\s\S]*reserved_by_job_id = v_job\.id/i,
  );
  assert.match(
    migration,
    /update public\.carousel_generations[\s\S]*trigger_run_id = v_job\.id::text/i,
  );
  assert.match(
    migration,
    /update public\.carousel_experiment_assignments[\s\S]*status = case/i,
  );
  assert.match(
    migration,
    /update public\.carousel_experiment_batches[\s\S]*planner_job_id = v_job\.id/i,
  );
  assert.match(
    migration,
    /carousel_experiment_job_generation_ownership_mismatch/i,
  );
  assert.match(
    migration,
    /carousel_experiment_job_content_plan_ownership_mismatch/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_or_get_carousel_experiment_batch_job[\s\S]*to service_role/i,
  );
});

test("the app dispatches only an already-owned Carousel job", () => {
  assert.match(jobStore, /createOrGetCarouselExperimentBatchJob/);
  assert.match(
    jobStore,
    /rpc\(\s*"create_or_get_carousel_experiment_batch_job"/,
  );
  assert.match(jobDispatch, /createOrGetCarouselExperimentBatchJob\(/);
  assert.doesNotMatch(
    jobDispatch,
    /beforeDispatch\?: \(jobId: string\) => Promise<void>/,
  );
  assert.doesNotMatch(preparation, /beforeDispatch:\s*async \(candidateJobId\)/);
  assert.doesNotMatch(preparation, /attachCarouselContentPlanItemsToJob\(/);
});

test("the ownership transaction has the prerequisites for a ten-way concurrency canary", () => {
  // This is a local contract test. The real ten-way race is run against the
  // deployed SQL function before increasing the Carousel worker limit.
  assert.match(
    migration,
    /pg_advisory_xact_lock[\s\S]*carousel-experiment-job:/i,
  );
  assert.match(
    migration,
    /carousel-experiment-batch:' \|\| p_experiment_batch_id::text/i,
  );
  assert.match(migration, /coalesce\(array_length\(p_carousel_ids, 1\), 0\) <> 5/i);
  assert.match(migration, /reserved_by_job_id = v_job\.id/i);
});

test("an interrupted generation-to-assignment link is repaired but a conflict fails closed", () => {
  assert.match(
    preparation,
    /missing durable generation ownership/i,
  );
  assert.match(
    preparation,
    /linked to another assignment/i,
  );
  assert.match(preparation, /linkCarouselExperimentAssignment\(/);
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
