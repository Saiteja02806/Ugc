import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  normalizeScheduleTargetSettings,
  SchedulePlatformSettingsError,
} from "./platform-settings.ts";

test("provides shared defaults for every scheduling surface", () => {
  assert.deepEqual(getDefaultScheduleTargetSettings("instagram"), {
    shareToFeed: true,
  });
  assert.deepEqual(getDefaultScheduleTargetSettings("tiktok"), {
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    brandOrganic: false,
    brandedContent: false,
    commercialContentDisclosureEnabled: false,
    containsSyntheticMedia: true,
    musicUsageConfirmed: false,
    privacyLevel: "",
  });
  assert.deepEqual(getDefaultScheduleTargetSettings("youtube"), {
    containsSyntheticMedia: true,
    madeForKids: false,
    notifySubscribers: false,
    privacyStatus: "private",
  });
});

test("validates TikTok capability selection for every scheduling surface", () => {
  const connection = { id: "tiktok-1", platform: "tiktok" as const };

  assert.equal(
    getScheduleTargetSettingsError({
      connections: [connection],
      settings: {},
      tiktokCapabilities: { "tiktok-1": { status: "loading" } },
    }),
    "Wait for TikTok publishing settings to finish loading.",
  );
  assert.equal(
    getScheduleTargetSettingsError({
      connections: [connection],
      settings: {
        "tiktok-1": {
          musicUsageConfirmed: true,
          privacyLevel: "PUBLIC_TO_EVERYONE",
        },
      },
      tiktokCapabilities: {
        "tiktok-1": {
          capabilities: {
            creatorNickname: "Creator",
            creatorUsername: "creator",
            directPostAudited: true,
            interactions: {
              commentsDisabled: false,
              duetsDisabled: false,
              stitchesDisabled: false,
            },
            maxVideoDurationSeconds: 600,
            privacyLevels: ["PUBLIC_TO_EVERYONE"],
          },
          status: "ready",
        },
      },
    }),
    null,
  );
});

test("keeps public TikTok visibility unavailable while Direct Post is unaudited", () => {
  const error = getScheduleTargetSettingsError({
    connections: [{ id: "tiktok-1", platform: "tiktok" }],
    settings: {
      "tiktok-1": {
        musicUsageConfirmed: true,
        privacyLevel: "PUBLIC_TO_EVERYONE",
      },
    },
    tiktokCapabilities: {
      "tiktok-1": {
        capabilities: {
          creatorNickname: "Creator",
          creatorUsername: "creator",
          directPostAudited: false,
          interactions: {
            commentsDisabled: false,
            duetsDisabled: false,
            stitchesDisabled: false,
          },
          maxVideoDurationSeconds: 600,
          privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
        },
        status: "ready",
      },
    },
  });

  assert.ok(error);
  assert.match(error, /TikTok Direct Post audit/);
});

test("normalizes Instagram publishing settings", () => {
  assert.deepEqual(normalizeScheduleTargetSettings("instagram", {}), {
    shareToFeed: true,
  });
  assert.deepEqual(
    normalizeScheduleTargetSettings("instagram", { shareToFeed: false }),
    { shareToFeed: false },
  );
});

test("requires an explicit supported TikTok visibility", () => {
  assert.throws(
    () => normalizeScheduleTargetSettings("tiktok", {}),
    (error) =>
      error instanceof SchedulePlatformSettingsError &&
      error.message === "Choose who can view the TikTok post.",
  );
  assert.throws(
    () =>
      normalizeScheduleTargetSettings("tiktok", {
        privacyLevel: "UNKNOWN",
      }),
    SchedulePlatformSettingsError,
  );
});

test("normalizes TikTok interaction and disclosure settings", () => {
  assert.deepEqual(
    normalizeScheduleTargetSettings("tiktok", {
      allowComment: true,
      allowDuet: true,
      allowStitch: false,
      brandOrganic: true,
      brandedContent: false,
      containsSyntheticMedia: false,
      musicUsageConfirmed: true,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    }),
    {
      allowComment: true,
      allowDuet: true,
      allowStitch: false,
      brandOrganic: true,
      brandedContent: false,
      containsSyntheticMedia: false,
      musicUsageConfirmed: true,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    },
  );
});

test("rejects private TikTok paid partnerships", () => {
  assert.throws(
    () =>
      normalizeScheduleTargetSettings("tiktok", {
        brandedContent: true,
        musicUsageConfirmed: true,
        privacyLevel: "SELF_ONLY",
      }),
    (error) =>
      error instanceof SchedulePlatformSettingsError &&
      error.message.includes("paid partnerships"),
  );
});

test("requires explicit TikTok Music Usage Confirmation", () => {
  assert.throws(
    () =>
      normalizeScheduleTargetSettings("tiktok", {
        privacyLevel: "PUBLIC_TO_EVERYONE",
      }),
    (error) =>
      error instanceof SchedulePlatformSettingsError &&
      error.message.includes("Music Usage Confirmation"),
  );
});

test("requires manual music confirmation before scheduling", () => {
  const connection = { id: "tiktok-1", platform: "tiktok" as const };
  const capabilities = {
    capabilities: {
      creatorNickname: "Creator", creatorUsername: "creator", directPostAudited: true,
      interactions: { commentsDisabled: false, duetsDisabled: false, stitchesDisabled: false },
      maxVideoDurationSeconds: 600, privacyLevels: ["PUBLIC_TO_EVERYONE" as const],
    }, status: "ready" as const,
  };
  assert.equal(
    getScheduleTargetSettingsError({
      connections: [connection],
      settings: { "tiktok-1": { privacyLevel: "PUBLIC_TO_EVERYONE" } },
      tiktokCapabilities: { "tiktok-1": capabilities },
    }),
    "Confirm TikTok's Music Usage Confirmation before scheduling.",
  );
  assert.equal(
    getScheduleTargetSettingsError({
      connections: [connection],
      settings: {
        "tiktok-1": {
          commercialContentDisclosureEnabled: true,
          musicUsageConfirmed: true,
          privacyLevel: "PUBLIC_TO_EVERYONE",
        },
      },
      tiktokCapabilities: { "tiktok-1": capabilities },
    }),
    "Choose Your brand or Branded content before scheduling.",
  );
});

test("normalizes YouTube visibility and audience settings", () => {
  assert.deepEqual(normalizeScheduleTargetSettings("youtube", {}), {
    containsSyntheticMedia: true,
    madeForKids: false,
    notifySubscribers: false,
    privacyStatus: "private",
  });
  assert.deepEqual(
    normalizeScheduleTargetSettings("youtube", {
      containsSyntheticMedia: false,
      madeForKids: true,
      notifySubscribers: true,
      privacyStatus: "unlisted",
    }),
    {
      containsSyntheticMedia: false,
      madeForKids: true,
      notifySubscribers: true,
      privacyStatus: "unlisted",
    },
  );
});
