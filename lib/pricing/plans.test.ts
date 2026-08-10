import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlanPricing,
  parseBillingInterval,
  pricingPlans,
} from "./plans.ts";

test("annual pricing charges ten monthly payments", () => {
  for (const plan of pricingPlans) {
    const annualPricing = getPlanPricing(plan, "yearly");

    assert.equal(annualPricing.billedAmount, plan.prices.monthly * 10);
    assert.equal(annualPricing.savings, plan.prices.monthly * 2);
    assert.equal(annualPricing.monthlyEquivalent, plan.prices.yearly / 12);
  }
});

test("monthly pricing has no annual savings", () => {
  for (const plan of pricingPlans) {
    const monthlyPricing = getPlanPricing(plan, "monthly");

    assert.equal(monthlyPricing.billedAmount, plan.prices.monthly);
    assert.equal(monthlyPricing.monthlyEquivalent, plan.prices.monthly);
    assert.equal(monthlyPricing.savings, 0);
  }
});

test("plans expose a single shared monthly credit balance", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.sharedMonthlyCredits]),
    [
      ["creator", 200],
      ["pro", 600],
    ],
  );
});

test("only the yearly query value selects annual billing", () => {
  assert.equal(parseBillingInterval("yearly"), "yearly");
  assert.equal(parseBillingInterval(["yearly"]), "yearly");
  assert.equal(parseBillingInterval("monthly"), "monthly");
  assert.equal(parseBillingInterval("invalid"), "monthly");
  assert.equal(parseBillingInterval(undefined), "monthly");
});
