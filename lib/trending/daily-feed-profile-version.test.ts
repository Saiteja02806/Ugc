import assert from "node:assert/strict";
import test from "node:test";

import {
  getProfilePinnedToDailyFeed,
  isDailyFeedPinnedToHistoricalProfile,
} from "./daily-feed-profile-version.ts";

test("a current daily pack is pinned to its saved profile version after activation", () => {
  const activeProfile = { id: "profile-1", profileVersion: 13, context: "v13" };
  const feed = { businessProfileId: "profile-1", businessProfileVersion: 12 };

  assert.equal(isDailyFeedPinnedToHistoricalProfile(feed, activeProfile), true);
  assert.deepEqual(getProfilePinnedToDailyFeed(activeProfile, feed), {
    id: "profile-1",
    profileVersion: 12,
    context: "v13",
  });
});

test("a matching daily pack keeps the active profile intact", () => {
  const activeProfile = { id: "profile-1", profileVersion: 13 };
  const feed = { businessProfileId: "profile-1", businessProfileVersion: 13 };

  assert.equal(isDailyFeedPinnedToHistoricalProfile(feed, activeProfile), false);
  assert.strictEqual(getProfilePinnedToDailyFeed(activeProfile, feed), activeProfile);
});
