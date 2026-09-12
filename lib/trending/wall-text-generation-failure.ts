export const WALL_TEXT_PERSISTENCE_REJECTED =
  "wall_text_persistence_rejected";
export const WALL_TEXT_RENDER_FIT_REJECTED =
  "wall_text_render_fit_rejected";
export const WALL_TEXT_RUNTIME_CONFIGURATION_ERROR =
  "wall_text_runtime_configuration_error";
export const WALL_TEXT_DEPENDENCY_UNAVAILABLE =
  "wall_text_dependency_unavailable";
export const WALL_TEXT_CONTENT_RETRY_EXHAUSTED = "content_retry_exhausted";
export const WALL_TEXT_DAILY_DELIVERY_SHORTFALL =
  "wall_text_daily_delivery_shortfall";
export const WALL_TEXT_MODEL_OUTPUT_EMPTY = "model_output_empty";
export const WALL_TEXT_MODEL_OUTPUT_REFUSAL = "model_output_refusal";
export const WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID =
  "model_output_schema_invalid";
export const WALL_TEXT_PROVIDER_INVALID_REQUEST =
  "wall_text_provider_invalid_request";
export const WALL_TEXT_PROVIDER_AUTHENTICATION_FAILED =
  "wall_text_provider_authentication_failed";
export const WALL_TEXT_PROVIDER_BILLING_LIMIT =
  "wall_text_provider_billing_limit";
export const WALL_TEXT_PROVIDER_RATE_LIMITED =
  "wall_text_provider_rate_limited";
export const WALL_TEXT_PROVIDER_TRANSIENT = "wall_text_provider_transient";

export type WallTextFailureStage =
  | "planner"
  | "writer"
  | "reviewer"
  | "parser"
  | "persistence"
  | "reservation"
  | "render"
  | "unknown";

export type WallTextCandidateRejection = {
  candidateIndex: number;
  detail?: string;
  reason: string;
};

export type WallTextFailureDiagnosticDetails = {
  candidateRejections: WallTextCandidateRejection[];
  errorName: string;
  finishReason: string | null;
  providerErrorCode: string | null;
  providerErrorType: string | null;
  providerRequestId: string | null;
  providerStatus: number | null;
  stage: WallTextFailureStage;
};

/**
 * A stage wrapper keeps the original provider error as its cause. It is only
 * used on the server so the classifier can retain an actionable diagnostic
 * without ever returning provider details to a browser.
 */
export class WallTextStagedError extends Error {
  readonly cause: unknown;
  readonly stage: WallTextFailureStage;

  constructor(stage: WallTextFailureStage, cause: unknown) {
    super(
      cause instanceof Error ? cause.message : "Wall-of-text generation failed.",
    );
    this.name = "WallTextStagedError";
    this.cause = cause;
    this.stage = stage;
  }
}

export class WallTextModelOutputError extends Error {
  readonly code:
    | typeof WALL_TEXT_MODEL_OUTPUT_EMPTY
    | typeof WALL_TEXT_MODEL_OUTPUT_REFUSAL
    | typeof WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID;
  readonly finishReason: string | null;
  readonly stage: "parser";

  constructor(params: {
    code:
      | typeof WALL_TEXT_MODEL_OUTPUT_EMPTY
      | typeof WALL_TEXT_MODEL_OUTPUT_REFUSAL
      | typeof WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID;
    finishReason?: string | null;
    message: string;
  }) {
    super(params.message);
    this.name = "WallTextModelOutputError";
    this.code = params.code;
    this.finishReason = params.finishReason ?? null;
    this.stage = "parser";
  }
}

/**
 * Raised when the deterministic V9 layout pass cannot fit already-persisted
 * copy at the fixed readable size. This is not an infrastructure failure:
 * retrying the same words and box would produce the same result.
 */
export class WallTextLayoutFitError extends Error {
  readonly code = WALL_TEXT_RENDER_FIT_REJECTED;

  constructor(message: string) {
    super(message);
    this.name = "WallTextLayoutFitError";
  }
}

export type WallTextGenerationFailure = {
  diagnostic: WallTextFailureDiagnosticDetails;
  errorCode: string;
  publicMessage: string;
  retryable: boolean;
};

