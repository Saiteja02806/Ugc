import assert from "node:assert/strict";
import test from "node:test";

import { getEffectiveSocialConnectionStatus } from "./connection-status.ts";

const now = Date.parse("2026-07-16T12:00:00.000Z");

test("keeps expired TikTok access active while its refresh token is valid", () => {
  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-15T12:00:00.000Z",
        hasRefreshToken: true,
        platform: "tiktok",
        refreshExpiresAt: "2027-07-15T12:00:00.000Z",
        revokedAt: null,
        status: "connected",
      },
      now,
    ),
    "connected",
  );
});

test("marks TikTok expired when its refresh token is also expired", () => {
  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-15T12:00:00.000Z",
        hasRefreshToken: true,
        platform: "tiktok",
        refreshExpiresAt: "2026-07-16T11:00:00.000Z",
        revokedAt: null,
        status: "connected",
      },
      now,
    ),
    "expired",
  );
});

test("keeps an expired YouTube connection active when it can be refreshed", () => {
  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-15T12:00:00.000Z",
        hasRefreshToken: true,
        platform: "youtube",
        revokedAt: null,
        status: "connected",
      },
      now,
    ),
    "connected",
  );
});

test("marks expired YouTube access without a refresh token as expired", () => {
  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-15T12:00:00.000Z",
        hasRefreshToken: false,
        platform: "youtube",
        revokedAt: null,
        status: "connected",
      },
      now,
    ),
    "expired",
  );
});

test("preserves a valid connection and lets revocation take precedence", () => {
  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-17T12:00:00.000Z",
        hasRefreshToken: false,
        platform: "instagram",
        revokedAt: null,
        status: "connected",
      },
      now,
    ),
    "connected",
  );

  assert.equal(
    getEffectiveSocialConnectionStatus(
      {
        expiresAt: "2026-07-17T12:00:00.000Z",
        hasRefreshToken: true,
        platform: "youtube",
        revokedAt: "2026-07-16T11:00:00.000Z",
        status: "connected",
      },
      now,
    ),
    "revoked",
  );
});
