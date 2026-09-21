import assert from "node:assert/strict";
import test from "node:test";

import {
  TIKTOK_BETA_DEFAULT_EMAIL,
  hasTikTokBetaAccess,
} from "./tiktok-beta-access.ts";

test("TikTok beta access requires the approved verified email", () => {
  assert.equal(
    hasTikTokBetaAccess({
      email: TIKTOK_BETA_DEFAULT_EMAIL.toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasTikTokBetaAccess({
      email: TIKTOK_BETA_DEFAULT_EMAIL,
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
