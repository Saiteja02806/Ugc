import assert from "node:assert/strict";
import test from "node:test";

import {
  createCarouselReplenishmentSignature,
  deriveCarouselReplenishmentSecret,
  isValidCarouselReplenishmentSecret,
  verifyCarouselReplenishmentSignature,
} from "./replenishment-signature.ts";

const sourceSecret = "test-only-service-role-source-secret";
const secret = deriveCarouselReplenishmentSecret(sourceSecret);
const body = JSON.stringify({ limit: 5, offset: 0 });
const now = Date.UTC(2026, 6, 17, 12, 0, 0);
const timestamp = now.toString();

test("derives a domain-separated Carousel replenishment secret", () => {
  assert.notEqual(secret, sourceSecret);
  assert.equal(secret, deriveCarouselReplenishmentSecret(sourceSecret));
});

test("requires a high-entropy replenishment secret", () => {
  assert.equal(isValidCarouselReplenishmentSecret("short-secret"), false);
  assert.equal(isValidCarouselReplenishmentSecret("x".repeat(31)), false);
  assert.equal(isValidCarouselReplenishmentSecret("x".repeat(32)), true);
});

test("accepts an authentic fresh replenishment request", () => {
  const signature = createCarouselReplenishmentSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(
    verifyCarouselReplenishmentSignature({
      body,
      now,
      secret,
      signature,
      timestamp,
    }),
    true,
  );
});

test("rejects modified or stale replenishment requests", () => {
  const signature = createCarouselReplenishmentSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(
    verifyCarouselReplenishmentSignature({
      body: `${body} `,
      now,
      secret,
      signature,
      timestamp,
    }),
    false,
  );
  assert.equal(
    verifyCarouselReplenishmentSignature({
      body,
      now: now + 5 * 60 * 1_000 + 1,
      secret,
      signature,
      timestamp,
    }),
    false,
  );
});
