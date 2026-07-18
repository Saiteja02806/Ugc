import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER,
  CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER,
  createCarouselReplenishmentSignature,
  getCarouselReplenishmentConfig,
  runDailyCarouselReplenishmentSweep,
} from "./carousel-replenishment.js";

const secret = "0123456789abcdef0123456789abcdef";
const cycleId = "2026-07-18T00:00:00.000Z";
const firstCursor = "00000000-0000-4000-8000-000000000001";

test("creates the same HMAC signature expected by the internal route", () => {
  const body = JSON.stringify({ cycleId, limit: 5 });
  const timestamp = "1234567890";
  const expectedDigest = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  assert.equal(
    createCarouselReplenishmentSignature({ body, secret, timestamp }),
    `v1=${expectedDigest}`,
  );
});

test("runs every signed replenishment page until the route completes the cycle", async () => {
  const calls: Array<{ body: string; headers: Headers; url: string }> = [];
  const loggerMessages: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = String(init?.body ?? "");
    const headers = new Headers(init?.headers);

    calls.push({
      body,
      headers,
      url: input.toString(),
    });

    const parsedBody = JSON.parse(body) as { cycleId: string; limit: number };
    const timestamp = headers.get(CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER) ?? "";
    const signature = headers.get(CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER);

    assert.equal(parsedBody.cycleId, cycleId);
    assert.equal(parsedBody.limit, 5);
    assert.equal(
      signature,
      createCarouselReplenishmentSignature({ body, secret, timestamp }),
    );

    if (calls.length === 1) {
      return jsonResponse({
        cycleId,
        cycleStatus: "active",
        hasMore: true,
        nextCursor: firstCursor,
        ok: true,
        pageCursor: null,
        processedCount: 1,
        results: [
          {
            ok: true,
            pendingSlotCount: 2,
            state: "preparing",
            userId: "user-1",
          },
        ],
      });
    }

    return jsonResponse({
      cycleId,
      cycleStatus: "completed",
      hasMore: false,
      nextCursor: null,
      ok: true,
      pageCursor: firstCursor,
      processedCount: 1,
      results: [
        {
          ok: false,
          error: "profile failed",
          userId: "user-2",
        },
      ],
    });
  };

  const summary = await runDailyCarouselReplenishmentSweep({
    env: {
      APP_BASE_URL: "https://www.getugcpilot.com",
      CAROUSEL_REPLENISHMENT_CYCLE_ID: cycleId,
      UGC_INTERNAL_CAROUSEL_SECRET: secret,
    },
    fetchImpl,
    logger: {
      error: (message) => loggerMessages.push(message),
      info: (message) => loggerMessages.push(message),
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0]?.url,
    "https://www.getugcpilot.com/api/internal/carousels/replenish",
  );
  assert.deepEqual(summary, {
    cycleId,
    failedCount: 1,
    pageCount: 2,
    processedCount: 2,
    requestedCycleId: cycleId,
  });
  assert.deepEqual(loggerMessages, [
    "Daily Carousel replenishment page completed",
    "Daily Carousel replenishment page completed",
    "Daily Carousel replenishment failed for profile",
    "Daily Carousel replenishment sweep completed",
  ]);
});

test("requires a high-entropy Carousel replenishment secret", () => {
  assert.throws(
    () =>
      getCarouselReplenishmentConfig({
        APP_BASE_URL: "https://www.getugcpilot.com",
        UGC_INTERNAL_CAROUSEL_SECRET: "short",
      }),
    /UGC_INTERNAL_CAROUSEL_SECRET/,
  );
});

test("rejects page responses that do not resume from the saved cursor", async () => {
  const fetchCalls: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = String(init?.body ?? "");

    if (JSON.parse(body).limit !== 5) {
      throw new Error("Unexpected request body.");
    }

    if (body.includes(cycleId) && fetchCalls.length === 0) {
      fetchCalls.push(body);

      return jsonResponse({
        cycleId,
        cycleStatus: "active",
        hasMore: true,
        nextCursor: firstCursor,
        ok: true,
        pageCursor: null,
        processedCount: 1,
        results: [
          {
            ok: true,
            pendingSlotCount: 0,
            state: "ready",
            userId: "user-1",
          },
        ],
      });
    }

    return jsonResponse({
      cycleId,
      cycleStatus: "completed",
      hasMore: false,
      nextCursor: null,
      ok: true,
      pageCursor: "00000000-0000-4000-8000-000000000002",
      processedCount: 0,
      results: [],
    });
  };
  await assert.rejects(
    runDailyCarouselReplenishmentSweep({
      env: {
        APP_BASE_URL: "https://www.getugcpilot.com",
        CAROUSEL_REPLENISHMENT_CYCLE_ID: cycleId,
        UGC_INTERNAL_CAROUSEL_SECRET: secret,
      },
      fetchImpl,
      logger: silentLogger,
    }),
    /did not resume from its saved cursor/,
  );
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

const silentLogger = {
  error: () => undefined,
  info: () => undefined,
};
