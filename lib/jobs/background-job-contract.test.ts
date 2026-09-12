import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalBackgroundJobType,
  getPublicBackgroundJob,
  isActiveBackgroundJobStatus,
  isRetryableBackgroundJob,
  isTerminalBackgroundJobStatus,
} from "./background-job-contract.ts";
import type { BackgroundJobRecord } from "./background-jobs.ts";

test("normalizes implementation job aliases to the public contract", () => {
  assert.equal(getCanonicalBackgroundJobType("generate_image"), "image_generation");
  assert.equal(getCanonicalBackgroundJobType("generate_hook_video"), "video_generation");
  assert.equal(getCanonicalBackgroundJobType("render_edit_video"), "final_render");
  assert.equal(
    getCanonicalBackgroundJobType("render_create_content_video"),
    "final_render",
  );
  assert.equal(getCanonicalBackgroundJobType("publish_social_post"), "social_publish");
  assert.equal(
    getCanonicalBackgroundJobType("wall_text_content_plan_generation"),
    "wall_text_generation",
  );
  assert.equal(
    getCanonicalBackgroundJobType("paid_trending_prebuild"),
    "trending_prebuild",
  );
});

test("classifies active and terminal states", () => {
  assert.equal(isActiveBackgroundJobStatus("waiting_external_service"), true);
  assert.equal(isActiveBackgroundJobStatus("cancel_requested"), true);
  assert.equal(isTerminalBackgroundJobStatus("completed"), true);
  assert.equal(isTerminalBackgroundJobStatus("stalled"), false);
});

test("public jobs expose safe errors and retry state without internal errors", () => {
  const job = {
    attemptCount: 1,
    errorCode: "PROVIDER_TIMEOUT",
    errorMessage: "provider token=secret internal stack",
    jobType: "generate_hook_video",
    maxAttempts: 3,
    status: "failed",
  } as BackgroundJobRecord;

  assert.equal(isRetryableBackgroundJob(job), true);
  assert.deepEqual(getPublicBackgroundJob(job).error, {
    code: "PROVIDER_TIMEOUT",
    message: "The generation provider timed out. You can retry the job.",
    retryable: true,
  });
  assert.equal(JSON.stringify(getPublicBackgroundJob(job)).includes("secret"), false);
});

test("public Wall jobs never expose private provider or validation diagnostics", () => {
  const job = {
    attemptCount: 3,
    errorCode: "wall_text_provider_billing_limit",
    errorMessage: "project_spend_limit_exceeded request=req_secret model=gpt-5.6-luna",
    jobType: "wall_text_generation",
    maxAttempts: 3,
    status: "failed",
  } as BackgroundJobRecord;

  assert.deepEqual(getPublicBackgroundJob(job).error, {
    code: "CONTENT_PREPARATION_UNAVAILABLE",
    message: "We’re handling content preparation automatically. No action is needed from you.",
    retryable: false,
  });
  const publicJob = JSON.stringify(getPublicBackgroundJob(job));
  assert.equal(publicJob.includes("billing"), false);
  assert.equal(publicJob.includes("req_secret"), false);
  assert.equal(publicJob.includes("gpt-5.6-luna"), false);
});
