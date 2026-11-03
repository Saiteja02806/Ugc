import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { NextRequest } from "next/server";

let authenticated = true;
class FirebaseAuthRequestError extends Error { status = 401; }
mock.module(new URL("../firebase/server-auth.ts", import.meta.url).href, { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => {
    if (!authenticated) throw new FirebaseAuthRequestError("Sign in required");
    return { uid: "fixture-user", email: "fixture@example.invalid", displayName: "Fixture" };
  },
} });

process.env.SUPABASE_URL = "https://startup-billing-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
process.env.DODO_PAYMENTS_API_KEY = "fixture-only";
process.env.DODO_PAYMENTS_WEBHOOK_KEY = "fixture-only";
process.env.DODO_PAYMENTS_ENVIRONMENT = "live_mode";
process.env.APP_BASE_URL = "https://vidmake.io";

let grantPlan = null, providerFailure = false, expiredCycle = false;
let rows = [];
const sent = [];
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
});
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "live.dodopayments.com") {
    sent.push({ path: url.pathname, body: init.body ? JSON.parse(init.body) : null });
    if (url.pathname.includes("customer-portal")) return json({ link: "https://checkout-fixture.invalid/portal" });
    return providerFailure ? json({ message: "Provider unavailable" }, 503)
      : json({ session_id: "fixture-session", checkout_url: "https://checkout-fixture.invalid/session" });
  }
  assert.equal(url.hostname, "startup-billing-fixture.invalid", "No real network calls allowed");
  const table = url.pathname.split("/").at(-1);
  if (table === "billing_subscriptions") return json(url.searchParams.has("status") ? rows.filter(r => r.status === "active") : rows);
  if (table === "billing_credit_balances") return json({ dodo_subscription_id: "startup-sub", credit_limit: expiredCycle ? 1800 : 1200, used_credits: 12, reserved_credits: 24,
    period_end: expiredCycle ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z" });
  if (table === "billing_customers") return json({ dodo_customer_id: "fixture-customer" });
  if (table === "complimentary_plan_grants") return json(grantPlan ? { id: "grant", plan_key: grantPlan, credit_limit: 600, updated_at: "2026-11-03T12:00:00Z" } : null);
  if (table === "complimentary_plan_credit_balances") return json({ credit_limit: 600, used_credits: 0, reserved_credits: 0 });
  if (table === "subscription_entitlements") return json([{ plan_key: "creator", daily_trending_limit: 50 }]);
  if ((init?.method ?? input.method) === "HEAD") return new Response(null, { status: 200, headers: { "Content-Range": "*/0" } });
  return json(url.searchParams.get("select")?.includes("limit") ? null : []);
};

const { getUserSubscription } = await import("./subscription-db.ts");
const { getGenerationCreditCost } = await import("./subscription-db.ts");
test("three credits per video second stays consistent despite a historical environment override", () => {
  const previous = process.env.BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND;
  try {
    process.env.BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND = "4";
    for (const seconds of [1, 3, 6, 10]) assert.equal(getGenerationCreditCost("video", seconds), seconds * 3);
    for (const model of ["wan_3_0", "google_omni", "seedance_2_5"]) {
      for (const seconds of [1, 3, 6, 10]) {
        assert.equal(getGenerationCreditCost("video", seconds, model), seconds * (model === "seedance_2_5" ? 3 : 2));
      }
    }
  } finally {
    if (previous === undefined) delete process.env.BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND;
    else process.env.BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND = previous;
  }
});
const { createDodoCheckoutSession } = await import("./dodo.ts");
const { POST } = await import("../../app/api/billing/checkout/route.ts");
const startup = { dodo_subscription_id: "startup-sub", plan_key: "startup", status: "active", billing_interval: "yearly", last_event_at: "2026-11-03T12:00:00Z" };

test("real subscription lookup recognizes Startup above paid or complimentary Growth", async () => {
  for (const grant of [null, "growth"]) {
    grantPlan = grant;
    rows = [{ ...startup, dodo_subscription_id: "growth-sub", plan_key: "growth" }, startup];
    const result = await getUserSubscription("fixture-user", { strict: true, refreshCredits: false });
    assert.equal(result.planKey, "startup");
    assert.equal(result.displayName, "Startup");
    assert.equal(result.accessSource, "dodo");
    assert.equal(result.isActive, true);
    assert.equal(result.isDodoManaged, true);
    assert.equal(result.sharedMonthlyCredits, 1200);
    assert.equal(result.creditsRemaining, 1164);
    assert.equal(result.billingInterval, "yearly");
  }
});

test("a Startup complimentary grant is recognized without inventing a paid subscription", async () => {
  grantPlan = "startup";
  rows = [];
  const result = await getUserSubscription("fixture-user", { strict: true, refreshCredits: false });
  assert.equal(result.planKey, "startup");
  assert.equal(result.accessSource, "complimentary");
  assert.equal(result.isDodoManaged, false);
});

test("read-only expired-cycle preview matches the next-cycle policy without a ledger write", async () => {
  grantPlan = null; rows = [startup]; expiredCycle = true;
  try {
    const result = await getUserSubscription("fixture-user", { strict: true, refreshCredits: false });
    assert.equal(result.sharedMonthlyCredits, 1200);
    assert.equal(result.creditsRemaining, 1200);
    assert.equal(result.creditsUsed, 0);
    assert.equal(result.creditsReserved, 0);
  } finally { expiredCycle = false; }
});

test("historical paid plan aliases remain managed after tier selection", async () => {
  grantPlan = null;
  for (const [alias, expected] of [["creator", "growth"], ["ultra_pro", "growth"], ["pro", "starter"]]) {
    rows = [{ ...startup, plan_key: alias }];
    const result = await getUserSubscription("fixture-user", { strict: true, refreshCredits: false });
    assert.equal(result.planKey, expected);
    assert.equal(result.isDodoManaged, true);
    assert.equal(result.isActive, true);
  }
});

test("every checkout sends only the selected plan and cadence; a provider failure is not retried", async () => {
  for (const plan of ["starter", "growth", "startup"]) {
    for (const interval of ["monthly", "yearly"]) {
      const variable = plan === "startup" ? `DODO_STARTUP_PLAN_${interval.toUpperCase()}`
        : `DODO_${plan.toUpperCase()}_${interval.toUpperCase()}_PRODUCT_ID`;
      process.env[variable] = `fixture-${plan}-${interval}`;
    }
  }
  for (const planSlug of ["starter", "growth", "startup"]) {
    for (const billingInterval of ["monthly", "yearly"]) {
      const result = await createDodoCheckoutSession({ planSlug, billingInterval, userId: "fixture-user", userEmail: "fixture@example.invalid" });
      assert.equal(result.productId, `fixture-${planSlug}-${billingInterval}`);
      assert.deepEqual(sent.at(-1).body.product_cart, [{ product_id: result.productId, quantity: 1 }]);
      assert.equal(sent.at(-1).body.metadata.plan_slug, planSlug);
      assert.equal(sent.at(-1).body.metadata.billing_interval, billingInterval);
    }
  }
  const count = sent.length;
  providerFailure = true;
  await assert.rejects(createDodoCheckoutSession({ planSlug: "startup", billingInterval: "yearly", userId: "fixture-user", userEmail: "fixture@example.invalid" }));
  assert.equal(sent.length, count + 1, "Billing POSTs must not replay on SDK retries");
  providerFailure = false;
});

test("actual checkout route sells Startup for complimentary Growth and protects existing paid subscriptions", async () => {
  grantPlan = "growth"; rows = [];
  const request = body => new NextRequest("https://vidmake.io/api/billing/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const valid = { planSlug: "startup", billingInterval: "yearly" };
  let result = await POST(request(valid));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).productId, "fixture-startup-yearly");
  assert.deepEqual(sent.at(-1).body.product_cart, [{ product_id: "fixture-startup-yearly", quantity: 1 }]);
  assert.match(result.headers.get("set-cookie"), /HttpOnly/i);

  rows = [startup];
  result = await POST(request(valid));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).status, "portal", "Paid Startup must manage its existing subscription");
  assert.match(sent.at(-1).path, /customer-portal/);

  const count = sent.length;
  result = await POST(request({ ...valid, planSlug: "not-a-plan" }));
  assert.equal(result.status, 400);
  authenticated = false;
  result = await POST(request(valid));
  assert.equal(result.status, 401);
  assert.equal(sent.length, count);
  authenticated = true;
});
