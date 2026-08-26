import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdditionalTrendingSlotsForUpgrade,
  getReservedTrendingDailyLimit,
} from "./plan-upgrade-grant.ts";

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

test("preserves the expanded feed size during Starter reconciliation", () => {
  assert.equal(
    getReservedTrendingDailyLimit({
      currentPlanDailyLimit: 20,
      existingFeedDailyLimit: 30,
      upgradeSlots: 0,
    }),
    30,
  );
});

test("preserves the expanded feed size during Growth reconciliation", () => {
  assert.equal(
    getReservedTrendingDailyLimit({
      currentPlanDailyLimit: 50,
      existingFeedDailyLimit: 60,
      upgradeSlots: 0,
    }),
    60,
  );
});

test("adds exactly one new pack during a same-day upgrade", () => {
  assert.equal(
    getReservedTrendingDailyLimit({
      currentPlanDailyLimit: 20,
      existingFeedDailyLimit: 10,
      upgradeSlots: 20,
    }),
    30,
  );
  assert.equal(
    getReservedTrendingDailyLimit({
      currentPlanDailyLimit: 50,
      existingFeedDailyLimit: 10,
      upgradeSlots: 50,
    }),
    60,
  );
});

test("uses the current allowance only when no feed exists yet", () => {
  assert.equal(
    getReservedTrendingDailyLimit({
      currentPlanDailyLimit: 20,
      existingFeedDailyLimit: null,
      upgradeSlots: 0,
    }),
    20,
  );
});
