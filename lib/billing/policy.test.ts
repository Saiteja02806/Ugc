import assert from "node:assert/strict";
import test from "node:test";

import {
  INSTAGRAM_ACCOUNT_LIMITS,
  resolveInstagramAccountLimit,
} from "./policy.ts";

test("Instagram connection limits allow Free and Starter one account", () => {
  assert.deepEqual(INSTAGRAM_ACCOUNT_LIMITS, {
    free: 1,
    growth: 3,
    starter: 1,
  });
  assert.equal(resolveInstagramAccountLimit("free", false), 1);
  assert.equal(resolveInstagramAccountLimit("starter", true), 1);
});

test("only an active Growth plan allows multiple Instagram accounts", () => {
  assert.equal(resolveInstagramAccountLimit("growth", true), 3);
  assert.equal(resolveInstagramAccountLimit("growth", false), 1);
  assert.equal(resolveInstagramAccountLimit("starter", false), 1);
});
