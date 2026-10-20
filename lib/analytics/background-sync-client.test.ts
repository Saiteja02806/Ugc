import assert from "node:assert/strict";
import test from "node:test";

import { runAnalyticsBackgroundSync } from "./background-sync-client.ts";

test("returns a saved analytics snapshot without waiting for a job", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({
      data: { accounts: [{ connectionId: "instagram-1" }], days: 30 },
      ok: true,
      refreshing: false,
    });
  };

  try {
    const output = await runAnalyticsBackgroundSync({
      token: "test-token",
      url: "https://example.test/api/analytics",
    });

    assert.deepEqual(output, {
      accounts: [{ connectionId: "instagram-1" }],
      days: 30,
    });
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stops polling a stalled analytics job after the client deadline", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;

    return Response.json(
      {
        job: { status: "queued" },
        jobId: "job-stalled",
        ok: true,
      },
      { status: 202 },
    );
  };

  try {
    await assert.rejects(
      runAnalyticsBackgroundSync({
        timeoutMs: 10,
        token: "test-token",
        url: "https://example.test/api/analytics",
      }),
      /taking longer than expected/i,
    );
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("renders saved data first and then delivers fresh output without blocking", async () => {
  const originalFetch = globalThis.fetch;
  const saved = { accounts: [{ connectionId: "channel", views: 0 }] };
  const fresh = { accounts: [{ connectionId: "channel", views: 7 }] };
  const refreshing: boolean[] = [];
  let resolveOutput!: (value: unknown) => void;
  const background = new Promise((resolve) => { resolveOutput = resolve; });
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ ok: true, data: saved, jobId: "one", job: { status: "queued" } })
    : Response.json({ ok: true, job: { status: "completed", output: fresh } });
  try {
    const output = await runAnalyticsBackgroundSync({ token: "test", url: "https://example.test", pollIntervalMs: 1,
      onRefreshingChange: (value) => refreshing.push(value), onBackgroundOutput: resolveOutput });
    assert.deepEqual(output, saved);
    assert.equal(calls, 1);
    assert.deepEqual(await background, fresh);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(refreshing, [true, false]);
  } finally { globalThis.fetch = originalFetch; }
});

test("queue failure warning preserves saved data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, data: { accounts: [] }, warning: "Refresh unavailable" });
  let warning = "";
  try {
    assert.deepEqual(await runAnalyticsBackgroundSync({ token: "test", url: "https://example.test",
      onBackgroundError: (error) => { warning = error.message; } }), { accounts: [] });
    assert.equal(warning, "Refresh unavailable");
  } finally { globalThis.fetch = originalFetch; }
});
