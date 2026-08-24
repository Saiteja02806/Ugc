import assert from "node:assert/strict";
import test from "node:test";

import {
  hasProductFeedbackAdminAccess,
  parseProductFeedbackAdminEmails,
} from "./admin-access.ts";

test("feedback administration requires a verified configured owner email", () => {
  assert.equal(
    hasProductFeedbackAdminAccess(
      { email: " Owner@Example.com ", emailVerified: true },
      "owner@example.com, second@example.com",
    ),
    true,
  );
  assert.equal(
    hasProductFeedbackAdminAccess(
      { email: "owner@example.com", emailVerified: false },
      "owner@example.com",
    ),
    false,
  );
  assert.equal(
    hasProductFeedbackAdminAccess(
      { email: "customer@example.com", emailVerified: true },
      "owner@example.com",
    ),
    false,
  );
});

test("feedback owner allowlists normalize and deduplicate emails", () => {
  assert.deepEqual(
    [...parseProductFeedbackAdminEmails(" Owner@example.com,owner@example.com ")],
    ["owner@example.com"],
  );
  assert.deepEqual([...parseProductFeedbackAdminEmails(undefined)], []);
});
