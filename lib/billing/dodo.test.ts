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
import {
  calculateVideoGenerationCreditCost,
  DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND,
} from "./generation-credit-policy.ts";
import { getPaidTrendingPrebuildIdempotencyKey } from "./paid-trending-prebuild.ts";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260822120000_create_production_billing_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const webhookRoute = readFileSync(
  new URL("../../app/api/webhooks/dodo/route.ts", import.meta.url),
  "utf8",
);
const checkoutActivationRoute = readFileSync(
  new URL(
    "../../app/api/billing/checkout/activate/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const paidTrendingPrebuildDispatch = readFileSync(
  new URL("./paid-trending-prebuild-dispatch.ts", import.meta.url),
  "utf8",
);
const paidTrendingPrebuildMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260826140336_add_paid_trending_prebuild_on_subscription_activation.sql",
    import.meta.url,
  ),
  "utf8",
);
const paidTrendingPrebuildRoute = readFileSync(
  new URL(
    "../../app/api/internal/jobs/prepare-paid-trending/route.ts",
    import.meta.url,
  ),
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
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260823130914_harden_billing_credit_cycles_and_usage_retry.sql",
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
  assert.match(
    billingActivationStatus,
    /getSubscriptionActivationFailure/,
  );
  assert.match(subscriptionDb, /status,\r?\n\s*trial: trialResult/);
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

test("an active paid subscription atomically saves one prebuild job before webhook delivery", () => {
  assert.match(
    paidTrendingPrebuildMigration,
    /create trigger billing_subscriptions_enqueue_paid_trending_prebuild[\s\S]*after insert or update/i,
  );
  assert.match(
    paidTrendingPrebuildMigration,
    /new\.status <> 'active'[\s\S]*new\.plan_key not in \('starter', 'growth'\)/i,
  );
  assert.match(
    paidTrendingPrebuildMigration,
    /'paid_trending_prebuild'[\s\S]*'ai-generation'[\s\S]*on conflict do nothing/i,
  );
  assert.match(
    webhookRoute,
    /processDodoSubscriptionEvent\([\s\S]*after\(\(\) =>[\s\S]*dispatchPaidTrendingPrebuild[\s\S]*return NextResponse\.json/,
  );
  assert.match(
    paidTrendingPrebuildDispatch,
    /dispatchQueuedBackgroundJobForRecovery/,
  );
  assert.match(
    checkoutActivationRoute,
    /prebuildDispatch[\s\S]*after\(\(\) => dispatchPaidTrendingPrebuild/,
  );
});

test("paid prebuild uses one stable period key for duplicate webhook deliveries", () => {
  assert.equal(
    getPaidTrendingPrebuildIdempotencyKey({
      periodStart: "2026-08-26T11:04:45.567Z",
      planKey: "starter",
      subscriptionId: "sub_123",
    }),
    "paid-trending-prebuild:v1:sub_123:starter:20260826T110445Z",
  );
  assert.equal(
    getPaidTrendingPrebuildIdempotencyKey({
      periodStart: null,
      planKey: "growth",
      subscriptionId: "sub_123",
    }),
    "paid-trending-prebuild:v1:sub_123:growth:subscription",
  );
});

test("paid prebuild rechecks the current plan before preparing the existing feed", () => {
  assert.match(paidTrendingPrebuildRoute, /getUserSubscription\(input\.userId\)/);
  assert.match(
    paidTrendingPrebuildRoute,
    /subscription\.planKey !== input\.expectedPlanKey[\s\S]*subscription_is_no_longer_current/,
  );
  assert.match(
    paidTrendingPrebuildRoute,
    /ensureUnifiedTrendingDailyFeed\([\s\S]*markItemsShown: false/,
  );
  assert.match(paidTrendingPrebuildRoute, /isBusinessProfileOnboardingComplete/);
});

test("video generation charges four credits for every selected second", () => {
  assert.equal(DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND, 4);
  assert.deepEqual(
    [3, 4, 5, 6, 7, 8, 9, 10].map((seconds) =>
      calculateVideoGenerationCreditCost(seconds),
    ),
    [12, 16, 20, 24, 28, 32, 36, 40],
  );
  assert.match(
    subscriptionDb,
    /BILLING_VIDEO_GENERATION_CREDITS_PER_SECOND/,
  );
  assert.doesNotMatch(subscriptionDb, /BILLING_VIDEO_GENERATION_CREDITS"/);
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
