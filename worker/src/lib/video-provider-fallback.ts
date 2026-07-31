const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "RESOURCE_EXHAUSTED",
  "UNAVAILABLE",
]);

const RETRYABLE_MESSAGE_PATTERNS = [
  /\b429\b/,
  /\b5\d{2}\b/,
  /fetch failed/,
  /network error/,
  /overloaded/,
  /rate limit/,
  /resource[_ ]exhausted/,
  /service unavailable/,
  /socket hang up/,
  /temporar(?:ily|y) unavailable/,
  /timed out/,
  /timeout/,
];

export function shouldFallbackToRunway(error: unknown) {
  const status = getNumericErrorField(error, "status", "statusCode");

  if (status === 429 || (status !== null && status >= 500 && status <= 599)) {
    return true;
  }

  const code = getStringErrorField(error, "code")?.toUpperCase();

  if (code && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();

  return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
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
