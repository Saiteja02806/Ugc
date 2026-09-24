import assert from "node:assert/strict";
import test from "node:test";

import {
  TIKTOK_BETA_APPROVED_EMAILS,
  hasTikTokBetaAccess,
} from "./tiktok-beta-access.ts";

test("TikTok beta access requires an approved verified email", () => {
  assert.equal(
    hasTikTokBetaAccess({
      email: TIKTOK_BETA_APPROVED_EMAILS[0].toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasTikTokBetaAccess({
      email: TIKTOK_BETA_APPROVED_EMAILS[1].toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasTikTokBetaAccess({
      email: TIKTOK_BETA_APPROVED_EMAILS[1],
      emailVerified: false,
    }),
    false,
  );
  assert.equal(
    hasTikTokBetaAccess({
      email: "another-user@veltech.edu.in",
      emailVerified: true,
    }),
    false,
  );
});
