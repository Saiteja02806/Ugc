import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES,
  isCarouselReplenishmentBodyWithinLimit,
  validateCarouselReplenishmentContentLength,
} from "./replenishment-request.ts";

test("requires a small declared replenishment body", () => {
  assert.equal(validateCarouselReplenishmentContentLength(null).ok, false);
  assert.equal(validateCarouselReplenishmentContentLength("invalid").ok, false);
  assert.equal(validateCarouselReplenishmentContentLength("0").ok, false);
  assert.equal(validateCarouselReplenishmentContentLength("100").ok, true);
  assert.equal(
    validateCarouselReplenishmentContentLength(
      String(CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES + 1),
    ).ok,
    false,
  );
});

test("checks the actual UTF-8 replenishment body size", () => {
  assert.equal(isCarouselReplenishmentBodyWithinLimit("{}"), true);
  assert.equal(
    isCarouselReplenishmentBodyWithinLimit(
      "x".repeat(CAROUSEL_REPLENISHMENT_MAX_BODY_BYTES + 1),
    ),
    false,
  );
});
