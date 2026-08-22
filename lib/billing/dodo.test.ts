import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getDodoEnvironment,
  resolveDefaultReturnUrl,
  resolveDodoProductConfig,
  resolveDodoProductId,
} from "./dodo.ts";
import { getPostSignInDestination, parsePurchaseIntent } from "./purchase-intent.ts";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260822120000_create_production_billing_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const webhookRoute = readFileSync(
  new URL("../../app/api/webhooks/dodo/route.ts", import.meta.url),
  "utf8",
);
const subscriptionDb = readFileSync(
  new URL("./subscription-db.ts", import.meta.url),
  "utf8",
);
const usageFlushRoute = readFileSync(
  new URL(
    "../../app/api/internal/billing/usage/flush/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("Dodo defaults to test mode unless live mode is explicit", () => {
  const original = process.env.DODO_PAYMENTS_ENVIRONMENT;
  delete process.env.DODO_PAYMENTS_ENVIRONMENT;
  assert.equal(getDodoEnvironment(), "test_mode");
  process.env.DODO_PAYMENTS_ENVIRONMENT = "live_mode";
  assert.equal(getDodoEnvironment(), "live_mode");
  restoreEnvironment("DODO_PAYMENTS_ENVIRONMENT", original);
});

test("product ids are required and map to one exact plan and cadence", () => {
  const original = process.env.DODO_STARTER_YEARLY_PRODUCT_ID;
  process.env.DODO_STARTER_YEARLY_PRODUCT_ID = "pdt_starter_yearly_test";

  assert.equal(
    resolveDodoProductId("starter", "yearly"),
    "pdt_starter_yearly_test",
  );
  assert.deepEqual(resolveDodoProductConfig("pdt_starter_yearly_test"), {
    billingInterval: "yearly",
    planSlug: "starter",
    productId: "pdt_starter_yearly_test",
  });
  assert.equal(resolveDodoProductConfig("pdt_unknown"), null);

  restoreEnvironment("DODO_STARTER_YEARLY_PRODUCT_ID", original);
});

test("checkout returns to activation verification instead of declaring success", () => {
  const url = new URL(resolveDefaultReturnUrl());
  assert.equal(url.pathname, "/dashboard/billing");
  assert.equal(url.searchParams.get("checkout"), "returned");
  assert.equal(url.searchParams.has("success"), false);
});

test("purchase intent survives authentication using validated values only", () => {
  const params = new URLSearchParams("plan=growth&billing=yearly&returnTo=https://evil.test");
  assert.deepEqual(parsePurchaseIntent(params), {
    billingInterval: "yearly",
    planSlug: "growth",
  });
  assert.equal(
    getPostSignInDestination(params),
    "/pricing?checkout=continue&plan=growth&billing=yearly",
  );
  assert.equal(
    getPostSignInDestination(new URLSearchParams("plan=unknown")),
    "/dashboard",
  );
});

test("webhook route requires Standard Webhooks headers and official unwrapping", () => {
  assert.match(webhookRoute, /request\.headers\.get\("webhook-id"\)/);
  assert.match(webhookRoute, /request\.headers\.get\("webhook-timestamp"\)/);
  assert.match(webhookRoute, /request\.headers\.get\("webhook-signature"\)/);
  assert.match(webhookRoute, /unwrapDodoWebhook/);
  assert.doesNotMatch(webhookRoute, /x-dodo-signature|x-signature/);
  assert.doesNotMatch(webhookRoute, /data\.customer_id\s*\|\|/);
});

test("billing migration provides idempotency, ordering, credits, and job settlement", () => {
  assert.match(migration, /create table if not exists public\.billing_webhook_events/);
  assert.match(migration, /existing_last_event_at > p_event_timestamp/);
  assert.match(migration, /create or replace function public\.reserve_billing_credits/);
  assert.match(migration, /insufficient_billing_credits/);
  assert.match(migration, /settle_billing_background_job_trigger/);
  assert.match(migration, /create table if not exists public\.billing_usage_outbox/);
  assert.match(migration, /credit_cost integer not null/);
  assert.match(migration, /resolved_credit_cost/);
});

test("usage delivery matches the configured Dodo meter aggregation", () => {
  assert.match(subscriptionDb, /"image\.generation"/);
  assert.match(subscriptionDb, /"video\.generation"/);
  assert.match(subscriptionDb, /credits_cost: String\(toInteger\(data\.credit_cost\)\)/);
  assert.match(subscriptionDb, /flushPendingBillingUsageEvents/);
  assert.match(usageFlushRoute, /verifyCloudTasksOidcRequest/);
  assert.match(usageFlushRoute, /Cache-Control": "no-store"/);
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
