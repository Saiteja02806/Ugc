import assert from "node:assert/strict";
import test from "node:test";

import {
  HookVideoDraftRequestSchema,
  HookVideoScheduleRequestSchema,
  validateHookTrimBounds,
} from "./hook-video-validation.ts";

const validDraft = {
  demoAssetId: "713270df-a365-4f49-8ad8-ec76afdb8f56",
  influencerId: "catalog:maya",
  influencerVideoId: "51062d95-dd6d-4a41-baa6-eecc339e5e40",
  selectedHookId: "b8e1819c-1ac1-4db4-a708-4508dc04c7e4",
  sourceKind: "catalog",
  trimEnd: 4.5,
  trimStart: 0.5,
};

test("accepts a complete Hook video draft selection", () => {
  assert.equal(HookVideoDraftRequestSchema.safeParse(validDraft).success, true);
});

test("rejects reversed trim values and unexpected fields", () => {
  assert.equal(
    HookVideoDraftRequestSchema.safeParse({
      ...validDraft,
      trimEnd: 1,
      trimStart: 2,
    }).success,
    false,
  );
  assert.equal(
    HookVideoDraftRequestSchema.safeParse({ ...validDraft, sourceUrl: "s3://x" })
      .success,
    false,
  );
});

test("validates trim bounds against the source duration", () => {
  assert.equal(
    validateHookTrimBounds({
      durationSeconds: 6,
      trimEnd: 5.5,
      trimStart: 1,
    }),
    true,
  );
  assert.equal(
    validateHookTrimBounds({
      durationSeconds: 6,
      trimEnd: 7,
      trimStart: 1,
    }),
    false,
  );
});

test("requires exact connected accounts and time for Hook scheduling", () => {
  const target = {
    connectionId: "69b7e978-3311-45aa-a30c-91ba3b5f412c",
    platform: "youtube",
    settings: { privacyStatus: "private" },
  };
  const schedule = {
    ...validDraft,
    scheduledDate: "2026-07-20",
    scheduledTime: "14:30",
    targets: [target],
    timezone: "Asia/Calcutta",
  };

  assert.equal(HookVideoScheduleRequestSchema.safeParse(schedule).success, true);
  assert.equal(
    HookVideoScheduleRequestSchema.safeParse({ ...schedule, targets: [] }).success,
    false,
  );
  assert.equal(
    HookVideoScheduleRequestSchema.safeParse({
      ...schedule,
      targets: [target, target],
    }).success,
    false,
  );
});
