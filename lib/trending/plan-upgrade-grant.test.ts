import assert from "node:assert/strict";
import test from "node:test";

import { getAdditionalTrendingSlotsForUpgrade } from "./plan-upgrade-grant.ts";

test("a completed Free feed receives a full Starter pack after upgrading", () => {
  assert.equal(
    getAdditionalTrendingSlotsForUpgrade({
      currentPlanDailyLimit: 20,
      currentPlanKey: "pro",
      existingFeedPlanKey: "free",
    }),
    20,
  );
});

test("a completed Free feed receives a full Growth pack after upgrading", () => {
  assert.equal(
    getAdditionalTrendingSlotsForUpgrade({
      currentPlanDailyLimit: 50,
      currentPlanKey: "creator",
      existingFeedPlanKey: "free",
    }),
    50,
  );
});

test("the same plan, a downgrade, and a repeat refresh do not create another pack", () => {
  assert.equal(
    getAdditionalTrendingSlotsForUpgrade({
      currentPlanDailyLimit: 20,
      currentPlanKey: "pro",
      existingFeedPlanKey: "pro",
    }),
    0,
  );
  assert.equal(
    getAdditionalTrendingSlotsForUpgrade({
      currentPlanDailyLimit: 10,
      currentPlanKey: "free",
      existingFeedPlanKey: "creator",
    }),
    0,
  );
});
