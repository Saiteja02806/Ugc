import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migrations/20260906180000_add_durable_reaction_generation_worker.sql",
);
const provenanceMigration = readProjectFile(
  "supabase/migrations/20260911120000_harden_reaction_generation_provenance.sql",
);
const splitRenderMigration = readProjectFile(
  "supabase/migrations/20260909140000_split_reaction_reel_render_workers.sql",
);
const enqueue = readProjectFile("lib/reaction-format/generation-jobs.ts");
const workerJob = readProjectFile("worker/src/jobs/generate-reaction.ts");
const reactionRenderJob = readProjectFile("worker/src/jobs/render-reaction.ts");
const workerDispatch = readProjectFile("worker/src/jobs/index.ts");
const workerRenderer = readProjectFile("worker/src/lib/render-engine.ts");
const workerStore = readProjectFile("worker/src/lib/supabase.ts");
const workerProcessor = readProjectFile("worker/src/processor.ts");
const queueConfig = readProjectFile("lib/queues/config.ts");
const aiWorkerVariables = readProjectFile(
  "infra/gcp/ai-generation-worker/variables.tf",
);
const aiWorkerTerraform = readProjectFile(
  "infra/gcp/ai-generation-worker/main.tf",
);
const aiWorkerExample = readProjectFile(
  "infra/gcp/ai-generation-worker/terraform.tfvars.example",
);
const reactionRenderWorker = readProjectFile(
  "infra/gcp/reaction-render-worker/main.tf",
);

test("keeps the durable Reaction job type additive to the established worker contract", () => {
  for (const jobType of [
    "analytics_sync",
    "carousel_content_plan_generation",
    "wall_text_generation",
    "reaction_generation",
  ]) {
    assert.match(migration, new RegExp(`'${jobType}'`));
  }
  assert.match(enqueue, /jobType: REACTION_GENERATION_JOB_TYPE/);
  assert.match(workerDispatch, /job\.job_type === "reaction_generation"/);
});

test("plans Reactions on the AI worker and renders each item on a dedicated scale-to-zero service", () => {
  assert.match(
    queueConfig,
    /reaction_generation:\s*\{[\s\S]*?queueName: "ai-generation",\s*\}/,
  );
  assert.match(
    queueConfig,
    /reaction_render:\s*\{\s*queueName: "reaction-render",\s*\}/,
  );
  assert.match(
    aiWorkerVariables,
    /variable "worker_job_types"[\s\S]*?default\s*=\s*"[^"]*\breaction_generation\b[^"]*"/,
  );
  assert.match(reactionRenderWorker, /min_instance_count = var\.min_instance_count/);
  assert.match(reactionRenderWorker, /max_instance_count = var\.max_instance_count/);
  assert.match(reactionRenderWorker, /value = "reaction_render"/);
});

