export const CREATE_CONTENT_DEFAULT_OPTION_COUNT = 4;
export const CREATE_CONTENT_MAX_OPTION_COUNT = 40;
export const CREATE_CONTENT_WALL_TEXT_LINE_RANGE = { max: 8, min: 5 } as const;
export const CREATE_CONTENT_WALL_TEXT_WORD_RANGE = { max: 40, min: 25 } as const;

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

function clampOptionCount(value: number) {
  return Math.min(
    CREATE_CONTENT_MAX_OPTION_COUNT,
    Math.max(1, Math.trunc(value)),
  );
}
