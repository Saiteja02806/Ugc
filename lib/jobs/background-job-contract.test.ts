import assert from "node:assert/strict";
import test from "node:test";

test("OpenAI image moderation rejections are terminal, safe and actionable", () => {
  for (const jobType of ["generate_image", "image_generation"] as const) {
    const job = { jobType, status: "failed", errorCode: "moderation_blocked",
      errorMessage: "400 Your request was rejected by the safety system. request-private token=private-secret",
      attemptCount: 1, maxAttempts: 3 } as BackgroundJobRecord;
    const error = getPublicBackgroundJob(job).error;
    assert.equal(error?.code, "PROVIDER_CONTENT_MODERATION");
    assert.equal(error?.retryable, false);
    assert.match(error?.message ?? "", /blocked this generation through content moderation/);
    assert.doesNotMatch(JSON.stringify(error), /request-private|private-secret|You can retry/);
  }
});

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

test("public jobs expose only an allowlisted media format, without exposing their private input", () => {
  for (const [jobType, exploreFormat] of [["generate_hook_video", "hook"], ["generate_hook_video", "wall_text"], ["generate_image", "slideshow"]] as const) {
    const job = { jobType, status: "completed", input: { exploreFormat, privatePrompt: "private-input-value" } } as unknown as BackgroundJobRecord;
    const result = getPublicBackgroundJob(job);
    assert.equal(result.exploreFormat, exploreFormat);
    assert.equal(JSON.stringify(result).includes("private-input-value"), false);
  }
  for (const [jobType, exploreFormat] of [["generate_hook_video", "slideshow"], ["generate_image", "hook"], ["render_demo_video", "wall_text"], ["generate_image", "unknown"]] as const) {
    const job = { jobType, status: "completed", input: { exploreFormat } } as unknown as BackgroundJobRecord;
    assert.equal(Object.hasOwn(getPublicBackgroundJob(job), "exploreFormat"), false);
  }
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
      "Runway request request-private ended with status failed: You do not have enough credits to run this task.",
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

test("image billing failures identify provider credits without exposing raw diagnostics or inviting retries", () => {
  for (const errorCode of ["PROVIDER_INSUFFICIENT_CREDITS", "credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached", "JOB_FAILED"]) {
    const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType: "generate_image", errorCode,
      errorMessage: "429 You have no credits remaining. Add credits to continue. token=private-secret request-private" } as BackgroundJobRecord;
    const error = getPublicBackgroundJob(job).error;
    assert.match(error?.message ?? "", /image provider's credit balance is too low/);
    assert.equal(error?.retryable, false);
    assert.equal(isRetryableBackgroundJob(job), false);
    assert.doesNotMatch(JSON.stringify(error), /private-secret|request-private|video provider|You can retry|cause could not be identified/);
  }
});

const imagePrivacyRejection = `HTTP 400: ${JSON.stringify({
  error: {
    code: "InputImageSensitiveContentDetected.PrivacyInformation",
    message: "The request failed because the input image 'content[1]' may contain real person. Request id: request-private token=private-secret https://private.example/reference.jpg",
    param: "content[1]",
    type: "BadRequest",
  },
})}`;

test("explains historical image privacy rejections and prevents replaying them", () => {
  for (const jobType of ["generate_hook_video", "video_generation"] as const) {
    for (const errorCode of ["JOB_FAILED", "provider_operation_failed", "PROVIDER_CONTENT_MODERATION", null]) {
      const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType, errorCode, errorMessage: imagePrivacyRejection } as BackgroundJobRecord;
      const error = getPublicBackgroundJob(job).error;
      assert.equal(error?.code, "PROVIDER_REFERENCE_IMAGE_REJECTED");
      assert.match(error?.message ?? "", /reference image.*may contain a real person's face/);
      assert.match(error?.message ?? "", /No video was generated/);
      assert.match(error?.message ?? "", /approved portrait references/);
      assert.equal(error?.retryable, false);
      assert.equal(isRetryableBackgroundJob(job), false);
      assert.doesNotMatch(JSON.stringify(error), /private-secret|request-private|private\.example|content\[1\]|You can retry|cause could not be identified/);
    }
  }
});

test("recognized image privacy codes remain safe without raw provider diagnostics", () => {
  const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType: "generate_hook_video", errorCode: "PROVIDER_REFERENCE_IMAGE_REJECTED", errorMessage: "private-secret" } as BackgroundJobRecord;
  assert.equal(getPublicBackgroundJob(job).error?.retryable, false);
  assert.match(getPublicBackgroundJob(job).error?.message ?? "", /reference image/);
  assert.doesNotMatch(JSON.stringify(getPublicBackgroundJob(job)), /private-secret/);
});

test("the new privacy detection preserves an existing moderation classification", () => {
  const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType: "generate_hook_video", errorCode: "PROVIDER_CONTENT_MODERATION", errorMessage: "Runway task failed: private provider details" } as BackgroundJobRecord;
  assert.equal(getPublicBackgroundJob(job).error?.code, "PROVIDER_CONTENT_MODERATION");
  assert.equal(isRetryableBackgroundJob(job), false);
});

