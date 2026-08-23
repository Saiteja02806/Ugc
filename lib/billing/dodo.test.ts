import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertDodoCheckoutConfigured,
  getDodoEnvironment,
  resolveDefaultReturnUrl,
  resolveDodoProductConfig,
  resolveDodoProductId,
} from "./dodo.ts";
import { getPostSignInDestination, parsePurchaseIntent } from "./purchase-intent.ts";
import {
  getBillingUsageRetryDelayMs,
  getSubscriptionEntitlementPlanKey,
  resolveDailyContentPieces,
} from "./policy.ts";

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
const billingActivationStatus = readFileSync(
  new URL(
    "../../components/billing/billing-activation-status.tsx",
    import.meta.url,
  ),
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
const hardeningMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260823130914_harden_billing_credit_cycles_and_usage_retry.sql",
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

test("checkout fails closed until signed webhook delivery is configured", () => {
  const originalApiKey = process.env.DODO_PAYMENTS_API_KEY;
  const originalWebhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  process.env.DODO_PAYMENTS_API_KEY = "test-api-key";
  delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;

  assert.throws(
    () => assertDodoCheckoutConfigured(),
    /signed webhook credentials/,
  );

  process.env.DODO_PAYMENTS_WEBHOOK_KEY = "test-webhook-key";
  assert.doesNotThrow(() => assertDodoCheckoutConfigured());
  restoreEnvironment("DODO_PAYMENTS_API_KEY", originalApiKey);
  restoreEnvironment("DODO_PAYMENTS_WEBHOOK_KEY", originalWebhookKey);
});

test("subscription activation stops its two-second polling after the bounded wait", () => {
  assert.match(billingActivationStatus, /const ACTIVATION_WAIT_MS = 60_000/);
  assert.match(
    billingActivationStatus,
    /activationPolling: !timedOut/,
  );
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

test("billing entitlements use the database-backed legacy plan mapping", () => {
  assert.equal(getSubscriptionEntitlementPlanKey("free"), "free");
  assert.equal(getSubscriptionEntitlementPlanKey("starter"), "pro");
  assert.equal(getSubscriptionEntitlementPlanKey("growth"), "creator");
  assert.equal(resolveDailyContentPieces("free", false, 12), 12);
  assert.match(subscriptionDb, /refresh_billing_credit_balance/);
});

test("usage retry delay is exponential and capped", () => {
  assert.equal(getBillingUsageRetryDelayMs(1), 5 * 60 * 1000);
  assert.equal(getBillingUsageRetryDelayMs(2), 10 * 60 * 1000);
  assert.equal(getBillingUsageRetryDelayMs(20), 6 * 60 * 60 * 1000);
});

test("billing hardening migration anchors monthly cycles and attributes reservations", () => {
  assert.match(hardeningMigration, /credit_cycle_anchor timestamptz/);
  assert.match(hardeningMigration, /credit_period_start timestamptz/);
  assert.match(hardeningMigration, /resolve_billing_credit_cycle/);
  assert.match(hardeningMigration, /make_interval\(months => month_offset \+ 1\)/);
  assert.match(
    hardeningMigration,
    /reservation\.credit_period_start = balance\.period_start/,
  );
  assert.doesNotMatch(
    hardeningMigration,
    /period_start = date_trunc\('month', now\(\)\)/,
  );
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
