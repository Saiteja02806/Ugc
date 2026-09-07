import assert from "node:assert/strict";
import test from "node:test";

import { RetryableJobError } from "../retryable-job-error.js";
import { prepareWallTextInApp } from "./wall-text-preparation.js";

const TEST_PARAMS = {
  businessProfileId: "00000000-0000-4000-8000-000000000101",
  businessProfileVersion: 1,
  requestedCount: 6,
  requestKey: "test-wall-request",
  userId: "test-user",
};

test("Wall gateway errors and network interruption retry; authentication errors remain terminal", async () => {
  await withWallPreparationEnvironment(async () => {
    for (const status of [408, 429, 502, 503, 504]) {
      await withMockFetch(async () => new Response("upstream unavailable", { status }), async () => {
        await assert.rejects(prepareWallTextInApp(TEST_PARAMS), RetryableJobError);
      });
    }
    await withMockFetch(async () => { throw new TypeError("fetch failed"); }, async () => {
      await assert.rejects(prepareWallTextInApp(TEST_PARAMS), RetryableJobError);
    });
    await withMockFetch(async () => new Response("unauthorized", { status: 401 }), async () => {
      await assert.rejects(prepareWallTextInApp(TEST_PARAMS), (error) =>
        error instanceof Error && !(error instanceof RetryableJobError));
    });
  });
});

test("does not retry a terminal fixed-layout rejection from the application", async () => {
  await withWallPreparationEnvironment(async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: "Wall-of-text could not be arranged safely inside the video.",
            errorCode: "wall_text_render_fit_rejected",
            ok: false,
          }),
          { status: 422 },
        ),
      async () => {
        await assert.rejects(
          prepareWallTextInApp(TEST_PARAMS),
          (error: unknown) =>
            error instanceof Error &&
            !(error instanceof RetryableJobError) &&
            (error as Error & { code?: string }).code ===
              "wall_text_render_fit_rejected",
        );
      },
    );
  });
});

test("retries only a classified temporary preparation failure", async () => {
  await withWallPreparationEnvironment(async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: "Wall-of-text preparation could not finish yet.",
            errorCode: "infrastructure_error",
            ok: false,
          }),
          { status: 500 },
        ),
      async () => {
        await assert.rejects(
          prepareWallTextInApp(TEST_PARAMS),
          (error: unknown) =>
            error instanceof RetryableJobError &&
            error.code === "infrastructure_error",
        );
      },
    );
  });
});

async function withWallPreparationEnvironment<T>(run: () => Promise<T>) {
  const appUrl = process.env.UGC_INTERNAL_APP_URL;
  const schedulingSecret = process.env.UGC_INTERNAL_SCHEDULING_SECRET;

  process.env.UGC_INTERNAL_APP_URL = "https://app.example.test";
  process.env.UGC_INTERNAL_SCHEDULING_SECRET = "a".repeat(32);

  try {
    return await run();
  } finally {
    restoreEnvironment("UGC_INTERNAL_APP_URL", appUrl);
    restoreEnvironment("UGC_INTERNAL_SCHEDULING_SECRET", schedulingSecret);
  }
}

async function withMockFetch<T>(
  mockFetch: typeof fetch,
  run: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
