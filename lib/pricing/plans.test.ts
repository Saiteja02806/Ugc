import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlanPricing,
  parseBillingInterval,
  pricingPlans,
} from "./plans.ts";

test("annual pricing charges ten monthly payments for paid tiers", () => {
  for (const plan of pricingPlans) {
    const annualPricing = getPlanPricing(plan, "yearly");

    if (plan.prices.monthly === 0) {
      assert.equal(annualPricing.billedAmount, 0);
      assert.equal(annualPricing.savings, 0);
      assert.equal(annualPricing.monthlyEquivalent, 0);
    } else {
      assert.equal(annualPricing.billedAmount, plan.prices.monthly * 10);
      assert.equal(annualPricing.savings, plan.prices.monthly * 2);
      assert.equal(annualPricing.monthlyEquivalent, plan.prices.yearly / 12);
    }
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

test("plans expose credit balances for Free, Starter, and Growth", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.sharedMonthlyCredits]),
    [
      ["free", 0],
      ["starter", 200],
      ["growth", 600],
    ],
  );
});

test("plans expose the complete daily content allowance", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.dailyContentPieces]),
    [
      ["free", 10],
      ["starter", 20],
      ["growth", 50],
    ],
  );
});

test("Free and Starter allow one Instagram account while Growth allows three", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.instagramAccounts]),
    [
      ["free", 1],
      ["starter", 1],
      ["growth", 3],
    ],
  );
});

test("plans map slug to proper display name", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.name]),
    [
      ["free", "Free"],
      ["starter", "Starter"],
      ["growth", "Growth"],
    ],
  );
});

test("display prices match the configured Dodo catalog", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [
      plan.slug,
      plan.prices.monthly,
      plan.prices.yearly,
    ]),
    [
      ["free", 0, 0],
      ["starter", 19, 190],
      ["growth", 49, 490],
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
