import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRunwayDailyCreditBudget,
  estimateRunwayVideoCredits,
  getRunwayUtcCreditWindow,
  resolveRunwayDailyCreditLimit,
} from "./runway-credit-budget.js";

test("defaults the Runway daily limit to 100 credits", () => {
  assert.equal(resolveRunwayDailyCreditLimit(undefined), 100);
});

test("rejects an invalid Runway daily credit limit", () => {
  assert.throws(() => resolveRunwayDailyCreditLimit("0"), /positive integer/);
  assert.throws(() => resolveRunwayDailyCreditLimit("100.5"), /positive integer/);
});

test("estimates the current four-second Hook video costs", () => {
  assert.equal(estimateRunwayVideoCredits("gen4_turbo", 4), 20);
  assert.equal(estimateRunwayVideoCredits("veo3.1_fast", 4), 40);
});

test("uses one UTC calendar day for credit accounting", () => {
  assert.deepEqual(
    getRunwayUtcCreditWindow(new Date("2026-08-01T23:59:59.000Z")),
    {
      beforeDate: "2026-08-02",
      startDate: "2026-08-01",
    },
  );
});

test("allows a generation that reaches exactly 100 credits", async () => {
  const result = await assertRunwayDailyCreditBudget(
    {
      retrieve: async () => ({
        usage: { models: { gen4_turbo: { dailyGenerations: 4 } } },
      }),
      retrieveUsage: async () => ({
        results: [{ usedCredits: [{ amount: 80 }] }],
      }),
    },
    20,
    {
      configuredLimit: "100",
      now: new Date("2026-08-01T12:00:00.000Z"),
    },
  );

  assert.equal(result.remainingCreditsAfterGeneration, 0);
});

test("blocks a generation that would exceed 100 credits", async () => {
  await assert.rejects(
    assertRunwayDailyCreditBudget(
      {
        retrieve: async () => ({ usage: { models: {} } }),
        retrieveUsage: async () => ({
          results: [{ usedCredits: [{ amount: 81 }] }],
        }),
      },
      20,
      { configuredLimit: "100" },
    ),
    /100 credits per UTC day/,
  );
});

test("uses immediate generation counters when detailed credit usage lags", async () => {
  const result = await assertRunwayDailyCreditBudget(
    {
      retrieve: async () => ({
        usage: { models: { gen4_turbo: { dailyGenerations: 1 } } },
      }),
      retrieveUsage: async () => ({
        results: [{ usedCredits: [] }],
      }),
    },
    20,
    { configuredLimit: "100" },
  );

  assert.equal(result.reportedCredits, 0);
  assert.equal(result.estimatedCreditsFromDailyGenerations, 20);
  assert.equal(result.usedCredits, 20);
  assert.equal(result.remainingCreditsAfterGeneration, 60);
});
