import assert from "node:assert/strict";
import test from "node:test";

import {
  getPendingCheckoutSessionIds,
  serializePendingCheckoutSessionIds,
} from "./pending-checkout.ts";

test("keeps the newest three valid checkout sessions and removes duplicates", () => {
  assert.deepEqual(
    getPendingCheckoutSessionIds(
      "checkout_new.checkout_middle.checkout_old.checkout_stale.checkout_new",
    ),
    ["checkout_new", "checkout_middle", "checkout_old"],
  );
});

test("serializes a bounded checkout hint that can be read from a cookie", () => {
  assert.equal(
    serializePendingCheckoutSessionIds([
      "checkout_new",
      "checkout_middle",
      "checkout_old",
      "checkout_extra",
    ]),
    "checkout_new.checkout_middle.checkout_old",
  );
});

test("ignores malformed or empty checkout cookie values", () => {
  assert.deepEqual(
    getPendingCheckoutSessionIds(
      "short.invalid%20session.checkout_valid_123!",
    ),
    [],
  );
});
