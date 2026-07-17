import { logger, schedules } from "@trigger.dev/sdk";

import {
  getNextReplenishmentCursor,
  parseReplenishmentPageResponse,
} from "@/lib/trending/replenishment-page-logic";
import {
  CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER,
  CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER,
  createCarouselReplenishmentSignature,
  getCarouselReplenishmentTriggerSecret,
} from "@/lib/trending/replenishment-signature";

const PAGE_SIZE = 5;
const PAGE_REQUEST_TIMEOUT_MS = 50_000;

export const replenishDailyCarouselsTask = schedules.task({
  id: "replenish-daily-carousels",
  cron: {
    environments: ["PRODUCTION"],
    pattern: "*/15 * * * *",
  },
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload) => {
    const requestedCycleId = payload.timestamp.toISOString();
    let activeCycleId: string | null = null;
    let expectedPageCursor: string | null | undefined;
    let failedCount = 0;
    let pageCount = 0;
    let processedCount = 0;

    while (true) {
      const data = await requestReplenishmentPage(requestedCycleId);

      if (activeCycleId && data.cycleId !== activeCycleId) {
        throw new Error(
          "Daily Carousel replenishment changed cycles before completion.",
        );
      }

      if (
        expectedPageCursor !== undefined &&
        data.pageCursor?.toLowerCase() !== expectedPageCursor?.toLowerCase()
      ) {
        throw new Error(
          "Daily Carousel replenishment did not resume from its saved cursor.",
        );
      }

      activeCycleId = data.cycleId;
      const nextCursor = getNextReplenishmentCursor({
        currentCursor: data.pageCursor,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        processedCount: data.processedCount,
      });
      const failedResults = data.results.filter((result) => !result.ok);

      pageCount += 1;
      processedCount += data.processedCount;
      failedCount += failedResults.length;

      logger.info("Daily Carousel replenishment page completed", {
        cycleId: data.cycleId,
        failedCount: failedResults.length,
        nextCursor,
        pageCursor: data.pageCursor,
        processedCount: data.processedCount,
        requestedCycleId,
      });

      for (const result of failedResults) {
        logger.error("Daily Carousel replenishment failed for profile", {
          cycleId: data.cycleId,
          error: result.error,
          userId: result.userId,
        });
      }

      if (!nextCursor) {
        break;
      }

      expectedPageCursor = nextCursor;
    }

    logger.info("Daily Carousel replenishment sweep completed", {
      cycleId: activeCycleId ?? requestedCycleId,
      failedCount,
      pageCount,
      processedCount,
      requestedCycleId,
    });

    return {
      cycleId: activeCycleId ?? requestedCycleId,
      failedCount,
      pageCount,
      processedCount,
      requestedCycleId,
    };
  },
});

async function requestReplenishmentPage(requestedCycleId: string) {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() || "https://www.getugcpilot.com";
  const secret = getCarouselReplenishmentTriggerSecret();

  if (!secret) {
    throw new Error(
      "Set UGC_INTERNAL_CAROUSEL_SECRET to at least 32 random bytes.",
    );
  }

  const body = JSON.stringify({
    cycleId: requestedCycleId,
    limit: PAGE_SIZE,
  });
  const timestamp = Date.now().toString();
  const signature = createCarouselReplenishmentSignature({
    body,
    secret,
    timestamp,
  });
  const response = await fetch(
    new URL("/api/internal/carousels/replenish", baseUrl),
    {
      body,
      headers: {
        "Content-Type": "application/json",
        [CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER]: signature,
        [CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER]: timestamp,
      },
      method: "POST",
      signal: AbortSignal.timeout(PAGE_REQUEST_TIMEOUT_MS),
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Daily Carousel replenishment endpoint returned ${response.status}.`,
    );
  }

  return parseReplenishmentPageResponse(data);
}
