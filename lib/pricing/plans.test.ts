import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlanPricing,
  getPlanVideoAllowance,
  parseBillingInterval,
  pricingPlans,
} from "./plans.ts";

test("model-specific allowances use the complete monthly video-only credit budget", () => {
  for (const [model, seconds, rate] of [["google_omni", 4, 2], ["wan_3_0", 3, 2], ["seedance_2_5", 4, 3], ["kling_3_0", 3, 1], ["kling_4_0", 3, 2]] as const) {
    for (const credits of [200, 600, 1200]) {
      const allowance = getPlanVideoAllowance(credits, model);
      assert.equal(allowance.hookSeconds, seconds);
      assert.ok(allowance.hookVideos * seconds * rate <= credits);
      assert.ok((allowance.hookVideos + 1) * seconds * rate > credits);
      assert.equal(allowance.fullVideos, Math.floor(credits / (6 * rate)));
    }
  }
});

test("annual pricing uses the catalogue charge and computes actual savings", () => {
  for (const plan of pricingPlans) {
    const annualPricing = getPlanPricing(plan, "yearly");

    if (plan.prices.monthly === 0) {
      assert.equal(annualPricing.billedAmount, 0);
      assert.equal(annualPricing.savings, 0);
      assert.equal(annualPricing.monthlyEquivalent, 0);
    } else {
      assert.equal(annualPricing.billedAmount, plan.prices.yearly);
      assert.equal(annualPricing.savings, plan.prices.monthly * 12 - plan.prices.yearly);
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

test("plans expose credit balances for Free, Starter, Growth, and Startup", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.sharedMonthlyCredits]),
    [
      ["free", 0],
      ["starter", 200],
      ["growth", 600],
      ["startup", 1200],
    ],
  );
});

test("paid plans show hook and full-video counts from two credits per second", () => {
  assert.deepEqual(
    pricingPlans.filter((plan) => plan.slug !== "free").map((plan) => [
      plan.slug,
      plan.features[0],
      plan.features[1],
      plan.features[2],
    ]),
    [
      ["starter", "25 4-second hook videos each month", "16 six-second videos each month", "200 AI credits each month"],
      ["growth", "75 4-second hook videos each month", "50 six-second videos each month", "600 AI credits each month"],
      ["startup", "150 4-second hook videos each month", "100 six-second videos each month", "1,200 AI credits each month"],
    ],
  );
});

test("plans expose the complete daily content allowance", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.dailyContentPieces]),
    [
      ["free", "20/day for 7 days"],
      ["starter", 20],
      ["growth", 50],
      ["startup", 50],
    ],
  );
});

test("Free pricing consistently advertises the seven-day trial", () => {
  const free = pricingPlans.find((plan) => plan.slug === "free")!;
  for (const interval of ["monthly", "yearly"] as const) {
    assert.equal(getPlanPricing(free, interval).billingSummary, "7-day free trial");
  }
  assert.equal(free.capacityLabel, "No AI credits");
  assert.equal(free.features.some((feature) => /free credits/i.test(feature)), false);
  assert.ok(free.features.includes("20 daily concepts for 7 days"));
  assert.ok(free.features.includes("Download finished carousels and videos"));
});

test("Free allows one Instagram account, Starter three, and Growth five", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.instagramAccounts]),
    [
      ["free", 1],
      ["starter", 3],
      ["growth", 5],
      ["startup", 5],
    ],
  );
});

test("plan feature lists describe all three supported connection platforms without changing account limits", () => {
  assert.deepEqual(
    pricingPlans.map((plan) =>
      plan.features.find((feature) =>
        feature === "Connect Instagram, TikTok & YouTube",
      ),
    ),
    [
      "Connect Instagram, TikTok & YouTube",
      "Connect Instagram, TikTok & YouTube",
      "Connect Instagram, TikTok & YouTube",
      "Connect Instagram, TikTok & YouTube",
    ],
  );
});

test("plans map slug to proper display name", () => {
  assert.deepEqual(
    pricingPlans.map((plan) => [plan.slug, plan.name]),
    [
      ["free", "Free trial"],
      ["starter", "Starter"],
      ["growth", "Growth"],
      ["startup", "Startup"],
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
      ["starter", 29, 299],
      ["growth", 49, 490],
      ["startup", 99, 999],
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
