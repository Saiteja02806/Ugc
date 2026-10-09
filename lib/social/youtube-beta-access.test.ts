import assert from "node:assert/strict";
import test from "node:test";

import { hasYouTubeBetaAccess } from "./youtube-beta-access.ts";

test("YouTube is available to every verified user without an email allowlist", () => {
  for (const email of ["new-user@example.com", "another-user@veltech.edu.in", null]) {
    assert.equal(hasYouTubeBetaAccess({ email, emailVerified: true }), true);
  }
});

test("YouTube retains the signed-in verified-user requirement", () => {
  assert.equal(hasYouTubeBetaAccess(null), false);
  assert.equal(hasYouTubeBetaAccess(undefined), false);
  for (const emailVerified of [false, null, undefined]) {
    assert.equal(hasYouTubeBetaAccess({ email: "new-user@example.com", emailVerified }), false);
  }
});
