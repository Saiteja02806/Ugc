import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  TRENDING_HOOK_FEED_GENERATION_MODE,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_REACTION_SELECTION_VERSION,
} from "../lib/trending-hook-copy.js";
import type { BackgroundJobRow } from "../types.js";
import { RetryableJobError } from "../retryable-job-error.js";
import {
  ensureTrendingHookChunkMakesProgress,
  runGenerateTrendingHookCopyJob,
} from "./generate-trending-hook-copy.js";

test("a durable Hook chunk rejects zero progress as retryable", () => {
  assert.throws(
    () => ensureTrendingHookChunkMakesProgress(3, 0),
    (error: unknown) =>
      error instanceof RetryableJobError &&
      error.code === "trending_hook_generation_zero_progress" &&
      error.retryAfterSeconds === 15,
  );
});

test("a durable Hook chunk accepts progress and completed runs", () => {
  assert.doesNotThrow(() => ensureTrendingHookChunkMakesProgress(3, 1));
  assert.doesNotThrow(() => ensureTrendingHookChunkMakesProgress(0, 0));
});

test("a completed durable Hook chunk skips model generation on worker retry", async () => {
  let progressReads = 0;
  const store = {
    async getTrendingHookGenerationRunChunkProgress() {
      progressReads += 1;
      return {
        accepted_count: 1,
        already_persisted: true,
        completed_valid_count: 3,
        remaining_valid_count: 0,
        run_status: "completed",
      };
    },
  } as unknown as SupabaseJobStore;

  const result = await runGenerateTrendingHookCopyJob(createJob(), { store });

  assert.equal(progressReads, 1);
  assert.equal(result.ideaCount, 1);
  assert.deepEqual(result.generationRun, {
    completedValidCount: 3,
    id: "26331fe5-e2c0-421c-b263-ab589f847fa3",
    remainingValidCount: 0,
    status: "completed",
    targetValidCount: 3,
  });
});

function createJob(): BackgroundJobRow {
  const now = new Date().toISOString();

  return {
    attempt_count: 1,
    cancel_requested_at: null,
    queue_message_id: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: "a934b429-7b8e-4682-95c6-e641271325bd",
    input_json: {
      businessProfile: {
        businessName: "Calorie Fit",
        mainProblem: "Meal logging interrupts the day",
      },
      businessProfileId: "8256336c-1e89-449d-b9ce-da0d8f369649",
      businessProfileVersion: 1,
      candidates: [{
        candidateIndex: 0,
        durationSeconds: 3,
        influencerId: "catalog:creator-001",
        influencerKey: "creator_001",
        influencerName: "Creator 001",
        influencerVideoId: "video-1",
        influencerVideoTitle: "Creator 001 - Shock Surprise",
        reactionType: "shock_surprise",
        sourceDurationSeconds: 3,
        sourceKind: "catalog",
        thumbnailUrl: null,
        trimEnd: 3,
        trimStart: 0,
        visualGroup: "indoor_selfie_closeup",
      }],
      generationMode: TRENDING_HOOK_FEED_GENERATION_MODE,
      generationRunChunkId: "60c2ff83-b289-4e0d-87b9-25219beaa3e1",
      generationRunId: "26331fe5-e2c0-421c-b263-ab589f847fa3",
      generationRunRemainingValidCount: 1,
      performanceSignals: {
        formatSignals: [],
        preferredPurposes: [],
      },
      promptVersion: TRENDING_HOOK_PROMPT_VERSION,
      selectionVersion: TRENDING_HOOK_REACTION_SELECTION_VERSION,
      userId: "user-test",
    },
    input_reference: null,
    job_type: "generate_trending_hook_copy",
    last_delivery_at: now,
    last_heartbeat_at: null,
    locked_at: null,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: null,
    queue_name: "ugc-ai-generation",
    queue_provider: "gcp",
    queued_at: now,
    stage: "processing",
    started_at: now,
    status: "processing",
    updated_at: now,
    user_id: "user-test",
    worker_execution_id: null,
    worker_id: "worker-test",
  };
}
