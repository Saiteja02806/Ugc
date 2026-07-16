import assert from "node:assert/strict";
import test from "node:test";

import {
  getInstagramTargetPublishSettings,
  getTikTokTargetPublishSettings,
  getYouTubeTargetPublishSettings,
} from "./social-publish-settings.js";

test("reads saved account publishing settings", () => {
  assert.deepEqual(
    getInstagramTargetPublishSettings({ shareToFeed: false }),
    { shareToFeed: false },
  );
  assert.deepEqual(
    getTikTokTargetPublishSettings({
      allowComment: true,
      containsSyntheticMedia: false,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    }),
    {
      allowComment: true,
      allowDuet: undefined,
      allowStitch: undefined,
      brandOrganic: undefined,
      brandedContent: undefined,
      containsSyntheticMedia: false,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    },
  );
  assert.deepEqual(
    getYouTubeTargetPublishSettings({
      madeForKids: true,
      notifySubscribers: true,
      privacyStatus: "unlisted",
    }),
    {
      containsSyntheticMedia: undefined,
      madeForKids: true,
      notifySubscribers: true,
      privacyStatus: "unlisted",
    },
  );
});

test("rejects invalid persisted visibility values", () => {
  assert.throws(
    () => getTikTokTargetPublishSettings({ privacyLevel: "EVERYBODY" }),
    /invalid visibility/,
  );
  assert.throws(
    () => getYouTubeTargetPublishSettings({ privacyStatus: "friends" }),
    /invalid visibility/,
  );
});
