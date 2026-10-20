import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test, { mock } from "node:test";
import { pathToFileURL } from "node:url";

const local = (file) => pathToFileURL(path.resolve(file)).href;
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
} });

let subscription, customerId, user, calls;
class FixtureAuthError extends Error {}
mock.module(local("lib/firebase/server-auth.ts"), {
  namedExports: {
    FirebaseAuthRequestError: FixtureAuthError,
    requireFirebaseUser: async () => user,
  },
});
mock.module(local("lib/billing/subscription-db.ts"), {
  namedExports: {
    getBillingCustomerId: async () => customerId,
    getUserSubscription: async (userId, options) => {
      calls.push({ kind: "subscription", userId, options });
      if (subscription instanceof Error) throw subscription;
      return subscription;
    },
  },
});
mock.module(local("lib/billing/dodo.ts"), {
  namedExports: {
    createDodoCustomerPortalSession: async (input) => {
      calls.push({ kind: "portal", input });
      return "https://fixture.invalid/portal";
    },
    createDodoCheckoutSession: async (input) => {
      calls.push({ kind: "checkout", input });
      return { checkoutUrl: "https://fixture.invalid/checkout", productId: "product", sessionId: "checkout-new" };
    },
  },
});
const { NextRequest } = await import("next/server.js");
const { POST } = await import(local("app/api/billing/checkout/route.ts"));
function reset() {
  subscription = { isDodoManaged: false, status: "free" };
  customerId = null;
  user = { uid: "fixture", email: "fixture@example.invalid", displayName: "Fixture" };
  calls = [];
}
function request(input = { planSlug: "starter", billingInterval: "monthly" }) {
  return new NextRequest("https://getugcpilot.com/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
  });
}

test("stale checkout clicks from active, held, failed, and paused subscribers open the existing portal", async () => {
  for (const status of ["active", "on_hold", "failed", "paused"]) {
    reset();
    subscription = { isDodoManaged: true, status };
    customerId = "existing-customer";
    const response = await POST(request({ planSlug: "growth", billingInterval: "yearly" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.portalUrl, "https://fixture.invalid/portal");
    assert.equal(body.checkoutUrl, body.portalUrl, "Existing checkoutUrl clients keep navigating safely");
    assert.equal(body.status, "portal");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(calls.filter((call) => call.kind === "checkout").length, 0);
    assert.deepEqual(calls.find((call) => call.kind === "subscription").options, { strict: true, refreshCredits: false });
  }
});

test("new checkout preserves its session response, requested interval, and activation cookie", async () => {
  reset();
  const response = await POST(request({ planSlug: "growth", billingInterval: "yearly" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    checkoutUrl: "https://fixture.invalid/checkout", productId: "product", sessionId: "checkout-new", status: "ready",
  });
  assert.match(response.headers.get("set-cookie"), /ugc-pilot-pending-checkout=checkout-new/u);
  assert.equal(calls.find((call) => call.kind === "checkout").input.billingInterval, "yearly");
});

test("missing existing account and unavailable subscription state cannot create a second checkout", async () => {
  reset();
  subscription = { isDodoManaged: true, status: "active" };
  assert.equal((await POST(request())).status, 409);
  assert.equal(calls.some((call) => call.kind === "checkout"), false);
  reset();
  subscription = new Error("ENTITLEMENTS_UNAVAILABLE");
  const previousError = console.error;
  console.error = () => {};
  try { assert.equal((await POST(request())).status, 500); }
  finally { console.error = previousError; }
  assert.equal(calls.some((call) => call.kind === "checkout" || call.kind === "portal"), false);
});

test("invalid checkout input is rejected before billing provider calls", async () => {
  reset();
  assert.equal((await POST(request({ planSlug: "free" }))).status, 400);
  assert.equal(calls.length, 0);
});
