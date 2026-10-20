import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { readFileSync } from "node:fs";

let audited = false;
let options = [];
let calls = [];
let failure;
class CapabilitiesError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
mock.module("../social/tiktok-direct-post-audit.ts", {
  namedExports: { isTikTokDirectPostAudited: () => audited },
});
mock.module("../social/tiktok-publish-capabilities.ts", {
  namedExports: {
    TikTokPublishCapabilitiesError: CapabilitiesError,
    getTikTokPublishCapabilitiesForOwner: async params => {
      calls.push(params);
      if (failure) throw failure;
      return { privacyLevels: options };
    },
  },
});
const { assertTikTokScheduleEligibility } = await import("./tiktok-preflight.ts");
const input = { connectionId: "chosen-account", userId: "owner", privacyLevel: "SELF_ONLY" };
beforeEach(() => { audited = false; options = []; calls = []; failure = undefined; });

test("public account plus Only me is rejected with actionable guidance", async () => {
  options = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];
  await assert.rejects(assertTikTokScheduleEligibility(input), error => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "tiktok_private_account_required");
    assert.match(error.message, /Only me alone is not enough/);
    return true;
  });
  assert.deepEqual(calls, [{ connectionId: "chosen-account", userId: "owner" }]);
  assert.equal(input.privacyLevel, "SELF_ONLY");
});

test("private accounts pass and each check refreshes creator information", async () => {
  options = ["FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];
  await assertTikTokScheduleEligibility(input);
  options = ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
  await assert.rejects(assertTikTokScheduleEligibility(input), { code: "tiktok_private_account_required" });
  assert.equal(calls.length, 2);
});

test("unknown privacy fails closed instead of treating Only me as a private account", async () => {
  options = ["SELF_ONLY"];
  await assert.rejects(assertTikTokScheduleEligibility(input), { code: "tiktok_account_privacy_unavailable" });
});

test("unavailable creator info preserves the recoverable API error", async () => {
  failure = new CapabilitiesError("TikTok publishing settings could not be loaded. Try again.", 502);
  await assert.rejects(assertTikTokScheduleEligibility(input), { status: 502, code: "tiktok_capabilities_unavailable" });
});

test("unaudited non-private visibility is rejected without another API call", async () => {
  await assert.rejects(assertTikTokScheduleEligibility({ ...input, privacyLevel: "PUBLIC_TO_EVERYONE" }), { code: "tiktok_direct_post_audit_required" });
  assert.equal(calls.length, 0);
});

test("audited publishing retains existing behavior", async () => {
  audited = true;
  await assertTikTokScheduleEligibility({ ...input, privacyLevel: "PUBLIC_TO_EVERYONE" });
  assert.equal(calls.length, 0);
});

test("shared target resolution preflights TikTok only, before accepting the connection", () => {
  const source = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
  const resolver = source.slice(source.indexOf("async function resolveScheduleTargets("));
  assert.match(resolver, /if \(connection.platform === "tiktok"\) \{\s+await assertTikTokScheduleEligibility\(/);
  assert.ok(resolver.indexOf("await assertTikTokScheduleEligibility(") < resolver.indexOf("connections.push("));
});
