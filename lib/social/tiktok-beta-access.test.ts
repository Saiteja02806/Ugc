import assert from "node:assert/strict";
import test from "node:test";

import { hasTikTokBetaAccess } from "./tiktok-beta-access.ts";

test("TikTok is available to every verified user without an email allowlist", () => {
  for (const email of ["new-user@example.com", "another-user@veltech.edu.in", null]) {
    assert.equal(hasTikTokBetaAccess({ email, emailVerified: true }), true);
  }
});

test("TikTok retains the signed-in verified-user requirement", () => {
  assert.equal(hasTikTokBetaAccess(null), false);
  assert.equal(hasTikTokBetaAccess(undefined), false);
  for (const emailVerified of [false, null, undefined]) {
    assert.equal(hasTikTokBetaAccess({ email: "new-user@example.com", emailVerified }), false);
  }
});
