import assert from "node:assert/strict";
import test from "node:test";

import { resolvePricingPlanAction } from "./plan-action.ts";
import { pricingPlans } from "./plans.ts";

type Params = Parameters<typeof resolvePricingPlanAction>[0];
const [starter, growth] = pricingPlans;
// The catalogue no longer sells a free plan (paid-only, 2026-11-12); this
// fixture only exercises the unpaid-account branch of the resolver.
const free = { name: "Free", slug: "free" } as const;
// The pricing plan action reads only the trial status; the full entitlement
// stays on the real subscription and is narrowed here to the action subset.
const trial: NonNullable<Params["subscription"]> = {
  accessSource: "free",
  billingInterval: null,
  isActive: false,
  isDodoManaged: false,
  planKey: "free",
  status: "free",
  trial: { status: "active" },
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

test("anonymous free signup uses a neutral start-free action", () => {
  const result = action({ plan: free, signedIn: false, subscription: null });
  assert.equal(result.label, "Start free");
  assert.equal(result.destination, "sign-in");
  assert.equal(result.disabled, false);
  assert.equal(action({ signedIn: false, subscription: null }).label, "Get Starter");
});

test("free-plan users have a working workspace action without trial badges", () => {
  const active = action({ plan: free });
  assert.equal(active.label, "Open workspace");
  assert.equal(active.destination, "workspace");
  assert.equal(active.disabled, false);
  assert.equal(active.badgeLabel, null);

  const expired = action({ plan: free, subscription: { ...trial, trial: { ...trial.trial, status: "expired" } } });
  assert.equal(expired.badgeLabel, null);
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
