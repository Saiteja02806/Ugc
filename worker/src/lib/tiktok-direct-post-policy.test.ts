import assert from "node:assert/strict";
import test from "node:test";
import { getTikTokDirectPostBlock } from "./tiktok-direct-post-policy.js";

test("unaudited publishing needs both a private account and Only me", () => {
  const evaluate = (privacyLevels: string[], privacyLevel = "SELF_ONLY") =>
    getTikTokDirectPostBlock({ audited: false, privacyLevel, privacyLevels });
  assert.equal(evaluate(["FOLLOWER_OF_CREATOR", "SELF_ONLY"]), null);
  assert.equal(evaluate(["PUBLIC_TO_EVERYONE", "SELF_ONLY"])?.code, "private_account_required");
  assert.equal(evaluate(["FOLLOWER_OF_CREATOR"], "FOLLOWER_OF_CREATOR")?.code, "direct_post_audit_required");
  for (const options of [[], ["SELF_ONLY"], ["MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]]) {
    assert.equal(evaluate(options)?.code, "account_privacy_unavailable");
  }
  assert.equal(evaluate(["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "SELF_ONLY"])?.code, "private_account_required");
});

test("the private-testing restriction does not block audited clients", () => {
  for (const privacyLevel of ["SELF_ONLY", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS"]) {
    assert.equal(getTikTokDirectPostBlock({
      audited: true, privacyLevel, privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
    }), null);
  }
});
