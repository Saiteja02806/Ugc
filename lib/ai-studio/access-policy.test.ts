import assert from "node:assert/strict";
import test from "node:test";

import {
  getAIStudioAccessMessage,
  hasAIStudioProAccess,
  normalizeAIStudioEmail,
  parseAIStudioAllowedEmails,
} from "./access-policy.ts";

test("distinguishes access-check failures from a locked account", () => {
  assert.match(getAIStudioAccessMessage("error") ?? "", /could not be verified/i);
  assert.match(getAIStudioAccessMessage("locked") ?? "", /approved Pro/i);
  assert.equal(getAIStudioAccessMessage("pro"), null);
});

test("normalizes AI Studio emails before comparison", () => {
  assert.equal(
    normalizeAIStudioEmail("  UGCPilot2026@GMAIL.COM "),
    "ugcpilot2026@gmail.com",
  );
});

test("parses a comma-separated Pro allowlist", () => {
  assert.deepEqual(
    [...parseAIStudioAllowedEmails(" first@example.com,SECOND@example.com ")],
    ["first@example.com", "second@example.com"],
  );
});

test("allows the configured verified Pro email", () => {
  assert.equal(
    hasAIStudioProAccess(
      {
        email: "UGCPilot2026@gmail.com",
        emailVerified: true,
      },
      "ugcpilot2026@gmail.com",
    ),
    true,
  );
});

test("denies every other email", () => {
  assert.equal(
    hasAIStudioProAccess(
      {
        email: "other@example.com",
        emailVerified: true,
      },
      "ugcpilot2026@gmail.com",
    ),
    false,
  );
});

test("denies unverified, missing-email, and missing-configuration identities", () => {
  assert.equal(
    hasAIStudioProAccess(
      {
        email: "ugcpilot2026@gmail.com",
        emailVerified: false,
      },
      "ugcpilot2026@gmail.com",
    ),
    false,
  );
  assert.equal(
    hasAIStudioProAccess(
      {
        email: null,
        emailVerified: true,
      },
      "ugcpilot2026@gmail.com",
    ),
    false,
  );
  assert.equal(
    hasAIStudioProAccess(
      {
        email: "ugcpilot2026@gmail.com",
        emailVerified: true,
      },
      undefined,
    ),
    false,
  );
});
