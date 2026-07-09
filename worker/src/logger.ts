type LogLevel = "debug" | "error" | "info" | "warn";

type LogMetadata = Record<string, unknown>;

export const logger = {
  debug(message: string, metadata?: LogMetadata) {
    writeLog("debug", message, metadata);
  },
  error(message: string, metadata?: LogMetadata) {
    writeLog("error", message, metadata);
  },
  info(message: string, metadata?: LogMetadata) {
    writeLog("info", message, metadata);
  },
  warn(message: string, metadata?: LogMetadata) {
    writeLog("warn", message, metadata);
  },
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function writeLog(level: LogLevel, message: string, metadata?: LogMetadata) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
  };
  const serializedPayload = JSON.stringify(payload);

  if (level === "error") {
    console.error(serializedPayload);
    return;
  }

  if (level === "warn") {
    console.warn(serializedPayload);
    return;
  }

  console.log(serializedPayload);
}

function sanitizeMetadata(metadata: LogMetadata) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      value instanceof Error ? getErrorMessage(value) : value,
    ]),
  );
}
