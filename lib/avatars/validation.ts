import type {
  AvatarAssetRatio,
  AvatarAssetStatus,
  AvatarTrimInput,
} from "@/lib/avatars/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_AVATAR_TRIM_SECONDS = 0.5;

const avatarRatios = new Set<AvatarAssetRatio>([
  "9:16",
  "1:1",
  "4:5",
  "16:9",
  "other",
]);
const avatarStatuses = new Set<AvatarAssetStatus>([
  "ready",
  "disabled",
  "processing",
  "failed",
]);

export type AvatarTrimValidationResult =
  | {
      ok: true;
      value: AvatarTrimInput;
    }
  | {
      error: string;
      ok: false;
    };

export function isAvatarAssetId(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function getAvatarAssetId(value: unknown) {
  return isAvatarAssetId(value) && typeof value === "string" ? value.trim() : "";
}

export function isAvatarAssetRatio(value: unknown): value is AvatarAssetRatio {
  return avatarRatios.has(value as AvatarAssetRatio);
}

export function isAvatarAssetStatus(value: unknown): value is AvatarAssetStatus {
  return avatarStatuses.has(value as AvatarAssetStatus);
}

export function normalizeAvatarRatio(value: unknown): AvatarAssetRatio {
  return isAvatarAssetRatio(value) ? value : "9:16";
}

export function validateAvatarTrimInput(params: {
  durationSeconds: number | null;
  isTrimmed: unknown;
  trimEnd: unknown;
  trimStart: unknown;
}): AvatarTrimValidationResult {
  if (params.isTrimmed !== true) {
    return {
      ok: true,
      value: {
        isTrimmed: false,
        trimEnd: null,
        trimStart: null,
      },
    };
  }

  const trimStart = getFiniteNumber(params.trimStart);
  const trimEnd = getFiniteNumber(params.trimEnd);

  if (trimStart === null || trimEnd === null) {
    return {
      error: "Trim start and trim end are required.",
      ok: false,
    };
  }

  if (trimStart < 0) {
    return {
      error: "Trim start must be 0 seconds or later.",
      ok: false,
    };
  }

  if (trimEnd <= trimStart) {
    return {
      error: "Trim end must be after trim start.",
      ok: false,
    };
  }

  if (trimEnd - trimStart < MIN_AVATAR_TRIM_SECONDS) {
    return {
      error: "Avatar trim must be at least 0.5 seconds.",
      ok: false,
    };
  }

  if (
    params.durationSeconds !== null &&
    Number.isFinite(params.durationSeconds) &&
    trimEnd > params.durationSeconds
  ) {
    return {
      error: "Trim end cannot exceed the avatar duration.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      isTrimmed: true,
      trimEnd,
      trimStart,
    },
  };
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
