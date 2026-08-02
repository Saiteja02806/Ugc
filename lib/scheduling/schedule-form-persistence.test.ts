import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialScheduleConnectionIds,
  getSocialConnectionAccountLabel,
  getUnavailableSavedInstagramTargets,
} from "./schedule-form-persistence.ts";

const instagramConnection = {
  id: "instagram-current",
  platform: "instagram",
  status: "connected",
} as const;

test("does not replace an unavailable saved account with another connection", () => {
  assert.deepEqual(
    getInitialScheduleConnectionIds({
      connections: [instagramConnection],
      isCarouselSchedule: false,
      plannedPlatforms: ["instagram"],
      plannedTargets: [
        { connectionId: "instagram-missing", platform: "instagram" },
      ],
    }),
    [],
  );
});

test("restores an available saved account", () => {
  assert.deepEqual(
    getInitialScheduleConnectionIds({
      connections: [instagramConnection],
      isCarouselSchedule: false,
      plannedPlatforms: ["instagram"],
      plannedTargets: [
        { connectionId: instagramConnection.id, platform: "instagram" },
      ],
    }),
    [instagramConnection.id],
  );
});

test("detects unavailable saved Instagram and legacy untyped targets", () => {
  assert.deepEqual(
    getUnavailableSavedInstagramTargets({
      connections: [instagramConnection],
      plannedTargets: [
        { connectionId: "instagram-missing", platform: "instagram" },
        { connectionId: "legacy-missing" },
        { connectionId: "youtube-missing", platform: "youtube" },
      ],
    }).map((target) => target.connectionId),
    ["instagram-missing", "legacy-missing"],
  );
});

test("treats a revoked saved Instagram connection as unavailable", () => {
  assert.deepEqual(
    getUnavailableSavedInstagramTargets({
      connections: [
        {
          id: "instagram-revoked",
          platform: "instagram",
          status: "revoked",
        },
      ],
      plannedTargets: [
        { connectionId: "instagram-revoked", platform: "instagram" },
      ],
    }).map((target) => target.connectionId),
    ["instagram-revoked"],
  );
});

test("does not misclassify an untyped saved TikTok target as Instagram", () => {
  assert.deepEqual(
    getUnavailableSavedInstagramTargets({
      connections: [
        { id: "tiktok-current", platform: "tiktok", status: "connected" },
      ],
      plannedTargets: [{ connectionId: "tiktok-current" }],
    }),
    [],
  );
});

test("formats a persisted account username and falls back to its name", () => {
  assert.equal(
    getSocialConnectionAccountLabel({
      platformAccountId: "17841400000000000",
      platformAccountName: "UGC Pilot",
      platformAccountUsername: "ugcpilot",
    }),
    "@ugcpilot",
  );
  assert.equal(
    getSocialConnectionAccountLabel({
      platformAccountId: "17841400000000000",
      platformAccountName: "UGC Pilot",
      platformAccountUsername: null,
    }),
    "UGC Pilot",
  );
});
