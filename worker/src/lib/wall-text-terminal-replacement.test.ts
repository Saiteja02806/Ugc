import assert from "node:assert/strict";
import test from "node:test";

import { RetryableJobError } from "../retryable-job-error.js";
import { scheduleWallTextTerminalReplacement } from "./wall-text-terminal-replacement.js";

const originalFetch = globalThis.fetch;
const originalAppUrl = process.env.UGC_INTERNAL_APP_URL;
const originalSecret = process.env.UGC_INTERNAL_SCHEDULING_SECRET;

test.after(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("UGC_INTERNAL_APP_URL", originalAppUrl);
  restoreEnv("UGC_INTERNAL_SCHEDULING_SECRET", originalSecret);
});

test("schedules one signed terminal candidate replacement", async () => {
  process.env.UGC_INTERNAL_APP_URL = "https://www.getugcpilot.com";
  process.env.UGC_INTERNAL_SCHEDULING_SECRET = "a".repeat(32);
  let requestedUrl = "";
  let requestBody = "";
  let signature = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body);
    signature = String(new Headers(init?.headers).get("x-ugc-finalization-signature"));
    return new Response(JSON.stringify({ ok: true, jobId: "replacement-job", replacementScheduled: true }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await scheduleWallTextTerminalReplacement(params());

  assert.equal(requestedUrl, "https://www.getugcpilot.com/api/internal/jobs/recover-wall-text-terminal");
  assert.equal(signature.length > 20, true);
  assert.deepEqual(JSON.parse(requestBody), params());
  assert.deepEqual(result, { jobId: "replacement-job", replacementScheduled: true });
});

test("retries a temporary replacement admission failure", async () => {
  process.env.UGC_INTERNAL_APP_URL = "https://www.getugcpilot.com";
  process.env.UGC_INTERNAL_SCHEDULING_SECRET = "a".repeat(32);
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 503 });

  await assert.rejects(scheduleWallTextTerminalReplacement(params()), RetryableJobError);
});

test("allows a non-daily Wall batch to replenish its missing slot", async () => {
  process.env.UGC_INTERNAL_APP_URL = "https://www.getugcpilot.com";
  process.env.UGC_INTERNAL_SCHEDULING_SECRET = "a".repeat(32);
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({ ok: true, replacementScheduled: false }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const { dailyFeedId: _dailyFeedId, ...nonDaily } = params();
  await scheduleWallTextTerminalReplacement(nonDaily);

  assert.equal("dailyFeedId" in JSON.parse(requestBody), false);
});

function params() {
  return {
    businessProfileId: "123e4567-e89b-42d3-a456-426614174000",
    businessProfileVersion: 2,
    dailyFeedId: "123e4567-e89b-42d3-a456-426614174001",
    errorCode: "wall_text_render_fit_rejected",
    failedJobId: "123e4567-e89b-42d3-a456-426614174002",
    recoveryKey: "daily-feed",
    requestedCount: 6,
    userId: "user-id",
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
