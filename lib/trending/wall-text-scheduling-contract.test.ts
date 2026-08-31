import assert from "node:assert/strict";
import test from "node:test";

import {
  createWallTextScheduleRequest,
  WallTextScheduleRequestSchema,
} from "./wall-text-scheduling-contract.ts";

const validRequest = {
  assignmentId: "00000000-0000-4000-8000-000000000001",
  scheduledDate: "2026-08-31",
  scheduledTime: "18:30",
  targets: [
    {
      connectionId: "00000000-0000-4000-8000-000000000002",
      platform: "instagram" as const,
      settings: { shareToFeed: true },
    },
  ],
  timezone: "Asia/Calcutta",
  useDefaultScheduleTime: false,
};

test("Wall schedule client sends exactly the strict API contract", () => {
  const selectionWithUiTitle = {
    ...validRequest,
    // A title can exist in the UI, but is intentionally absent from the
    // client-to-server schedule payload because the server derives it.
    title: "UI-only title",
  };
  const request = createWallTextScheduleRequest(selectionWithUiTitle);

  assert.deepEqual(Object.keys(request).sort(), [
    "assignmentId",
    "scheduledDate",
    "scheduledTime",
    "targets",
    "timezone",
    "useDefaultScheduleTime",
  ]);
  assert.deepEqual(WallTextScheduleRequestSchema.parse(request), request);
});

test("Wall schedule API rejects extra fields and missing selected accounts", () => {
  assert.equal(
    WallTextScheduleRequestSchema.safeParse({
      ...validRequest,
      title: "This must not be sent",
    }).success,
    false,
  );
  assert.equal(
    WallTextScheduleRequestSchema.safeParse({
      ...validRequest,
      targets: [],
    }).success,
    false,
  );
});
