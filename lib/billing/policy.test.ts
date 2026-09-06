import assert from "node:assert/strict";
import test from "node:test";

import {
  INSTAGRAM_ACCOUNT_LIMITS,
  resolveInstagramAccountLimit,
} from "./policy.ts";

test("Instagram connection limits allow Free one account and Starter three", () => {
  assert.deepEqual(INSTAGRAM_ACCOUNT_LIMITS, {
    free: 1,
    growth: 5,
    starter: 3,
  });
  assert.equal(resolveInstagramAccountLimit("free", false), 1);
  assert.equal(resolveInstagramAccountLimit("starter", true), 3);
});

test("active paid plans receive their Instagram account allowances", () => {
  assert.equal(resolveInstagramAccountLimit("growth", true), 5);
  assert.equal(resolveInstagramAccountLimit("growth", false), 1);
  assert.equal(resolveInstagramAccountLimit("starter", false), 1);
});
