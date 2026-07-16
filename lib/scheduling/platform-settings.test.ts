import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeScheduleTargetSettings,
  SchedulePlatformSettingsError,
} from "./platform-settings.ts";

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
      privacyLevel: "PUBLIC_TO_EVERYONE",
    }),
    {
      allowComment: true,
      allowDuet: true,
      allowStitch: false,
      brandOrganic: true,
      brandedContent: false,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    },
  );
});

test("rejects private TikTok paid partnerships", () => {
  assert.throws(
    () =>
      normalizeScheduleTargetSettings("tiktok", {
        brandedContent: true,
        privacyLevel: "SELF_ONLY",
      }),
    (error) =>
      error instanceof SchedulePlatformSettingsError &&
      error.message.includes("paid partnerships"),
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
