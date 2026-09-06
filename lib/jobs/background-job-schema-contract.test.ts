import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const expandMigration = readMigration(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260801100000_expand_background_jobs.sql",
);
const eventsMigration = readMigration(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260801101000_create_background_job_events.sql",
);
const transitionsMigration = readMigration(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260801102000_add_background_job_transition_functions.sql",
);
const generatedMediaPersistenceMigration = readMigration(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260801104000_harden_generated_media_persistence.sql",
);
const geminiProviderMigration = readMigration(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260824120500_add_gemini_generation_provider.sql",
);
const idempotencyRecoveryMigration = readFileSync(
  "supabase/migrations/20260905123000_harden_wall_text_regeneration_recovery.sql",
  "utf8",
);

test("uses demand-scaled request workers for independent AI jobs", () => {
  const aiWorkerMain = readFileSync(
    "infra/gcp/ai-generation-worker/main.tf",
    "utf8",
  );
  const aiWorkerVariables = readFileSync(
    "infra/gcp/ai-generation-worker/variables.tf",
    "utf8",
  );
  const cloudTasks = readFileSync(
    "infra/gcp/foundation/cloud-tasks.tf",
    "utf8",
  );

  assert.match(
    aiWorkerMain,
    /name\s+= "WORKER_ID"[\s\S]*var\.service_name[\s\S]*var\.worker_version[\s\S]*var\.worker_git_commit/,
  );
  assert.match(
    aiWorkerVariables,
    /variable "min_instance_count"[\s\S]*default\s+= 0/,
  );
  assert.match(
    aiWorkerVariables,
    /variable "max_instance_count"[\s\S]*default\s+= 10/,
  );
  assert.match(aiWorkerMain, /cpu_idle\s+= true/);
  assert.match(
    cloudTasks,
    /ai-generation = \{[\s\S]*concurrent_dispatches = 20[\s\S]*dispatches_per_second = 5/,
  );
});

test("keeps services idle-cost-safe and video rendering one-shot", () => {
  for (const workerPath of [
    "infra/gcp/carousel-worker/main.tf",
    "infra/gcp/social-publish-worker/main.tf",
    "infra/gcp/video-render-worker/main.tf",
  ]) {
    assert.match(readFileSync(workerPath, "utf8"), /cpu_idle\s+= true/);
  }

  const videoWorker = readFileSync(
    "infra/gcp/video-render-worker/main.tf",
    "utf8",
  );
  const videoJobEnv = readFileSync(
    "infra/gcp/video-render-worker/locals.tf",
    "utf8",
  );
  const videoVariables = readFileSync(
    "infra/gcp/video-render-worker/variables.tf",
    "utf8",
  );

  assert.match(videoWorker, /resource "google_cloud_run_v2_job" "video_render_worker"/);
  assert.match(videoJobEnv, /WORKER_RUN_ONCE\s+= "true"/);
  assert.match(
    videoVariables,
    /variable "min_instance_count"[\s\S]*default\s+= 0/,
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

test("reuses an idempotent background job without surfacing a duplicate-key error", () => {
  const backgroundJobsSource = readFileSync("lib/jobs/background-jobs.ts", "utf8");

  assert.match(
    idempotencyRecoveryMigration,
    /create or replace function public\.create_or_get_background_job_v1[\s\S]+on conflict do nothing[\s\S]+coalesce\(job\.user_id, ''\) = coalesce\(p_user_id, ''\)/i,
  );
  assert.match(
    idempotencyRecoveryMigration,
    /'created', v_created[\s\S]+'job', to_jsonb\(v_job\)/i,
  );
  assert.match(
    backgroundJobsSource,
    /rpc\("create_or_get_background_job_v1"[\s\S]+create_or_get_background_job_v1 is unavailable/,
  );
  assert.doesNotMatch(
    backgroundJobsSource,
    /\.from\(BACKGROUND_JOBS_TABLE\)\s*\.insert\(/,
  );
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
    geminiProviderMigration,
    /provider in \('gemini', 'openai', 'runway', 'veo'\)/,
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

test("binds an AI worker image SHA to its Cloud Run identity and canary", () => {
  const dockerfile = readFileSync("worker/Dockerfile", "utf8");
  const cloudBuild = readFileSync("worker/cloudbuild.yaml", "utf8");
  const imageBuilder = readFileSync(
    "scripts/build-push-gcp-worker-image.mjs",
    "utf8",
  );
  const workerConfig = readFileSync("worker/src/config.ts", "utf8");
  const cutoverAuditRoute = readFileSync(
    "app/api/internal/gcp-cutover/audit/route.ts",
    "utf8",
  );
  const cutoverAuditScript = readFileSync(
    "scripts/test-production-gcp-cutover-audit.mjs",
    "utf8",
  );

  assert.match(
    dockerfile,
    /ARG WORKER_BUILD_GIT_COMMIT=missing[\s\S]+ENV WORKER_BUILD_GIT_COMMIT=\$\{WORKER_BUILD_GIT_COMMIT\}/,
  );
  assert.match(
    imageBuilder,
    /--build-arg[\s\S]+WORKER_BUILD_GIT_COMMIT=\$\{workerGitCommit\}/,
  );
  assert.match(
    imageBuilder,
    /--config[\s\S]+worker\/cloudbuild\.yaml[\s\S]+_WORKER_BUILD_GIT_COMMIT=\$\{workerGitCommit\}/,
  );
  assert.match(cloudBuild, /WORKER_BUILD_GIT_COMMIT=\$\{_WORKER_BUILD_GIT_COMMIT\}/);
  assert.match(
    workerConfig,
    /WORKER_GIT_COMMIT does not match the Git SHA baked into this worker image/,
  );
  assert.match(cutoverAuditRoute, /getAppReleaseIdentity\(\)/);
  assert.match(cutoverAuditScript, /--expected-release-sha/);
  assert.match(cutoverAuditScript, /assertWorkerReleaseIdentity/);
});

function readMigration(path: string) {
  return readFileSync(path, "utf8");
}
