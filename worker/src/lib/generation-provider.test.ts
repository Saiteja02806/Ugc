import assert from "node:assert/strict";
import test from "node:test";

import { RetryableJobError } from "../retryable-job-error.js";
import {
  assertProviderOperationCanContinue,
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderSubmissionUncertainError,
} from "./generation-provider.js";
import type { SupabaseJobStore } from "./supabase.js";

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
