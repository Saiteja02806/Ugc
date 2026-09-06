import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migrations/20260906180000_add_durable_reaction_generation_worker.sql",
);
const enqueue = readProjectFile("lib/reaction-format/generation-jobs.ts");
const workerJob = readProjectFile("worker/src/jobs/generate-reaction.ts");
const workerDispatch = readProjectFile("worker/src/jobs/index.ts");
const workerRenderer = readProjectFile("worker/src/lib/render-engine.ts");
const workerStore = readProjectFile("worker/src/lib/supabase.ts");
const workerProcessor = readProjectFile("worker/src/processor.ts");
const queueConfig = readProjectFile("lib/queues/config.ts");
const videoRenderWorkerVariables = readProjectFile(
  "infra/gcp/video-render-worker/variables.tf",
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

test("routes Reaction generation to a deployed video-render worker", () => {
  assert.match(
    queueConfig,
    /reaction_generation:\s*\{\s*queueName: "video-render",\s*\}/,
  );
  assert.match(
    videoRenderWorkerVariables,
    /default\s*=\s*"render_edit_video,render_schedule_combination,render_wall_text_video,reaction_generation"/,
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
  assert.match(workerJob, /saveReactionRenderedMedia[\s\S]+completeReactionGenerationItemRender/);
});

test("retries only unfinished render items and never asks AI for character labels", () => {
  assert.match(workerJob, /if \(item\.render_status === "ready"\) continue/);
  assert.match(workerJob, /RetryableJobError\("One or more Reaction Reels could not be rendered/);
  assert.match(migration, /render_status in \('queued', 'rendering', 'ready', 'failed'\)/);
  assert.match(workerRenderer, /treatment: "caption_with_labels" \| "outlined_text" \| "white_card"/);
  const generator = readProjectFile("worker/src/lib/reaction-generation.ts");
  assert.match(generator, /const TREATMENTS = \["white_card", "outlined_text"\]/);
  assert.doesNotMatch(generator, /caption_with_labels/);
});

test("uses the canonical semantic shapes and fails a zero-ready run terminally", () => {
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
  assert.match(workerJob, /completion\.status === "failed"/);
  assert.match(workerProcessor, /failReactionGenerationRun/);
  assert.match(migration, /create or replace function public\.fail_reaction_generation_run_v1/);
  assert.match(migration, /when current_ready_count < run_record\.requested_count/);
});

test("reserves active clips and reports a catalog shortfall without another refill", () => {
  assert.match(workerStore, /getReservedReactionClipIds/);
  assert.match(workerJob, /reservedClipIds/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /reaction_generation_plan_clip_reserved/);
  assert.match(enqueue, /getCompletedReactionCoverageShortfall/);
  assert.match(enqueue, /Prepared \$\{readyCount\} of \$\{requestedCount\} Reaction Reels/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
