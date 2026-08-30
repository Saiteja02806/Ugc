import assert from "node:assert/strict";
import test from "node:test";

import {
  createHookVideoScheduleIdempotencyKey,
  getDefaultHookVideoScheduleTime,
} from "./hook-video-scheduling.ts";

const baseInput: Parameters<
  typeof createHookVideoScheduleIdempotencyKey
>[0] = {
  demoAssetId: "00000000-0000-4000-8000-000000000010",
  draftId: "00000000-0000-4000-8000-000000000011",
  influencerId: "catalog-ava",
  influencerVideoId: "catalog-ava-01",
  scheduledDate: "2026-07-20",
  scheduledTime: "14:30",
  selectedHookId: "00000000-0000-4000-8000-000000000012",
  sourceKind: "catalog" as const,
  targets: [
    {
      connectionId: "00000000-0000-4000-8000-000000000013",
      platform: "instagram" as const,
      settings: { shareToFeed: true },
    },
    {
      connectionId: "00000000-0000-4000-8000-000000000014",
      platform: "youtube" as const,
      settings: {
        notifySubscribers: false,
        privacyStatus: "private",
      },
    },
  ],
  timezone: "Asia/Calcutta",
  trimEnd: 3.5,
  trimStart: 0,
};

test("Hook schedule idempotency ignores target and setting key order", () => {
  const first = createHookVideoScheduleIdempotencyKey(baseInput);
  const reordered = createHookVideoScheduleIdempotencyKey({
    ...baseInput,
    targets: [
      {
        ...baseInput.targets[1],
        settings: {
          privacyStatus: "private",
          notifySubscribers: false,
        },
      },
      baseInput.targets[0],
    ],
  });

  assert.equal(first, reordered);
});

test("Hook schedule idempotency changes with publishing settings", () => {
  const first = createHookVideoScheduleIdempotencyKey(baseInput);
  const changed = createHookVideoScheduleIdempotencyKey({
    ...baseInput,
    targets: baseInput.targets.map((target) =>
      target.platform === "youtube"
        ? { ...target, settings: { privacyStatus: "public" } }
        : target,
    ),
  });

  assert.notEqual(first, changed);
});

test("Hook schedule idempotency changes with composition and timezone", () => {
  const first = createHookVideoScheduleIdempotencyKey(baseInput);

  assert.notEqual(
    first,
    createHookVideoScheduleIdempotencyKey({
      ...baseInput,
      selectedHookId: "00000000-0000-4000-8000-000000000099",
    }),
  );
  assert.notEqual(
    first,
    createHookVideoScheduleIdempotencyKey({
      ...baseInput,
      timezone: "UTC",
    }),
  );
});

test("Hook schedule idempotency changes with the requested publish time", () => {
  const first = createHookVideoScheduleIdempotencyKey(baseInput);

  assert.notEqual(
    first,
    createHookVideoScheduleIdempotencyKey({
      ...baseInput,
      scheduledDate: "2026-07-21",
    }),
  );
  assert.notEqual(
    first,
    createHookVideoScheduleIdempotencyKey({
      ...baseInput,
      scheduledTime: "15:00",
    }),
  );
});

test("the automatic Hook time is resolved from the current server minute", () => {
  assert.deepEqual(
    getDefaultHookVideoScheduleTime({
      minimumLeadMinutes: 5,
      now: Date.UTC(2026, 6, 20, 18, 29, 45),
      timeZone: "Asia/Calcutta",
    }),
    {
      scheduledDate: "2026-07-21",
      scheduledTime: "00:04",
    },
  );
});

test("the automatic Hook time rejects an invalid timezone", () => {
  assert.throws(
    () =>
      getDefaultHookVideoScheduleTime({
        minimumLeadMinutes: 5,
        now: Date.UTC(2026, 6, 20, 18, 29, 45),
        timeZone: "not-a-timezone",
      }),
    /Choose a valid timezone/,
  );
});
