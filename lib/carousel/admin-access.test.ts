import assert from "node:assert/strict";
import test from "node:test";

import {
  hasCarouselAdminAccess,
  parseCarouselAdminEmails,
} from "./admin-access.ts";

test("grants Carousel administration only to a verified configured owner", () => {
  assert.equal(
    hasCarouselAdminAccess(
      { email: " Owner@Example.com ", emailVerified: true },
      "owner@example.com, second@example.com",
    ),
    true,
  );
  assert.equal(
    hasCarouselAdminAccess(
      { email: "viewer@example.com", emailVerified: true },
      "owner@example.com",
    ),
    false,
  );
});
test("fails closed without a configured, verified owner identity", () => {
  assert.equal(
    hasCarouselAdminAccess(
      { email: "owner@example.com", emailVerified: true },
      undefined,
    ),
    false,
  );
  assert.equal(
    hasCarouselAdminAccess(
      { email: "owner@example.com", emailVerified: false },
      "owner@example.com",
    ),
    false,
  );
  assert.equal(
    hasCarouselAdminAccess(
      { email: null, emailVerified: true },
      "owner@example.com",
    ),
    false,
  );
});

test("normalizes and deduplicates the owner allowlist", () => {
  assert.deepEqual(
    [
      ...parseCarouselAdminEmails(
        " A@example.com, a@example.com, B@example.com ",
      ),
    ],
    ["a@example.com", "b@example.com"],
  );
});
