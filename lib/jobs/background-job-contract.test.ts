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
  assert.equal(getCanonicalBackgroundJobType("publish_social_post"), "social_publish");
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
