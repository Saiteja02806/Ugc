import assert from "node:assert/strict";
import test from "node:test";

import {
  YOUTUBE_BETA_APPROVED_EMAILS,
  hasYouTubeBetaAccess,
} from "./youtube-beta-access.ts";

test("YouTube beta access requires an approved verified email", () => {
  assert.equal(
    hasYouTubeBetaAccess({
      email: YOUTUBE_BETA_APPROVED_EMAILS[0].toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasYouTubeBetaAccess({
      email: YOUTUBE_BETA_APPROVED_EMAILS[1].toUpperCase(),
      emailVerified: true,
    }),
    true,
  );
  assert.equal(
    hasYouTubeBetaAccess({
      email: YOUTUBE_BETA_APPROVED_EMAILS[1],
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
