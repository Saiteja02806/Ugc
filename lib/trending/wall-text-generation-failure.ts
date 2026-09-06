export const WALL_TEXT_PERSISTENCE_REJECTED =
  "wall_text_persistence_rejected";
export const WALL_TEXT_RENDER_FIT_REJECTED =
  "wall_text_render_fit_rejected";
export const WALL_TEXT_RUNTIME_CONFIGURATION_ERROR =
  "wall_text_runtime_configuration_error";
export const WALL_TEXT_DEPENDENCY_UNAVAILABLE =
  "wall_text_dependency_unavailable";

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
    normalized === WALL_TEXT_DEPENDENCY_UNAVAILABLE
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
): WallTextGenerationFailure {
  if (getErrorCode(error) === WALL_TEXT_RENDER_FIT_REJECTED) {
    return {
      errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
      publicMessage:
        "Wall-of-text could not be arranged safely inside the video.",
      retryable: false,
    };
  }

  if (isWallTextPersistenceRejection(error)) {
    return {
      errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
      publicMessage:
        "Wall-of-text could not be saved because a required update is missing.",
      retryable: false,
    };
  }

  if (isWallTextRuntimeConfigurationError(error)) {
    return {
      errorCode: WALL_TEXT_RUNTIME_CONFIGURATION_ERROR,
      publicMessage:
        "Wall-of-text is unavailable because a required runtime dependency is not configured.",
      retryable: false,
    };
  }

  if (isWallTextDependencyUnavailable(error)) {
    return {
      errorCode: WALL_TEXT_DEPENDENCY_UNAVAILABLE,
      publicMessage:
        "Wall-of-text cannot be prepared because a required audio dependency is unavailable.",
      retryable: false,
    };
  }

  return {
    errorCode: "infrastructure_error",
    publicMessage: "Wall-of-text preparation could not finish yet.",
    retryable: true,
  };
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
  if (!error || typeof error !== "object") {
    return "";
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.trim().toLowerCase() : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
