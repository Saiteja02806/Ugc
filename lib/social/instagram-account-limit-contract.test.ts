import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function projectFile(relativePath: string) {
  return new URL(`../../${relativePath}`, import.meta.url);
}

test("Instagram OAuth checks the plan limit before authorization starts", () => {
  const routeSource = readFileSync(
    projectFile("app/api/social/oauth/start/route.ts"),
    "utf8",
  );

  assert.match(routeSource, /intent === "add" && platform === "instagram"/);
  assert.match(
    routeSource,
    /connectedInstagramAccounts >= subscription\.instagramAccounts/,
  );
  assert.match(routeSource, /instagram_account_limit_reached/);
});

test("Instagram connection limits are enforced atomically in Postgres", () => {
  const migration = readFileSync(
    projectFile(
      "supabase/migrations/20260824120641_enforce_instagram_account_limits.sql",
    ),
    "utf8",
  );

  assert.match(migration, /account_limit integer := 1/);
  assert.match(migration, /plan_key = 'growth'[\s\S]*status = 'active'/);
  assert.match(migration, /account_limit := 3/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /before insert or update of user_id, platform, revoked_at/);
  assert.match(migration, /old\.revoked_at is null[\s\S]*return new/);
  assert.match(migration, /message = 'instagram_account_limit_reached'/);
  assert.match(
    migration,
    /revoke execute[\s\S]*from public, anon, authenticated/,
  );
  assert.doesNotMatch(migration, /security definer/i);
});

test("the OAuth callback translates the database guard into a safe user error", () => {
  const oauthSource = readFileSync(projectFile("lib/social/oauth.ts"), "utf8");
  const callbackSource = readFileSync(
    projectFile("lib/social/oauth-callback.ts"),
    "utf8",
  );

  assert.match(oauthSource, /isInstagramAccountLimitDatabaseError/);
  assert.match(
    oauthSource,
    /"instagram_account_limit_reached",[\s\S]*"save_connected_account"/,
  );
  assert.match(callbackSource, /errorCode === "instagram_account_limit_reached"/);
});

test("settings exposes the first connection and blocks only accounts beyond the limit", () => {
  const settingsSource = readFileSync(
    projectFile("components/settings/instagram-account-manager.tsx"),
    "utf8",
  );

  assert.match(settingsSource, /useBillingSubscription\(\)/);
  assert.match(settingsSource, /instagramAccounts \?\? 1/);
  assert.match(
    settingsSource,
    /connections\.length >= instagramAccountLimit/,
  );
  assert.match(
    settingsSource,
    /disabled=\{Boolean\(connectingPlatform\) \|\| accountLimitReached\}/,
  );
  assert.match(settingsSource, /Upgrade to Growth to connect multiple accounts/);
});
