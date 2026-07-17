import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_JOB_REDELIVERY_INTERVAL_MS,
  shouldDeliverCarouselJobMessage,
} from "./background-job-delivery-logic.ts";

const NOW = Date.parse("2026-07-17T12:00:00.000Z");

function job(
  patch: Partial<Parameters<typeof shouldDeliverCarouselJobMessage>[0]["job"]> = {},
) {
  return {
    awsMessageId: "message-1",
    lastDeliveryAt: null,
    lastHeartbeatAt: null,
    lockedAt: null,
    status: "queued" as const,
    updatedAt: new Date(NOW).toISOString(),
    ...patch,
  };
}

test("delivers a newly persisted queued job without an SQS message", () => {
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({ awsMessageId: null }),
      now: NOW,
      wasJustCreated: true,
    }),
    true,
  );
});

test("a concurrent observer leaves a fresh creator-owned delivery alone", () => {
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({ awsMessageId: null }),
      now: NOW,
      wasJustCreated: false,
    }),
    false,
  );
});

test("redelivers queued jobs only at the stale boundary", () => {
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({
        lastDeliveryAt: new Date(
          NOW - CAROUSEL_JOB_REDELIVERY_INTERVAL_MS + 1,
        ).toISOString(),
      }),
      now: NOW,
    }),
    false,
  );
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({
        lastDeliveryAt: new Date(
          NOW - CAROUSEL_JOB_REDELIVERY_INTERVAL_MS,
        ).toISOString(),
      }),
      now: NOW,
    }),
    true,
  );
});

test("redelivers a stale worker claim but never terminal jobs", () => {
  const staleHeartbeat = new Date(
    NOW - CAROUSEL_JOB_REDELIVERY_INTERVAL_MS,
  ).toISOString();

  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({
        lastDeliveryAt: staleHeartbeat,
        lastHeartbeatAt: staleHeartbeat,
        status: "processing",
      }),
      now: NOW,
    }),
    true,
  );
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({ status: "completed" }),
      now: NOW,
    }),
    false,
  );
  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({ status: "failed" }),
      now: NOW,
    }),
    false,
  );
});

test("does not redeliver a stale worker claim again during the delivery lease", () => {
  const staleHeartbeat = new Date(
    NOW - CAROUSEL_JOB_REDELIVERY_INTERVAL_MS,
  ).toISOString();

  assert.equal(
    shouldDeliverCarouselJobMessage({
      job: job({
        lastDeliveryAt: new Date(NOW - 1_000).toISOString(),
        lastHeartbeatAt: staleHeartbeat,
        status: "processing",
      }),
      now: NOW,
    }),
    false,
  );
});
