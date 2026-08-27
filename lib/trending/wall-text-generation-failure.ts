export const WALL_TEXT_PERSISTENCE_REJECTED =
  "wall_text_persistence_rejected";

export type WallTextGenerationFailure = {
  errorCode: string;
  publicMessage: string;
  retryable: boolean;
};

/**
 * The Wall writer can retry provider, network, and timeout errors. It must not
 * retry a database contract rejection: the same payload will be rejected again
 * until code or the database schema is changed.
 */
export function classifyWallTextGenerationFailure(
  error: unknown,
): WallTextGenerationFailure {
  if (isWallTextPersistenceRejection(error)) {
    return {
      errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
      publicMessage:
        "Wall-of-text could not be saved because a required update is missing.",
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
    code === "23502" ||
    code === "42703" ||
    code === "42p01" ||
    message.includes("violates check constraint") ||
    message.includes("wall_text_creatives_text_content_chk") ||
    message.includes("wall_text_content_plan_briefs_preferred_format_family_check") ||
    message.includes("column") && message.includes("does not exist")
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
