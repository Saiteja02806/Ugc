import { createHash } from "node:crypto";

import { RetryableJobError } from "../retryable-job-error.js";
import type { SupabaseJobStore } from "./supabase.js";

export class ProviderRequestNotSubmittedError extends Error {
  readonly retryable: boolean;

  constructor(message: string, params?: { cause?: unknown; retryable?: boolean }) {
    super(message, { cause: params?.cause });
    this.name = "ProviderRequestNotSubmittedError";
    this.retryable = params?.retryable ?? false;
  }
}

export class ProviderOperationTerminalError extends Error {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, { cause: details });
    this.details = details;
    this.name = "ProviderOperationTerminalError";
  }
}

export class ProviderOperationPollingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderOperationPollingError";
  }
}

export class ProviderSubmissionUncertainError extends Error {
  readonly code = "provider_submission_uncertain";

  constructor() {
    super(
      "The provider may have accepted this generation, so it was stopped instead of submitting a duplicate paid request.",
    );
    this.name = "ProviderSubmissionUncertainError";
  }
}

export function createGenerationRequestFingerprint(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function assertProviderOperationCanContinue(params: {
  operation: {
    provider_operation_id: string | null;
    status: string;
  };
  shouldSubmit: boolean;
}) {
  if (params.shouldSubmit) {
    return "submit" as const;
  }

  if (
    params.operation.provider_operation_id &&
    ["submitted", "provider_succeeded", "output_persisted"].includes(
      params.operation.status,
    )
  ) {
    return "resume" as const;
  }

  throw new ProviderSubmissionUncertainError();
}

export async function persistProviderSubmissionFailure(params: {
  error: unknown;
  jobId: string;
  operationKey: string;
  store: SupabaseJobStore;
}): Promise<never> {
  const message = getErrorMessage(params.error);
  const rejection = classifySubmissionFailure(params.error);

  if (rejection !== "uncertain") {
    const retryAllowed = rejection === "retryable_rejection";
    await params.store.markGenerationProviderFailed({
      errorCode: getErrorCode(params.error),
      errorMessage: message,
      jobId: params.jobId,
      operationKey: params.operationKey,
      retryAllowed,
    });

    if (retryAllowed) {
      throw new RetryableJobError(
        "The generation provider temporarily rejected the request.",
        {
          code: "provider_submission_rejected",
          retryAfterSeconds: getRetryAfterSeconds(params.error),
        },
      );
    }

    throw params.error instanceof Error
      ? params.error
      : new Error("The generation provider rejected the request.");
  }

  await params.store.markGenerationProviderSubmissionUncertain({
    errorMessage: message,
    jobId: params.jobId,
    operationKey: params.operationKey,
  });
  throw new ProviderSubmissionUncertainError();
}

export function toProviderPollingRetry(error: unknown) {
  if (error instanceof RetryableJobError) {
    return error;
  }

  return new RetryableJobError(
    "The saved provider generation is still being recovered.",
    {
      code: "provider_operation_pending",
      retryAfterSeconds: 30,
    },
  );
}

function classifySubmissionFailure(error: unknown) {
  if (error instanceof ProviderRequestNotSubmittedError) {
    return error.retryable ? "retryable_rejection" : "permanent_rejection";
  }

  const status = getNumericErrorField(error, "status", "statusCode");

  if (status === 429) {
    return "retryable_rejection";
  }

  if (status !== null && status >= 400 && status < 500 && status !== 408) {
    return "permanent_rejection";
  }

  return "uncertain";
}

function getRetryAfterSeconds(error: unknown) {
  const seconds = getNumericErrorField(error, "retryAfterSeconds");

  if (seconds !== null && seconds > 0) {
    return Math.min(seconds, 43_200);
  }

  return 30;
}

function getErrorCode(error: unknown) {
  if (error instanceof ProviderRequestNotSubmittedError) {
    return error.retryable
      ? "request_not_submitted_retryable"
      : "request_not_submitted";
  }

  const code = getStringErrorField(error, "code");
  const status = getNumericErrorField(error, "status", "statusCode");

  return (code || (status ? `http_${status}` : "provider_rejected"))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 120);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getNumericErrorField(error: unknown, ...fields: string[]) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;

  for (const field of fields) {
    const value = record[field];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getStringErrorField(error: unknown, field: string) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];

  return typeof value === "string" ? value : null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(
        ([key, child]) =>
          `${JSON.stringify(key)}:${stableStringify(child)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}
