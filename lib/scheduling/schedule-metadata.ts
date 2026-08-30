export type ScheduleMetadataValue = boolean | number | string | string[];

export type ScheduleMetadata = Record<string, ScheduleMetadataValue>;

const MAX_METADATA_KEY_LENGTH = 80;
const MAX_HOOK_TEXT_LINES = 3;
const MAX_HOOK_TEXT_LINE_LENGTH = 78;

/**
 * Keep schedule metadata JSON-safe while retaining the authoritative Hook
 * layout used by the combined-video render preflight.
 */
export function normalizeScheduleMetadata(value: unknown): ScheduleMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const metadata: ScheduleMetadata = {};

  for (const [key, entryValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (key.length > MAX_METADATA_KEY_LENGTH) {
      continue;
    }

    if (
      typeof entryValue === "boolean" ||
      typeof entryValue === "number" ||
      typeof entryValue === "string"
    ) {
      metadata[key] = entryValue;
      continue;
    }

    if (key === "hookTextLines") {
      const lines = normalizeHookTextLines(entryValue);

      if (lines) {
        metadata[key] = lines;
      }
    }
  }

  return metadata;
}

function normalizeHookTextLines(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_HOOK_TEXT_LINES
  ) {
    return null;
  }

  const lines = value.map((line) => {
    if (typeof line !== "string") {
      return null;
    }

    const normalized = line.trim().replace(/\s+/gu, " ");
    return normalized &&
      Array.from(normalized).length <= MAX_HOOK_TEXT_LINE_LENGTH
      ? normalized
      : null;
  });

  return lines.every((line): line is string => line !== null) ? lines : null;
}
