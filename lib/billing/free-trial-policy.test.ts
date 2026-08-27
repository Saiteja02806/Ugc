import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_TRIAL_CONTENT_DAYS,
  FREE_TRIAL_DAILY_CONTENT_PIECES,
  FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT,
  getFreeTrialDaysRemaining,
  resolveFreeTrialStatus,
} from "./free-trial-policy.ts";

test("free trial policy has the agreed three-day, ten-piece, five-schedule limits", () => {
  assert.equal(FREE_TRIAL_CONTENT_DAYS, 3);
  assert.equal(FREE_TRIAL_DAILY_CONTENT_PIECES, 10);
  assert.equal(FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT, 5);
});

test("free trial access is active only before its explicit expiry", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  assert.equal(
    resolveFreeTrialStatus({
      startedAt: "2026-08-26T12:00:00.000Z",
      expiresAt: "2026-08-28T12:00:00.000Z",
      now,
    }),
    "active",
  );
  assert.equal(
    resolveFreeTrialStatus({
      startedAt: "2026-08-24T12:00:00.000Z",
      expiresAt: "2026-08-27T12:00:00.000Z",
      now,
    }),
    "expired",
  );
  assert.equal(
    resolveFreeTrialStatus({ expiresAt: null, startedAt: null, now }),
    "unavailable",
  );
});

test("remaining trial days never become negative", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  assert.equal(
    getFreeTrialDaysRemaining({
      expiresAt: "2026-08-29T12:00:00.000Z",
      now,
    }),
    2,
  );
  assert.equal(
    getFreeTrialDaysRemaining({
      expiresAt: "2026-08-27T11:59:59.999Z",
      now,
    }),
    0,
  );
});