export function isWallTextGenerationFailureTerminalCode(
  errorCode: string | null | undefined,
) {
  const normalized = errorCode?.trim().toLowerCase();

  return (
    normalized === WALL_TEXT_PERSISTENCE_REJECTED ||
    normalized === WALL_TEXT_RENDER_FIT_REJECTED ||
    normalized === WALL_TEXT_RUNTIME_CONFIGURATION_ERROR ||
    normalized === WALL_TEXT_DEPENDENCY_UNAVAILABLE ||
    normalized === WALL_TEXT_CONTENT_RETRY_EXHAUSTED ||
    normalized === WALL_TEXT_MODEL_OUTPUT_REFUSAL ||
    normalized === WALL_TEXT_PROVIDER_INVALID_REQUEST ||
    normalized === WALL_TEXT_PROVIDER_AUTHENTICATION_FAILED ||
    normalized === WALL_TEXT_PROVIDER_BILLING_LIMIT
  );
}

export function isWallTextRenderFitFailure(error: unknown) {
  return getErrorCode(error) === WALL_TEXT_RENDER_FIT_REJECTED;
}

/**
 * The Wall writer can retry provider, network, and timeout errors. It must not
 * retry a database contract rejection: the same payload will be rejected again
 * until code or the database schema is changed.
 */
export function classifyWallTextGenerationFailure(
  error: unknown,
  fallbackStage: WallTextFailureStage = "unknown",
): WallTextGenerationFailure {
  const diagnostic = getWallTextFailureDiagnosticDetails(error, fallbackStage);
  const code = getErrorCode(error);

  if (getErrorCode(error) === WALL_TEXT_RENDER_FIT_REJECTED) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
      publicMessage:
        "Wall-of-text could not be arranged safely inside the video.",
      retryable: false,
    };
  }

  if (code === WALL_TEXT_CONTENT_RETRY_EXHAUSTED) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_CONTENT_RETRY_EXHAUSTED,
      publicMessage:
        "Wall-of-text needs a different content idea before it can be prepared.",
      retryable: false,
    };
  }

  if (isWallTextPersistenceRejection(error)) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
      publicMessage:
        "Wall-of-text could not be saved because a required update is missing.",
      retryable: false,
    };
  }

  if (isWallTextRuntimeConfigurationError(error)) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_RUNTIME_CONFIGURATION_ERROR,
      publicMessage:
        "Wall-of-text is unavailable because a required runtime dependency is not configured.",
      retryable: false,
    };
  }

  if (isWallTextDependencyUnavailable(error)) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_DEPENDENCY_UNAVAILABLE,
      publicMessage:
        "Wall-of-text cannot be prepared because a required audio dependency is unavailable.",
      retryable: false,
    };
  }

  if (code === WALL_TEXT_DAILY_DELIVERY_SHORTFALL) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_DAILY_DELIVERY_SHORTFALL,
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    };
  }

  if (code === WALL_TEXT_MODEL_OUTPUT_REFUSAL) {
    return {
      diagnostic,
      errorCode: WALL_TEXT_MODEL_OUTPUT_REFUSAL,
      publicMessage: "Wall-of-text needs a different content idea before it can be prepared.",
      retryable: false,
    };
  }

  if (
    code === WALL_TEXT_MODEL_OUTPUT_EMPTY ||
    code === WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID
  ) {
    return {
      diagnostic,
      errorCode: code,
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    };
  }

  const providerFailure = classifyProviderFailure(diagnostic);
  if (providerFailure) {
    return {
      diagnostic,
      ...providerFailure,
    };
  }

  return {
    diagnostic,
    errorCode: "infrastructure_error",
    publicMessage: "Wall-of-text preparation could not finish yet.",
    retryable: true,
  };
}

export function getWallTextFailureDiagnosticDetails(
  error: unknown,
  fallbackStage: WallTextFailureStage = "unknown",
): WallTextFailureDiagnosticDetails {
  const staged = unwrapWallTextError(error);
  const source = staged.error;
  const record = asRecord(source);
  const outputError = source instanceof WallTextModelOutputError ? source : null;
  const candidateRejections = getCandidateRejections(source);

  return {
    candidateRejections,
    errorName: source instanceof Error ? source.name : typeof source,
    finishReason: outputError?.finishReason ?? getString(record?.finish_reason) ?? null,
    providerErrorCode:
      getString(record?.code) ?? getString(record?.error_code) ?? null,
    providerErrorType:
      getString(record?.type) ?? getString(record?.error_type) ?? null,
    providerRequestId:
      getString(record?.request_id) ?? getString(record?._request_id) ?? null,
    providerStatus: getNumber(record?.status) ?? getNumber(record?.statusCode),
    stage: outputError?.stage ?? staged.stage ?? fallbackStage,
  };
}

