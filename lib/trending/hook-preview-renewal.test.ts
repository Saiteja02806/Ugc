import assert from "node:assert/strict";
import test from "node:test";

import {
  getHookPreviewRenewalDelay,
  HOOK_PREVIEW_RENEW_FALLBACK_MS,
  HOOK_PREVIEW_RENEW_MINIMUM_MS,
} from "./hook-preview-renewal.ts";

test("renews a five-minute Hook preview one minute before it expires", () => {
  const now = Date.parse("2026-08-26T10:00:00.000Z");

  assert.equal(
    getHookPreviewRenewalDelay("2026-08-26T10:05:00.000Z", now),
    4 * 60_000,
  );
});

test("renews almost-expired Hook previews promptly without a tight loop", () => {
  const now = Date.parse("2026-08-26T10:00:00.000Z");

  assert.equal(
    getHookPreviewRenewalDelay("2026-08-26T10:00:10.000Z", now),
    HOOK_PREVIEW_RENEW_MINIMUM_MS,
  );
});

test("uses a safe renewal interval when an expiry value is malformed", () => {
  assert.equal(
    getHookPreviewRenewalDelay("not-a-date"),
    HOOK_PREVIEW_RENEW_FALLBACK_MS,
  );
});
