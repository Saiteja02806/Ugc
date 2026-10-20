import assert from "node:assert/strict";
import test from "node:test";
import { isBackgroundOnboardingEnabled } from "./onboarding-rollout.ts";

test("background onboarding defaults to a controlled rollout", () => {
  assert.equal(isBackgroundOnboardingEnabled("alice", {}), false);
  assert.equal(isBackgroundOnboardingEnabled("alice", { BUSINESS_ONBOARDING_BACKGROUND_USER_IDS: "bob, alice " }), true);
  assert.equal(isBackgroundOnboardingEnabled("ali", { BUSINESS_ONBOARDING_BACKGROUND_USER_IDS: "alice" }), false);
  assert.equal(isBackgroundOnboardingEnabled("", {}), false);
});

test("the enrollment switch overrides the allowlist", () => {
  assert.equal(isBackgroundOnboardingEnabled("alice", { BUSINESS_ONBOARDING_BACKGROUND_ENABLED: "true" }), true);
  assert.equal(isBackgroundOnboardingEnabled("alice", {
    BUSINESS_ONBOARDING_BACKGROUND_ENABLED: "false", BUSINESS_ONBOARDING_BACKGROUND_USER_IDS: "alice",
  }), false);
});
