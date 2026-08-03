import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertSocialOAuthReconnectTarget,
  SocialOAuthReconnectPolicyError,
  type SocialOAuthReconnectTarget,
} from "./oauth-reconnect-policy.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";

const target: SocialOAuthReconnectTarget = {
  connectionId,
  platform: "instagram",
  platformAccountId: "instagram-account-123",
  provider: "meta",
  revokedAt: null,
  userId,
};

function projectFile(relativePath: string) {
  return new URL(`../../${relativePath}`, import.meta.url);
}

test("add-account authorization does not require an existing connection", () => {
  assert.doesNotThrow(() =>
    assertSocialOAuthReconnectTarget({
      expectedConnectionId: null,
      intent: "add",
      platform: "instagram",
      provider: "meta",
      target: null,
      userId,
    }),
  );
});

test("reconnect rejects a connection that is not owned and active", () => {
  assert.throws(
    () =>
      assertSocialOAuthReconnectTarget({
        expectedConnectionId: connectionId,
        intent: "reconnect",
        platform: "instagram",
        provider: "meta",
        target: null,
        userId,
      }),
    (error: unknown) =>
      error instanceof SocialOAuthReconnectPolicyError &&
      error.code === "reconnect_connection_unavailable" &&
      error.status === 404,
  );
});

test("reconnect rejects credentials returned for a different Instagram account", () => {
  assert.throws(
    () =>
      assertSocialOAuthReconnectTarget({
        expectedConnectionId: connectionId,
        intent: "reconnect",
        platform: "instagram",
        provider: "meta",
        returnedPlatformAccountId: "different-instagram-account",
        target,
        userId,
      }),
    (error: unknown) =>
      error instanceof SocialOAuthReconnectPolicyError &&
      error.code === "reconnect_account_mismatch" &&
      error.status === 409,
  );
});

test("reconnect accepts the exact account selected by the user", () => {
  assert.doesNotThrow(() =>
    assertSocialOAuthReconnectTarget({
      expectedConnectionId: connectionId,
      intent: "reconnect",
      platform: "instagram",
      provider: "meta",
      returnedPlatformAccountId: target.platformAccountId,
      target,
      userId,
    }),
  );
});

test("OAuth session migration persists a constrained reconnect target", () => {
  const migration = readFileSync(
    projectFile(
      "supabase/migrations/20260728110910_add_account_specific_social_oauth.sql",
    ),
    "utf8",
  );

  assert.match(migration, /intent text not null default 'add'/);
  assert.match(migration, /expected_connection_id uuid/);
  assert.match(migration, /intent in \('add', 'reconnect'\)/);
  assert.match(
    migration,
    /foreign key \(expected_connection_id\)[\s\S]*references public\.social_connections\(id\)/,
  );
  assert.match(migration, /on delete cascade/);
  assert.doesNotMatch(migration, /grant\s+.+\s+to\s+(anon|authenticated)/i);
});

test("callback verifies the returned account before storing credentials", () => {
  const oauthSource = readFileSync(projectFile("lib/social/oauth.ts"), "utf8");
  const fetchAccountIndex = oauthSource.indexOf("fetchPlatformAccount");
  const verifyAccountIndex = oauthSource.indexOf(
    "returnedPlatformAccountId: account.id",
  );
  const upsertIndex = oauthSource.indexOf("upsertSocialConnection");

  assert.ok(fetchAccountIndex >= 0);
  assert.ok(verifyAccountIndex > fetchAccountIndex);
  assert.ok(upsertIndex > verifyAccountIndex);
});

test("account surfaces keep add and reconnect actions distinct", () => {
  const settingsSource = readFileSync(
    projectFile("components/settings/instagram-account-manager.tsx"),
    "utf8",
  );
  const modalSource = readFileSync(
    projectFile("components/social/platform-selection-modal.tsx"),
    "utf8",
  );
  const schedulingSource = readFileSync(
    projectFile("lib/scheduling/service.ts"),
    "utf8",
  );

  assert.match(settingsSource, /intent: "add"/);
  assert.match(
    settingsSource,
    /expectedConnectionId: connection\.id[\s\S]*intent: "reconnect"/,
  );
  assert.match(settingsSource, /Add another account/);
  assert.match(modalSource, /MAX_SELECTED_INSTAGRAM_ACCOUNTS = 5/);
  assert.match(modalSource, /Add another Instagram account/);
  assert.match(schedulingSource, /normalized\.length > 5/);
});
