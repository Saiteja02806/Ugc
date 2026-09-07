export const CREATE_CONTENT_DEFAULT_OPTION_COUNT = 4;
export const CREATE_CONTENT_MAX_OPTION_COUNT = 40;

export function resolveCreateContentOptionCount(params: {
  requestedCount?: number;
  request: string;
}) {
  if (params.requestedCount !== undefined) {
    return clampOptionCount(params.requestedCount);
  }

  // A number only counts when it is clearly attached to the content the user
  // requested. A reference such as "for my 6-second video" must not become
  // six generated options.
  const explicit = params.request.match(
    /\b(\d{1,3})\s*(?:hooks?|wall(?:[\s-]*of[\s-]*text)?(?:\s+(?:options?|posts?))?|options?|ideas?)\b/iu,
  );

  return explicit
    ? clampOptionCount(Number(explicit[1]))
    : CREATE_CONTENT_DEFAULT_OPTION_COUNT;
}

export function getCreateContentWallReadingGuide(durationSeconds: number) {
  const duration = Math.max(
    0,
    Number.isFinite(durationSeconds) ? durationSeconds : 0,
  );
  const targetWords = Math.min(54, Math.max(14, Math.round(duration * 2.5)));

  return {
    targetWords,
    wording:
      "Treat this as gentle reading guidance, not a restriction. Never refuse a Wall-of-Text idea because the video is short; the creator controls placement and can edit it.",
  };
}

function clampOptionCount(value: number) {
  return Math.min(
    CREATE_CONTENT_MAX_OPTION_COUNT,
    Math.max(1, Math.trunc(value)),
  );
}