export function getWallTextFailurePrivateMessage(error: unknown) {
  const source = unwrapWallTextError(error).error;
  return source instanceof Error ? source.message : String(source);
}

export function markWallTextFailureDiagnosticRecorded(error: unknown) {
  if (!error || typeof error !== "object") return;
  try {
    Object.defineProperty(error, "wallTextDiagnosticRecorded", {
      configurable: true,
      value: true,
    });
  } catch {
    // Diagnostics must never interfere with the original failure path.
  }
}

export function wasWallTextFailureDiagnosticRecorded(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { wallTextDiagnosticRecorded?: unknown })
        .wallTextDiagnosticRecorded === true,
  );
}

function classifyProviderFailure(
  diagnostic: WallTextFailureDiagnosticDetails,
): Omit<WallTextGenerationFailure, "diagnostic"> | null {
  const status = diagnostic.providerStatus;
  const code = diagnostic.providerErrorCode?.toLowerCase() ?? "";
  const name = diagnostic.errorName;

  if (status === 400) {
    return {
      errorCode: WALL_TEXT_PROVIDER_INVALID_REQUEST,
      publicMessage: "Wall-of-text preparation is temporarily unavailable.",
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      errorCode: WALL_TEXT_PROVIDER_AUTHENTICATION_FAILED,
      publicMessage: "Wall-of-text preparation is temporarily unavailable.",
      retryable: false,
    };
  }
  if (
    status === 429 &&
    [
      "credit_balance_exhausted",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded",
    ].includes(code)
  ) {
    return {
      errorCode: WALL_TEXT_PROVIDER_BILLING_LIMIT,
      publicMessage: "Wall-of-text preparation is temporarily unavailable.",
      retryable: false,
    };
  }
  if (status === 429 || name === "RateLimitError") {
    return {
      errorCode: WALL_TEXT_PROVIDER_RATE_LIMITED,
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    };
  }
  if (
    status === 408 ||
    (status !== null && status >= 500) ||
    [
      "APIConnectionError",
      "APIConnectionTimeoutError",
      "APITimeoutError",
      "InternalServerError",
      "AbortError",
    ].includes(name)
  ) {
    return {
      errorCode: WALL_TEXT_PROVIDER_TRANSIENT,
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    };
  }
  return null;
}

function isWallTextPersistenceRejection(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === "23514" ||
    code === "23505" ||
    code === "23502" ||
    code === "42703" ||
    code === "42p01" ||
    message.includes("wall_text_regeneration_invalid_") ||
    message.includes("wall_text_regeneration_duplicate_updates") ||
    message.includes("wall_text_regeneration_mismatch") ||
    message.includes("violates check constraint") ||
    message.includes("violates unique constraint") ||
    message.includes("wall_text_creatives_text_content_chk") ||
    message.includes("wall_text_content_plan_briefs_preferred_format_family_check") ||
    message.includes("column") && message.includes("does not exist")
  );
}

function isWallTextRuntimeConfigurationError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("packaged avenir next demi bold font is unavailable") ||
    message.includes("wall audio database environment is unavailable")
  );
}

function isWallTextDependencyUnavailable(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("no approved wall audio can cover this video's duration") ||
    message.includes("instagram reel template audio cannot cover this video's duration") ||
    message.includes("instagram reel template audio is unavailable")
  );
}

function getErrorCode(error: unknown) {
  const source = unwrapWallTextError(error).error;
  if (!source || typeof source !== "object") return "";
  const code = (source as { code?: unknown }).code;
  return typeof code === "string" ? code.trim().toLowerCase() : "";
}

function getErrorMessage(error: unknown) {
  return getWallTextFailurePrivateMessage(error);
}

function unwrapWallTextError(error: unknown): {
  error: unknown;
  stage: WallTextFailureStage | null;
} {
  if (error instanceof WallTextStagedError) {
    return { error: error.cause, stage: error.stage };
  }
  return { error, stage: null };
}

function getCandidateRejections(error: unknown): WallTextCandidateRejection[] {
  const record = asRecord(error);
  const values = Array.isArray(record?.candidateRejections)
    ? record.candidateRejections
    : [];
  return values.flatMap((value) => {
    const item = asRecord(value);
    const candidateIndex = getNumber(item?.candidateIndex);
    const reason = getString(item?.reason);
    if (candidateIndex === null || !Number.isInteger(candidateIndex) || !reason) {
      return [];
    }
    const detail = getString(item?.detail);
    return [{
      candidateIndex,
      ...(detail ? { detail: detail.slice(0, 300) } : {}),
      reason: reason.slice(0, 120),
    }];
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
