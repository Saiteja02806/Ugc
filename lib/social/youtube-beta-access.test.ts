import assert from "node:assert/strict";
import test from "node:test";

import {
  YOUTUBE_BETA_DEFAULT_EMAIL,
  hasYouTubeBetaAccess,
} from "./youtube-beta-access.ts";

test("YouTube beta access requires the approved verified email", () => {
  assert.equal(
    hasYouTubeBetaAccess({
      email: YOUTUBE_BETA_DEFAULT_EMAIL.toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasYouTubeBetaAccess({
      email: YOUTUBE_BETA_DEFAULT_EMAIL,
      emailVerified: false,
    }),
    false,
  );
  assert.equal(
    hasYouTubeBetaAccess({
      email: "another-user@veltech.edu.in",
      emailVerified: true,
    }),
    false,
  );
});
