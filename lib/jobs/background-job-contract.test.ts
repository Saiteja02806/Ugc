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

test("public video jobs explain a provider balance failure without exposing diagnostics", () => {
  const job = {
    attemptCount: 1,
    errorCode: "JOB_FAILED",
    errorMessage:
      "Seedance request request-private ended with status failed: Your credit balance is too low.",
    jobType: "generate_hook_video",
    maxAttempts: 3,
    status: "failed",
  } as BackgroundJobRecord;

  assert.deepEqual(getPublicBackgroundJob(job).error, {
    code: "JOB_FAILED",
    message:
      "The video provider's credit balance is too low to create this video. Contact support before starting a new generation.",
    retryable: false,
  });
  assert.equal(JSON.stringify(getPublicBackgroundJob(job)).includes("request-private"), false);
});

test("terminal and uncertain provider requests cannot be replayed even with attempts remaining", () => {
  for (const errorCode of ["PROVIDER_CONTENT_MODERATION", "PROVIDER_INSUFFICIENT_CREDITS", "provider_operation_failed", "provider_submission_uncertain"]) {
    const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType: "generate_hook_video", errorCode, errorMessage: "private provider diagnostics" } as BackgroundJobRecord;
    assert.equal(isRetryableBackgroundJob(job), false);
    assert.equal(getPublicBackgroundJob(job).error?.retryable, false);
    assert.doesNotMatch(getPublicBackgroundJob(job).error?.message ?? "", /private provider diagnostics|You can retry/);
  }
});

test("explains both new and historical Runway moderation rejections without guessing the input", () => {
  for (const errorCode of ["PROVIDER_CONTENT_MODERATION", "provider_operation_failed", "JOB_FAILED", null]) {
    const job = {
      attemptCount: 1,
      errorCode,
      errorMessage: "Runway task failed: Your request was blocked by this model provider's content moderation system. token=private-secret request-private",
      jobType: "generate_hook_video",
      maxAttempts: 3,
      status: "failed",
    } as BackgroundJobRecord;

    assert.deepEqual(getPublicBackgroundJob(job).error, {
      code: "PROVIDER_CONTENT_MODERATION",
      message: "The model provider blocked this generation through content moderation. Review your prompt and reference media before starting a new generation.",
      retryable: false,
    });
    assert.equal(isRetryableBackgroundJob(job), false);
    assert.doesNotMatch(JSON.stringify(getPublicBackgroundJob(job)), /private-secret|request-private|Higgsfield|You can retry|public.figure/);
  }
});

test("historical Runway terminal failures cannot be replayed with remaining attempts", () => {
  for (const errorMessage of ["Runway task failed: Internal failure request-private", "Runway task failed: content moderation service temporarily unavailable", "Runway task was cancelled."]) {
    const job = { attemptCount: 1, errorCode: "JOB_FAILED", errorMessage, jobType: "video_generation", maxAttempts: 3, status: "failed" } as BackgroundJobRecord;
    assert.equal(getPublicBackgroundJob(job).error?.code, "provider_operation_failed");
    assert.equal(isRetryableBackgroundJob(job), false);
    assert.doesNotMatch(getPublicBackgroundJob(job).error?.message ?? "", /request-private|You can retry|blocked this generation/);
  }
});

test("does not misclassify unrelated diagnostics or publish arbitrary provider messages", () => {
  for (const errorMessage of ["Internal stack token=private-secret", "content moderation service temporarily unavailable", "Runway status could not be read"]) {
    const job = { attemptCount: 1, errorCode: "JOB_FAILED", errorMessage, jobType: "generate_hook_video", maxAttempts: 3, status: "failed" } as BackgroundJobRecord;
    assert.equal(getPublicBackgroundJob(job).error?.code, "JOB_FAILED");
    assert.equal(isRetryableBackgroundJob(job), true);
    assert.match(getPublicBackgroundJob(job).error?.message ?? "", /cause could not be identified/);
    assert.doesNotMatch(JSON.stringify(getPublicBackgroundJob(job)), /private-secret|temporarily unavailable/);
  }
});

test("retry suggestions reflect exhausted attempts without hiding a known reason", () => {
  const job = { attemptCount: 3, errorCode: "PROVIDER_TIMEOUT", errorMessage: "private-secret", jobType: "generate_hook_video", maxAttempts: 3, status: "failed" } as BackgroundJobRecord;
  assert.equal(isRetryableBackgroundJob(job), false);
  assert.match(getPublicBackgroundJob(job).error?.message ?? "", /provider timed out/);
  assert.doesNotMatch(getPublicBackgroundJob(job).error?.message ?? "", /You can retry/);
});

test("video-specific historical detection leaves Wall privacy and other jobs unchanged", () => {
  for (const jobType of ["wall_text_generation", "wall_text_content_plan_generation", "generate_carousel", "generate_image"] as const) {
    const job = { attemptCount: 1, errorCode: "JOB_FAILED", errorMessage: "Runway task failed: Your request was blocked by this model provider's content moderation system.", jobType, maxAttempts: 3, status: "failed" } as BackgroundJobRecord;
    assert.equal(getPublicBackgroundJob(job).error?.code, jobType.startsWith("wall_text") ? "CONTENT_PREPARATION_UNAVAILABLE" : "JOB_FAILED");
    assert.doesNotMatch(getPublicBackgroundJob(job).error?.message ?? "", /moderation/);
  }
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
