import assert from "node:assert/strict";
import test from "node:test";

import type { BackgroundJobRow } from "../types.js";
import { isValidAnalyticsSyncInput } from "./sync-analytics.js";

test("accepts YouTube channel analytics jobs", () => {
  assert.equal(isValidAnalyticsSyncInput(createJob("youtube_channel")), true);
});

test("rejects unknown analytics operations", () => {
  assert.equal(isValidAnalyticsSyncInput(createJob("unsupported_operation")), false);
});

function createJob(operation: string): BackgroundJobRow {
  const now = new Date().toISOString();

  return {
    attempt_count: 0,
    cancel_requested_at: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: "4f7d8a6b-4d79-4ba6-9a09-944b4e046aa5",
    input_json: { operation, userId: "user-test" },
    input_reference: null,
    job_type: "analytics_sync",
    last_delivery_at: now,
    last_heartbeat_at: null,
    locked_at: null,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: "analytics",
    queue_message_id: null,
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
