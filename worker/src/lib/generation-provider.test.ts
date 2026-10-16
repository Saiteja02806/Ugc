import assert from "node:assert/strict";
import test from "node:test";

import { RetryableJobError } from "../retryable-job-error.js";
import {
  assertProviderOperationCanContinue,
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderOperationTerminalError,
  ProviderInsufficientCreditsError,
  ProviderSubmissionUncertainError,
} from "./generation-provider.js";
import type { SupabaseJobStore } from "./supabase.js";

test("terminal provider failures carry a structured code for durable job reporting", () => {
  for (const failureCode of ["INPUT_PREPROCESSING.SAFETY.THIRD_PARTY", "INPUT_PREPROCESSING.SAFETY.TEXT", "SAFETY.INPUT.IMAGE", "SAFETY.OUTPUT.TEXT"]) {
    const details = { failureCode, failure: "private provider diagnostics" };
    const error = new ProviderOperationTerminalError("Runway task failed: content moderation", details);
    assert.equal(error.code, "PROVIDER_CONTENT_MODERATION");
    assert.equal(error.details, details);
  }
  for (const details of [undefined, null, { failureCode: "INPUT_PREPROCESSING.INTERNAL" }, { failureCode: "THIRD_PARTY.UNAVAILABLE" }, { failureCode: 123 }]) {
    assert.equal(new ProviderOperationTerminalError("Provider failed", details).code, "provider_operation_failed");
  }
});

test("uses a stable fingerprint for the same provider request", () => {
  assert.equal(
    createGenerationRequestFingerprint({ prompt: "hello", settings: { b: 2, a: 1 } }),
    createGenerationRequestFingerprint({ settings: { a: 1, b: 2 }, prompt: "hello" }),
  );
});

test("only a fresh reservation can submit a provider request", () => {
  assert.equal(
    assertProviderOperationCanContinue({
      operation: { provider_operation_id: null, status: "reserved" },
      shouldSubmit: true,
    }),
    "submit",
  );
  assert.equal(
    assertProviderOperationCanContinue({
      operation: { provider_operation_id: "task-1", status: "submitted" },
      shouldSubmit: false,
    }),
    "resume",
  );
  assert.throws(
    () =>
      assertProviderOperationCanContinue({
        operation: { provider_operation_id: null, status: "reserved" },
        shouldSubmit: false,
      }),
    ProviderSubmissionUncertainError,
  );
});

test("retries a provider rejection only after recording that no task was accepted", async () => {
  let retryAllowed: boolean | null = null;
  const store = {
    async markGenerationProviderFailed(params: { retryAllowed: boolean }) {
      retryAllowed = params.retryAllowed;
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    persistProviderSubmissionFailure({
      error: { message: "rate limited", status: 429 },
      jobId: "job-1",
      operationKey: "primary-runway",
      store,
    }),
    (error) =>
      error instanceof RetryableJobError &&
      error.code === "provider_submission_rejected",
  );
  assert.equal(retryAllowed, true);
});

test("does not resubmit when provider acceptance is uncertain", async () => {
  let uncertainWrites = 0;
  const store = {
    async markGenerationProviderSubmissionUncertain() {
      uncertainWrites += 1;
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    persistProviderSubmissionFailure({
      error: new Error("connection reset after request upload"),
      jobId: "job-1",
      operationKey: "openai-image",
      store,
    }),
    ProviderSubmissionUncertainError,
  );
  assert.equal(uncertainWrites, 1);
});

test("provider billing exhaustion is terminal even when returned as HTTP 429", async () => {
  for (const error of [
    Object.assign(new Error("429 You have no credits remaining. Add credits to continue. request-private"), { status: 429, code: "credit_balance_exhausted" }),
    { status: 429, code: "insufficient_quota", message: "private billing diagnostics" },
    { status: 429, code: "billing_hard_limit_reached", message: "private billing diagnostics" },
    new Error("429 You have no credits remaining. Add credits to continue."),
    new Error("Your credit balance is too low. request-private"),
  ]) {
    const failures: Array<{ errorCode: string; retryAllowed: boolean }> = [];
    let uncertainWrites = 0;
    const store = {
      async markGenerationProviderFailed(input: { errorCode: string; retryAllowed: boolean }) { failures.push(input); },
      async markGenerationProviderSubmissionUncertain() { uncertainWrites += 1; },
    } as unknown as SupabaseJobStore;
    await assert.rejects(persistProviderSubmissionFailure({ error, jobId: "job-billing", operationKey: "openai-image", store }),
      failure => failure instanceof ProviderInsufficientCreditsError && failure.code === "PROVIDER_INSUFFICIENT_CREDITS" &&
        !/request-private|private billing/.test(failure.message));
    assert.equal(failures.length, 1);
    assert.equal(failures[0].errorCode, "PROVIDER_INSUFFICIENT_CREDITS");
    assert.equal(failures[0].retryAllowed, false);
    assert.equal(uncertainWrites, 0);
  }
});

test("ordinary rate-limit rejections still retry without guessing from unrelated billing words", async () => {
  for (const message of ["Rate limit reached", "Request contains the words no credits remaining", "Billing status temporarily unavailable"]) {
    let retryAllowed = false;
    const store = { async markGenerationProviderFailed(input: { retryAllowed: boolean }) { retryAllowed = input.retryAllowed; } } as unknown as SupabaseJobStore;
    await assert.rejects(persistProviderSubmissionFailure({ error: { status: 429, code: "rate_limit_exceeded", message }, jobId: "job-rate", operationKey: "openai-image", store }),
      failure => failure instanceof RetryableJobError && failure.code === "provider_submission_rejected");
    assert.equal(retryAllowed, true);
  }
});

test("records a bare Gemini configuration validation error as not submitted", async () => {
  const failures: Array<{ errorCode: string; retryAllowed: boolean }> = [];
  let uncertainWrites = 0;
  const configurationError = new Error(
    "generateAudio parameter is only supported in Gemini Enterprise Agent Platform mode, not in Gemini Developer API mode.",
  );
  const store = {
    async markGenerationProviderFailed(params: { errorCode: string; retryAllowed: boolean }) {
      failures.push({ errorCode: params.errorCode, retryAllowed: params.retryAllowed });
    },
    async markGenerationProviderSubmissionUncertain() {
      uncertainWrites += 1;
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    persistProviderSubmissionFailure({
      error: configurationError,
      jobId: "job-1",
      operationKey: "primary-veo",
      store,
    }),
    configurationError,
  );
  assert.deepEqual(failures, [{
    errorCode: "provider_configuration_invalid",
    retryAllowed: false,
  }]);
  assert.equal(uncertainWrites, 0);
});
