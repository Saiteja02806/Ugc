import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const expandMigration = readMigration(
  "supabase/migrations/20260801100000_expand_background_jobs.sql",
);
const eventsMigration = readMigration(
  "supabase/migrations/20260801101000_create_background_job_events.sql",
);
const transitionsMigration = readMigration(
  "supabase/migrations/20260801102000_add_background_job_transition_functions.sql",
);
const generatedMediaPersistenceMigration = readMigration(
  "supabase/migrations/20260801104000_harden_generated_media_persistence.sql",
);

test("identifies deployed workers and lets independent AI jobs run concurrently", () => {
  const aiWorkerMain = readFileSync(
    "infra/gcp/ai-generation-worker/main.tf",
    "utf8",
  );
  const aiWorkerVariables = readFileSync(
    "infra/gcp/ai-generation-worker/variables.tf",
    "utf8",
  );

  assert.match(
    aiWorkerMain,
    /name\s+= "WORKER_ID"[\s\S]*var\.service_name[\s\S]*var\.worker_version[\s\S]*var\.worker_git_commit/,
  );
  assert.match(
    aiWorkerVariables,
    /variable "max_instance_count"[\s\S]*default\s+= 4/,
  );
});

test("expands background jobs with durable GCP-only lifecycle fields", () => {
  for (const field of [
    "stage",
    "progress",
    "input_reference",
    "output_reference",
    "error_code",
    "max_attempts",
    "worker_execution_id",
    "queued_at",
    "failed_at",
    "cancel_requested_at",
  ]) {
    assert.match(expandMigration, new RegExp(`add column if not exists ${field}`));
  }

  assert.match(expandMigration, /check \(queue_provider = 'gcp'\)/);
  assert.match(expandMigration, /add column if not exists queue_message_id/);
  assert.match(expandMigration, /background_jobs_sync_queue_message_id/);
  assert.match(
    expandMigration,
    /Temporary rollout compatibility alias for queue_message_id\. It does not select or enable AWS\./,
  );
  assert.match(expandMigration, /background_jobs_owner_type_idempotency_uidx/);
  assert.match(expandMigration, /background_jobs_recovery_heartbeat_idx/);
});

test("records append-only job events for direct worker state writes", () => {
  assert.match(eventsMigration, /create table if not exists public\.background_job_events/);
  assert.match(eventsMigration, /enable row level security/);
  assert.match(eventsMigration, /background_jobs_capture_state_event/);
  assert.match(eventsMigration, /after insert or update on public\.background_jobs/);
  assert.match(eventsMigration, /grant select, insert on table public\.background_job_events\s+to service_role/);
});

test("provides locked owner-scoped cancel, retry, claim, and recovery RPCs", () => {
  for (const functionName of [
    "transition_background_job",
    "request_background_job_cancel",
    "retry_background_job",
    "list_recoverable_background_jobs",
    "recover_background_job",
    "claim_background_job",
  ]) {
    assert.match(
      transitionsMigration,
      new RegExp(`create or replace function public\\.${functionName}`),
    );
  }

  assert.match(transitionsMigration, /where job\.id = p_job_id\s+and job\.user_id = p_user_id\s+for update/);
  assert.match(transitionsMigration, /job_recovery_exhausted/);
  assert.match(transitionsMigration, /grant execute on function public\.recover_background_job\(uuid\) to service_role/);
});

test("fences paid provider calls and completes generated media atomically", () => {
  const workerStore = readFileSync("worker/src/lib/supabase.ts", "utf8");
  assert.match(
    generatedMediaPersistenceMigration,
    /create table if not exists public\.generation_provider_operations/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /unique \(job_id, operation_key\)/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /'submission_uncertain'/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /create or replace function public\.complete_background_job/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /from public\.background_jobs as job[\s\S]+for update/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /insert into public\.media_assets[\s\S]+update public\.background_jobs as job/,
  );
  assert.match(
    generatedMediaPersistenceMigration,
    /grant execute on function public\.complete_background_job\(uuid, uuid, jsonb, text\)[\s\S]+to service_role/,
  );
  assert.match(workerStore, /rpc\("complete_background_job"/);
  assert.doesNotMatch(workerStore, /registerGeneratedMediaAsset/);
});

function readMigration(path: string) {
  return readFileSync(path, "utf8");
}
