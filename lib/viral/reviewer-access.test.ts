import assert from "node:assert/strict";
import test from "node:test";

import {
  hasViralReviewerAccess,
  parseViralReviewerEmails,
} from "./reviewer-access.ts";

test("grants Explore access only to a verified configured reviewer", () => {
  assert.equal(
    hasViralReviewerAccess(
      { email: " Creator@Example.com ", emailVerified: true },
      "creator@example.com, second@example.com",
    ),
    true,
  );
  assert.equal(
    hasViralReviewerAccess(
      { email: "viewer@example.com", emailVerified: true },
      "creator@example.com",
    ),
    false,
  );
});

test("fails closed when reviewer configuration or verified email is missing", () => {
  assert.equal(
    hasViralReviewerAccess(
      { email: "creator@example.com", emailVerified: true },
      undefined,
    ),
    false,
  );
  assert.equal(
    hasViralReviewerAccess(
      { email: "creator@example.com", emailVerified: false },
      "creator@example.com",
    ),
    false,
  );
  assert.equal(
    hasViralReviewerAccess(
      { email: null, emailVerified: true },
      "creator@example.com",
    ),
    false,
  );
});

test("normalizes, trims, and deduplicates reviewer emails", () => {
  assert.deepEqual(
    [...parseViralReviewerEmails(" A@example.com, a@example.com, B@example.com ")],
    ["a@example.com", "b@example.com"],
  );
});
