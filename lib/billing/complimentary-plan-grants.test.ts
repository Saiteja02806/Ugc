import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasBillingAdminAccess, parseBillingAdminEmails } from "./admin-access.ts";
import { resolveBillingAccess } from "./complimentary-plan-policy.ts";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910105839_add_complimentary_plan_grants.sql",
    import.meta.url,
  ),
  "utf8",
);
const finalTrialGuardMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910113000_finalize_complimentary_plan_trial_guards.sql",
    import.meta.url,
  ),
  "utf8",
);
const adminRoute = readFileSync(
  new URL(
    "../../app/api/admin/billing/complimentary-grants/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const subscriptionDb = readFileSync(
  new URL("./subscription-db.ts", import.meta.url),
  "utf8",
);
const freeTrialPolicy = readFileSync(
  new URL("./free-trial.ts", import.meta.url),
  "utf8",
);
const billingPortalRoute = readFileSync(
  new URL("../../app/api/billing/portal/route.ts", import.meta.url),
  "utf8",
);

test("complimentary access resolves to the highest tier without replacing Dodo", () => {
  assert.deepEqual(
    resolveBillingAccess({ complimentaryPlanKey: "growth", dodoPlanKey: null }),
    { accessSource: "complimentary", planKey: "growth" },
  );
  assert.deepEqual(
    resolveBillingAccess({ complimentaryPlanKey: "growth", dodoPlanKey: "starter" }),
    { accessSource: "complimentary", planKey: "growth" },
  );
  assert.deepEqual(
    resolveBillingAccess({ complimentaryPlanKey: "starter", dodoPlanKey: "growth" }),
    { accessSource: "dodo", planKey: "growth" },
  );
  assert.deepEqual(
    resolveBillingAccess({ complimentaryPlanKey: "growth", dodoPlanKey: "growth" }),
    { accessSource: "dodo", planKey: "growth" },
  );
});

test("billing administration fails closed and requires a verified allowlisted email", () => {
  assert.deepEqual(
    [...parseBillingAdminEmails(" Owner@example.com,owner@example.com ")],
    ["owner@example.com"],
  );
  assert.equal(
    hasBillingAdminAccess(
      { email: "owner@example.com", emailVerified: true },
      "owner@example.com",
    ),
    true,
  );
  assert.equal(
    hasBillingAdminAccess(
      { email: "owner@example.com", emailVerified: false },
      "owner@example.com",
    ),
    false,
  );
  assert.equal(
    hasBillingAdminAccess(
      { email: "other@example.com", emailVerified: true },
      "owner@example.com",
    ),
    false,
  );
});

test("complimentary grants use a separate audited ledger and never a synthetic Dodo record", () => {
  assert.match(migration, /create table if not exists public\.complimentary_plan_grants/);
  assert.match(migration, /create table if not exists public\.complimentary_plan_credit_balances/);
  assert.match(migration, /create or replace function public\.grant_complimentary_plan/);
  assert.match(migration, /create or replace function public\.revoke_complimentary_plan/);
  assert.match(migration, /complimentary_plan_grant_id uuid/);
  assert.match(migration, /grant execute on function public\.grant_complimentary_plan[\s\S]*to service_role/);
  assert.doesNotMatch(
    migration,
    /insert into public\.billing_subscriptions[\s\S]{0,800}complimentary_plan_grants/i,
  );
});

test("database enforcement recognizes grants and keeps them separate from Dodo cancellation", () => {
  assert.match(migration, /v_complimentary_grant\.plan_key = 'growth' and v_dodo_plan_key = 'starter'/);
  assert.match(migration, /complimentary_plan_grant_id is null;/);
  assert.match(migration, /resolved_complimentary_grant_id is null/);
  assert.match(migration, /create or replace function public\.enforce_free_trial_daily_trending_feed/);
  assert.match(migration, /create or replace function public\.enforce_instagram_connection_limit/);
  assert.match(finalTrialGuardMigration, /complimentary_plan_grants as complimentary/);
  assert.match(finalTrialGuardMigration, /instagram_schedule_limit is not null/);
  assert.match(subscriptionDb, /getActiveComplimentaryPlanGrant/);
  assert.match(subscriptionDb, /isDodoManaged/);
  assert.match(freeTrialPolicy, /getActiveComplimentaryPlanGrant/);
});

test("the admin route is authenticated and never offers a billing portal for complimentary access", () => {
  assert.match(adminRoute, /await requireBillingAdmin\(request\)/);
  assert.match(adminRoute, /FirebaseAdminLookupError/);
  assert.match(billingPortalRoute, /!subscription\.isDodoManaged/);
});