test("refuses a Reaction-enabled AI worker without its dedicated task endpoint", () => {
  assert.match(
    aiWorkerTerraform,
    /worker_job_types[\s\S]+reaction_generation[\s\S]+reaction_render_task_url/,
  );
  assert.match(
    aiWorkerTerraform,
    /\^https:\/\/\[\^\/\?\#\]\+\/tasks\/jobs\$/,
  );
  assert.match(
    aiWorkerExample,
    /reaction_render_task_url\s*=\s*"https:\/\/ugc-reaction-render-worker-/,
  );
});

test("persists the immutable plan before any Reaction video render", () => {
  assert.match(migration, /create table if not exists public\.reaction_generation_runs/);
  assert.match(migration, /create table if not exists public\.reaction_generation_run_items/);
  assert.match(migration, /unique \(generation_run_id, slot_index\)/);
  assert.match(migration, /create or replace function public\.persist_reaction_generation_plan_v1/);
  assert.match(migration, /reaction_generation_plan_reuses_clip/);
  assert.match(workerJob, /ensureReactionGenerationRun[\s\S]+listActiveReactionCatalog/);
  assert.match(workerJob, /createAndPersistPlan[\s\S]+persistReactionGenerationPlan/);
  assert.match(workerJob, /run\.brief_payload[\s\S]+items: \[\]/);
});

test("renders only private catalog inputs and records one owner-scoped final MP4", () => {
  assert.match(workerRenderer, /downloadStoredObjectBuffer\(payload\.backgroundStorageKey\)/);
  assert.match(workerRenderer, /downloadStoredObjectBuffer\(payload\.foregroundStorageKey\)/);
  assert.match(workerRenderer, /libx264[\s\S]+yuv420p/);
  assert.match(workerRenderer, /"videos",\s*"rendered",\s*"reaction"/);
  assert.match(workerStore, /source_type: "reaction_render"/);
  assert.match(reactionRenderJob, /saveReactionRenderedMedia[\s\S]+completeReactionGenerationItemRenderV2/);
});

test("dispatches only unfinished render items and never asks AI for character labels", () => {
  assert.match(workerJob, /createReactionGenerationRenderJobs[\s\S]+enqueueReactionRenderTask/);
  assert.match(reactionRenderJob, /Reaction Reel rendering failed/);
  assert.match(migration, /render_status in \('queued', 'rendering', 'ready', 'failed'\)/);
  assert.match(workerRenderer, /treatment: "caption_with_labels" \| "outlined_text" \| "white_card"/);
  const generator = readProjectFile("worker/src/lib/reaction-generation.ts");
  assert.match(generator, /const TREATMENTS = \["white_card", "outlined_text"\]/);
  assert.doesNotMatch(generator, /caption_with_labels/);
});

test("uses the canonical semantic shapes and terminally records individual render failures", () => {
  const generator = readProjectFile("worker/src/lib/reaction-generation.ts");
  for (const semanticBeats of [
    "situation.*payoff",
    "expectation.*reality",
    "left.*right",
    "action.*realization",
    "setup.*escalation",
  ]) {
    assert.match(generator, new RegExp(semanticBeats));
  }
  assert.match(generator, /productCopyPattern/);
  assert.match(workerProcessor, /failReactionGenerationItemRenderV2/);
  assert.match(migration, /create or replace function public\.fail_reaction_generation_run_v1/);
  assert.match(splitRenderMigration, /when v_ready_count < v_run\.requested_count/);
});

test("reserves active clips and reports a catalog shortfall without another refill", () => {
  assert.match(workerStore, /getReservedReactionClipIds/);
  assert.match(workerJob, /reservedClipIds/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /reaction_generation_plan_clip_reserved/);
  assert.match(enqueue, /getCompletedReactionCoverageShortfall/);
  assert.match(enqueue, /Prepared \$\{readyCount\} of \$\{requestedCount\} Reaction Reels/);
});

test("binds every business Reaction plan to profile context and quarantines QA output", () => {
  assert.match(provenanceMigration, /reaction_generation_context_v1/);
  assert.match(provenanceMigration, /validate_reaction_generation_background_job_v1/);
  assert.match(provenanceMigration, /validate_reaction_creative_origin_v1/);
  assert.match(provenanceMigration, /reaction_generation_creative_run_required/);
  assert.match(provenanceMigration, /reaction_generation_origin_mismatch/);
  assert.match(provenanceMigration, /validate_reaction_generation_plan_provenance_v1/);
  assert.match(provenanceMigration, /reaction_generation_plan_provenance_invalid/);
  assert.match(provenanceMigration, /reaction_generation_context_mismatch/);
  assert.match(provenanceMigration, /generation_origin text not null default 'business_generation'/);
  assert.match(provenanceMigration, /generation_origin = 'internal_qa'/);
  assert.match(provenanceMigration, /state = 'completed_skipped'/);
  assert.match(provenanceMigration, /business_profiles as profile/);
  assert.match(readProjectFile("lib/trending/reaction-feed.ts"), /generation_origin.*business_generation/);
  assert.match(workerJob, /run\.generation_context/);
});

test("retries only a catalog-blocked Reaction request after assets become active", () => {
  assert.match(enqueue, /REACTION_CATALOG_UNAVAILABLE_MESSAGE/);
  assert.match(enqueue, /params\.job\.status !== "failed"/);
  assert.match(enqueue, /params\.job\.attemptCount >= params\.job\.maxAttempts/);
  assert.match(enqueue, /hasActiveReactionCatalog/);
  assert.match(enqueue, /reaction_clip_assets[\s\S]+eq\("status", "active"\)[\s\S]+eq\("has_alpha", true\)/);
  assert.match(enqueue, /reaction_background_assets[\s\S]+eq\("status", "active"\)/);
  assert.match(enqueue, /retryAndDispatchBackgroundJob/);
  assert.match(enqueue, /current && current\.status !== "failed"/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
