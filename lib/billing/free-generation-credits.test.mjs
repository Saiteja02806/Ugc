import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test, { mock } from "node:test";
import { pathToFileURL } from "node:url";

const local = (file) => pathToFileURL(path.resolve(file)).href;
process.env.SUPABASE_URL = "https://free-credits-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture";
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
class FirebaseAuthRequestError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}
mock.module(local("lib/firebase/server-auth.ts"), {
  namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => ({ uid: "fixture" }) },
});
let calls = [], status = "free", unavailable = false;
let free = { granted: 2, remaining: 2, reserved: 0, used: 0 };
const response = (body, code = 200) => new Response(JSON.stringify(body), {
  status: code, headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
});
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.hostname, "free-credits-fixture.invalid", "No live provider calls are allowed");
  const table = url.pathname.split("/").pop();
  calls.push(table);
  if (table === "ensure_free_generation_credit_balance") {
    return unavailable ? response({ message: "temporarily unavailable" }, 503) : response(free);
  }
  const subscription = {
    dodo_subscription_id: "fixture-sub", plan_key: "starter", status,
    billing_interval: "monthly", last_event_at: new Date().toISOString(),
  };
  if (table === "billing_subscriptions") {
    return response(url.searchParams.has("status") ? status === "active" ? [subscription] : [] : status === "free" ? [] : [subscription]);
  }
  if (table === "billing_credit_balances") {
    return response([{ dodo_subscription_id: "fixture-sub", credit_limit: 200, used_credits: 10, reserved_credits: 2 }]);
  }
  if (table === "subscription_entitlements") return response([{ plan_key: "free", daily_trending_limit: 20 }, { plan_key: "pro", daily_trending_limit: 20 }]);
  if ((init?.method ?? input.method) === "HEAD") {
    return new Response(null, { status: 200, headers: { "Content-Range": "*/0" } });
  }
  return response(url.pathname.includes("/rpc/") ? null : []);
};
const { getUserSubscription } = await import(local("lib/billing/subscription-db.ts"));
const { isAIStudioProUser } = await import(local("lib/ai-studio/server-access.ts"));

test("free account receives generation credits without paid status, monthly credits, or an active subscription", async () => {
  status = "free";
  const subscription = await getUserSubscription("fixture", { strict: true, refreshCredits: false });
  assert.equal(subscription.isActive, false);
  assert.equal(subscription.isDodoManaged, false);
  assert.equal(subscription.accessSource, "free");
  assert.equal(subscription.planKey, "free");
  assert.equal(subscription.sharedMonthlyCredits, 0);
  assert.equal(subscription.creditsRemaining, 2);
  assert.deepEqual(subscription.freeGenerationCredits, free);
  assert.equal(await isAIStudioProUser({ uid: "fixture" }), true);
});

test("free workspace access remains available while all credits are reserved and after they are used", async () => {
  for (const balance of [
    { granted: 2, remaining: 0, reserved: 2, used: 0 },
    { granted: 2, remaining: 0, reserved: 0, used: 2 },
  ]) {
    free = balance;
    const subscription = await getUserSubscription("fixture", { strict: true, refreshCredits: false });
    assert.equal(subscription.isActive, false);
    assert.equal(subscription.creditsRemaining, 0);
    assert.equal(await isAIStudioProUser({ uid: "fixture" }), true, "Owned result polling must not stop after reservation or completion");
  }
  free = { granted: 2, remaining: 2, reserved: 0, used: 0 };
});

test("held paid user gets only the separate lifetime allowance and retains recovery state", async () => {
  status = "on_hold";
  const subscription = await getUserSubscription("fixture", { strict: true, refreshCredits: false });
  assert.equal(subscription.isActive, false);
  assert.equal(subscription.isDodoManaged, true);
  assert.equal(subscription.status, "on_hold");
  assert.equal(subscription.sharedMonthlyCredits, 0);
  assert.equal(subscription.creditsRemaining, 2);
});

test("active paid account retains its paid credit source and cannot accrue a monthly free allowance", async () => {
  status = "active"; calls = [];
  const subscription = await getUserSubscription("fixture", { strict: true, refreshCredits: false });
  assert.equal(subscription.isActive, true);
  assert.equal(subscription.sharedMonthlyCredits, 200);
  assert.equal(subscription.creditsRemaining, 188);
  assert.equal(subscription.freeGenerationCredits.granted, 0);
  assert.equal(calls.includes("ensure_free_generation_credit_balance"), false);
});

test("unavailable free ledger fails closed and blank identities never receive an allocation", async () => {
  status = "free"; unavailable = true;
  await assert.rejects(getUserSubscription("fixture", { strict: true, refreshCredits: false }), /ENTITLEMENTS_UNAVAILABLE/u);
  await assert.rejects(isAIStudioProUser({ uid: "fixture" }), /ENTITLEMENTS_UNAVAILABLE/u);
  unavailable = false; calls = [];
  const anonymous = await getUserSubscription("", { strict: true, refreshCredits: false });
  assert.equal(anonymous.creditsRemaining, 0);
  assert.equal(anonymous.freeGenerationCredits.granted, 0);
  assert.equal(calls.length, 0);
});
