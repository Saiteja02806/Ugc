export const CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES = 2_048;

export function validateCarouselReplenishmentContentLength(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return { ok: false as const, status: 411 };
  }

  const contentLength = Number(value);

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES
  ) {
    return { ok: false as const, status: 413 };
  }

  return { contentLength, ok: true as const };
}

export function isCarouselReplenishmentBodyWithinLimit(body: string) {
  return (
    Buffer.byteLength(body, "utf8") <=
    CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES
  );
}
