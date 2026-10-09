import assert from "node:assert/strict";
import test from "node:test";

import { FREE_TRIAL_CONTENT_DAYS } from "../billing/free-trial-policy.ts";
import { resolvePricingPlanAction } from "./plan-action.ts";
import { pricingPlans } from "./plans.ts";

type Params = Parameters<typeof resolvePricingPlanAction>[0];
const [free, starter, growth] = pricingPlans;
const trial: NonNullable<Params["subscription"]> = {
  accessSource: "free",
  billingInterval: null,
  isActive: false,
  isDodoManaged: false,
  planKey: "free",
  status: "free",
  trial: {
    contentDaysLimit: FREE_TRIAL_CONTENT_DAYS,
    contentDaysRemaining: FREE_TRIAL_CONTENT_DAYS,
    contentDaysUsed: 0,
    dailyContentPieces: 20,
    daysRemaining: FREE_TRIAL_CONTENT_DAYS,
    expiresAt: null,
    instagramSchedulesLimit: null,
    instagramSchedulesRemaining: null,
    instagramSchedulesUsed: 0,
    startedAt: null,
    status: "active",
  },
};
const paid = {
  ...trial,
  accessSource: "dodo" as const,
  billingInterval: "monthly" as const,
  isActive: true,
  isDodoManaged: true,
  planKey: "starter" as const,
  status: "active" as const,
};

function action(params: Partial<Params> = {}) {
  return resolvePricingPlanAction({
    billingInterval: "monthly",
    isSubscriptionLoading: false,
    plan: starter,
    signedIn: true,
    subscription: trial,
    ...params,
  });
}

test("anonymous trial signup uses the current trial duration", () => {
  const result = action({ plan: free, signedIn: false, subscription: null });
  assert.equal(result.label, `Start ${FREE_TRIAL_CONTENT_DAYS}-day trial`);
  assert.equal(result.destination, "sign-in");
  assert.equal(result.disabled, false);
  assert.equal(action({ signedIn: false, subscription: null }).label, "Get Starter");
});

test("active and expired trial users have a working workspace action and accurate badges", () => {
  const active = action({ plan: free });
  assert.equal(active.label, "Open workspace");
  assert.equal(active.destination, "workspace");
  assert.equal(active.disabled, false);
  assert.equal(active.badgeLabel, "Trial active");

  const expired = action({ plan: free, subscription: { ...trial, trial: { ...trial.trial, status: "expired" } } });
  assert.equal(expired.badgeLabel, "Trial ended");
  assert.equal(expired.disabled, false);
  assert.equal(action({ subscription: { ...trial, trial: { ...trial.trial, status: "expired" } } }).destination, "checkout");
});

test("current paid management stays actionable and interval changes go through the portal", () => {
  const current = action({ subscription: paid });
  assert.equal(current.badgeLabel, "Current plan");
  assert.equal(current.label, "Manage current plan");
  assert.equal(current.disabled, false);
  assert.equal(current.destination, "portal");

  const yearly = action({ billingInterval: "yearly", subscription: paid });
  assert.equal(yearly.label, "Switch to annual billing");
  assert.equal(yearly.badgeLabel, "Current plan");
  assert.equal(yearly.destination, "portal");
  assert.equal(action({ plan: growth, subscription: paid }).label, "Change plan");
});

test("held and failed subscribers recover payment without being presented as a current free plan", () => {
  for (const status of ["on_hold", "failed"] as const) {
    const subscription = { ...paid, isActive: false, status };
    const result = action({ subscription });
    assert.equal(result.label, "Update payment method");
    assert.equal(result.badgeLabel, "Payment needed");
    assert.equal(result.destination, "portal");
    assert.equal(result.disabled, false);
    const freeResult = action({ plan: free, subscription });
    assert.equal(freeResult.badgeLabel, null);
    assert.equal(freeResult.label, "Manage billing");
    assert.equal(freeResult.disabled, false);
  }
});

test("complimentary subscribers open their current workspace and can choose a paid tier", () => {
  const subscription = { ...paid, accessSource: "complimentary" as const, isDodoManaged: false };
  const current = action({ subscription });
  assert.equal(current.badgeLabel, "Complimentary");
  assert.equal(current.label, "Open workspace");
  assert.equal(current.destination, "workspace");
  assert.equal(current.disabled, false);
  assert.equal(action({ plan: growth, subscription }).destination, "checkout");
});

test("signed-in checkout is blocked while billing is absent, loading, or in error", () => {
  for (const state of [
    { subscription: null },
    { isSubscriptionLoading: true },
    { isSubscriptionError: true },
    { subscription: paid, isSubscriptionError: true },
  ]) {
    const result = action(state);
    assert.equal(result.destination, "none");
    assert.equal(result.disabled, true);
    assert.equal(result.badgeLabel, null);
  }
  assert.equal(action({ authLoading: true, signedIn: false }).disabled, true);
});
