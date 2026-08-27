import assert from "node:assert/strict";
import test from "node:test";

import {
  getSubscriptionActivationFailure,
  shouldPollForSubscriptionActivation,
} from "./activation-state.ts";

test("activation polling only waits for an absent or pending Dodo result", () => {
  assert.equal(shouldPollForSubscriptionActivation(undefined), true);
  assert.equal(shouldPollForSubscriptionActivation("free"), true);
  assert.equal(shouldPollForSubscriptionActivation("pending"), true);
  assert.equal(shouldPollForSubscriptionActivation("active"), false);
  assert.equal(shouldPollForSubscriptionActivation("failed"), false);
  assert.equal(shouldPollForSubscriptionActivation("cancelled"), false);
  assert.equal(shouldPollForSubscriptionActivation("expired"), false);
  assert.equal(shouldPollForSubscriptionActivation("on_hold"), false);
  assert.equal(shouldPollForSubscriptionActivation("paused"), false);
});

test("a failed Dodo subscription has an immediate user-facing result", () => {
  assert.deepEqual(getSubscriptionActivationFailure("failed"), {
    description:
      "Dodo Payments could not complete the payment. Your subscription was not activated.",
    title: "Payment failed",
  });
  assert.equal(getSubscriptionActivationFailure("active"), null);
  assert.equal(getSubscriptionActivationFailure("pending"), null);
});
