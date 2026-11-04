import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://checkout-account-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture";

let recent, active, balance, customer, failingTable, calls, releases;
function reset() {
  recent = [];
  active = [];
  balance = null;
  customer = null;
  failingTable = null;
  calls = [];
  releases = [];
}
reset();

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.hostname, "checkout-account-fixture.invalid", "No real network calls");
  assert.equal(init?.method ?? input.method ?? "GET", "GET", "Checkout must not grant/refresh credits");
  assert.equal(url.searchParams.get("user_id"), "eq.owner");
  const table = url.pathname.split("/").pop();
  assert.ok(["billing_subscriptions", "billing_credit_balances", "billing_customers"].includes(table));
  calls.push({ table, query: url.searchParams });
  // Every request waits for all four to start. Serializing any one would hang.
  await new Promise(resolve => {
    releases.push(resolve);
    if (releases.length === 4) releases.forEach(release => release());
  });
  if (table === failingTable) return new Response(JSON.stringify({ message: "fixture failure" }), { status: 400 });
  const data = table === "billing_subscriptions"
    ? url.searchParams.get("status") === "eq.active" ? active : recent
    : table === "billing_credit_balances" ? balance ? [balance] : []
      : customer ? [{ dodo_customer_id: customer }] : [];
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};

const { getBillingCheckoutAccount } = await import("./subscription-db.ts");

test("free checkout reads exactly four owned records concurrently, without dashboard or credit RPC work", { timeout: 1500 }, async () => {
  reset();
  assert.deepEqual(await getBillingCheckoutAccount("owner"), { customerId: null, isDodoManaged: false });
  assert.equal(calls.length, 4);
  for (const call of calls.filter(call => call.table === "billing_subscriptions")) {
    assert.equal(call.query.get("limit"), "10");
    assert.equal(call.query.get("order"), "last_event_at.desc");
  }
});

test("active paid tiers and historical tier aliases keep using their existing billing account", { timeout: 1500 }, async () => {
  for (const plan_key of ["starter", "growth", "startup", "pro", "creator", "ultra_pro"]) {
    reset();
    active = [{ dodo_subscription_id: "paid", plan_key, status: "active" }];
    recent = [{ dodo_subscription_id: "old", plan_key: "starter", status: "cancelled" }];
    customer = "customer-owner";
    assert.deepEqual(await getBillingCheckoutAccount("owner"), { customerId: customer, isDodoManaged: true });
  }
});

test("balance owner's held/paused/failed subscription wins over a newer cancellation", { timeout: 1500 }, async () => {
  for (const status of ["on_hold", "paused", "failed"]) {
    reset();
    recent = [
      { dodo_subscription_id: "old", status: "cancelled" },
      { dodo_subscription_id: "current", status },
    ];
    balance = { dodo_subscription_id: "current" };
    assert.equal((await getBillingCheckoutAccount("owner")).isDodoManaged, true);
  }
});

test("fallback status and missing customer retain existing account-guard semantics", { timeout: 1500 }, async () => {
  for (const status of ["on_hold", "paused", "failed", "cancelled", "expired", "pending", "free"]) {
    reset();
    recent = [{ dodo_subscription_id: "latest", status }];
    assert.deepEqual(await getBillingCheckoutAccount("owner"), {
      customerId: null,
      isDodoManaged: ["on_hold", "paused", "failed"].includes(status),
    });
  }
});

test("each billing read failure refuses to guess new-checkout eligibility", { timeout: 1500 }, async () => {
  for (const table of ["billing_subscriptions", "billing_credit_balances", "billing_customers"]) {
    reset();
    failingTable = table;
    await assert.rejects(getBillingCheckoutAccount("owner"));
  }
  reset();
  await assert.rejects(getBillingCheckoutAccount(" "));
  assert.equal(calls.length, 0);
});