test("does not infer portrait rejection from arbitrary text, malformed JSON or other error codes", () => {
  for (const errorMessage of [
    "InputImageSensitiveContentDetected.PrivacyInformation private-secret",
    'HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation"}',
    'HTTP 400: {"error":{"code":"OtherError","message":"InputImageSensitiveContentDetected.PrivacyInformation"}}',
    'HTTP 400: {"error":"InputImageSensitiveContentDetected.PrivacyInformation"}',
    imagePrivacyRejection.replace("HTTP 400:", "HTTP 500:"),
    `${imagePrivacyRejection}${" ".repeat(65_536)}`,
  ]) {
    const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType: "generate_hook_video", errorCode: "JOB_FAILED", errorMessage } as BackgroundJobRecord;
    assert.equal(getPublicBackgroundJob(job).error?.code, "JOB_FAILED");
    assert.equal(isRetryableBackgroundJob(job), true);
    assert.doesNotMatch(JSON.stringify(getPublicBackgroundJob(job).error), /private-secret|reference image|real person's face/);
  }
});

test("video image rejection detection does not change unrelated jobs or Wall privacy", () => {
  for (const jobType of ["wall_text_generation", "wall_text_content_plan_generation", "generate_image", "generate_carousel"] as const) {
    const job = { attemptCount: 1, maxAttempts: 3, status: "failed", jobType, errorCode: "JOB_FAILED", errorMessage: imagePrivacyRejection } as BackgroundJobRecord;
    assert.equal(getPublicBackgroundJob(job).error?.code, jobType.startsWith("wall_text") ? "CONTENT_PREPARATION_UNAVAILABLE" : "JOB_FAILED");
    assert.doesNotMatch(JSON.stringify(getPublicBackgroundJob(job).error), /private-secret|request-private|reference image|real person's face/);
  }
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

test("completed-output failures explain recovery of the existing video and keep diagnostics private", () => {
  for (const attemptCount of [1, 3]) {
    const job = { attemptCount, maxAttempts: 3, errorCode: "PROVIDER_OUTPUT_COLLECTION_FAILED",
      errorMessage: "private-secret https://file.deepytb.com/private-signed-url", jobType: "generate_hook_video", status: "failed" } as BackgroundJobRecord;
    const error = getPublicBackgroundJob(job).error;
    assert.equal(error?.code, "PROVIDER_OUTPUT_COLLECTION_FAILED");
    assert.equal(error?.retryable, attemptCount < 3);
    assert.match(error?.message ?? "", /provider finished your video/i);
    assert.match(error?.message ?? "", /existing video/);
    assert.doesNotMatch(JSON.stringify(error), /private-secret|deepytb|private-signed-url|cause could not be identified|Start a new/);
  }
});

test("historical pending failures explain saved-request recovery after attempts are exhausted", () => {
  const job = { attemptCount: 3, maxAttempts: 3, errorCode: "provider_operation_pending",
    errorMessage: "The saved provider generation is still being recovered.", jobType: "generate_hook_video", status: "failed" } as BackgroundJobRecord;
  const error = getPublicBackgroundJob(job).error;
  assert.equal(error?.retryable, false);
  assert.match(error?.message ?? "", /Contact support to check the existing request/);
  assert.doesNotMatch(error?.message ?? "", /cause could not be identified|Start a new|provider finished/);
});

test("completed ReAPI collection has one explicit recovery after exhaustion without opening other failures", () => {
  const previous = process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY;
  process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY = "true";
  try {
  const input = { provider: "reapi", model: "seedance_2_5" };
  const job = { attemptCount: 3, maxAttempts: 3, errorCode: "PROVIDER_OUTPUT_COLLECTION_FAILED",
    jobType: "generate_hook_video", status: "failed", input } as unknown as BackgroundJobRecord;
  assert.equal(isRetryableBackgroundJob(job), true);
  assert.equal(isRetryableBackgroundJob({ ...job, attemptCount: 19, maxAttempts: 20 }), true);
  assert.equal(isRetryableBackgroundJob({ ...job, attemptCount: 20, maxAttempts: 20 }), false);
  assert.match(getPublicBackgroundJob(job).error?.message ?? "", /Retry to recover the existing video/);
  assert.equal(isRetryableBackgroundJob({ ...job, input: { ...input, providerOutputRecovery: "collection-only-v1" } }), false);
  for (const errorCode of ["PROVIDER_TIMEOUT", "provider_submission_uncertain", "PROVIDER_CONTENT_MODERATION"])
    assert.equal(isRetryableBackgroundJob({ ...job, errorCode }), false);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY;
    else process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY = previous;
  }
});

test("exhausted provider recovery stays disabled until its schema rollout is approved", () => {
  const previous = process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY;
  delete process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY;
  try {
    const job = { jobType: "generate_hook_video", status: "failed", attemptCount: 3, maxAttempts: 3,
      errorCode: "PROVIDER_OUTPUT_COLLECTION_FAILED", input: { provider: "reapi", model: "seedance_2_5" },
    } as unknown as BackgroundJobRecord;
    assert.equal(isRetryableBackgroundJob(job), false);
    assert.equal(isRetryableBackgroundJob({ ...job, attemptCount: 1 }), false);
    assert.doesNotMatch(getPublicBackgroundJob(job).error?.message ?? "", /Retry to recover/);
  } finally {
    if (previous !== undefined) process.env.ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY = previous;
  }
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

test("public jobs expose only compatible Explore format tags", () => {
  for (const [jobType,format,expected] of [["generate_hook_video","hook","hook"],["generate_hook_video","wall_text","wall_text"],["generate_image","slideshow","slideshow"],["generate_image","hook",undefined],["generate_hook_video","slideshow",undefined],["publish_social_post","hook",undefined],["generate_hook_video","private",undefined]]) {
    const result=getPublicBackgroundJob({jobType,input:{exploreFormat:format,privateSecret:"hidden"}} as unknown as BackgroundJobRecord);
    assert.equal(result.exploreFormat,expected);assert.equal(JSON.stringify(result).includes("privateSecret"),false);
  }
});
