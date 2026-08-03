import assert from "node:assert/strict";
import test from "node:test";

import { runAnalyticsBackgroundSync } from "./background-sync-client.ts";

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
