import assert from "node:assert/strict";
import test from "node:test";

import { getAppReleaseIdentity, normalizeGitCommit } from "./release-identity.ts";

test("uses an explicit app release SHA before the hosting-provider SHA", () => {
  const identity = getAppReleaseIdentity({
    UGC_APP_GIT_COMMIT: "ABCDEF1234567",
    VERCEL_GIT_COMMIT_SHA: "1234567abcdef",
  });

  assert.deepEqual(identity, {
    gitCommit: "abcdef1234567",
    source: "UGC_APP_GIT_COMMIT",
  });
});

test("reports no verified app release identity for missing or invalid values", () => {
  assert.deepEqual(getAppReleaseIdentity({}), {
    gitCommit: null,
    source: null,
  });
  assert.equal(normalizeGitCommit("release-candidate"), null);
  assert.equal(normalizeGitCommit("  AbCdEf1  "), "abcdef1");
});
