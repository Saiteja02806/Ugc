import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const unifiedFeed = readFileSync("lib/trending/unified-daily-feed.ts", "utf8");

test("a historical daily pack is read at its stored version and is never prepared at the new version", () => {
  assert.match(
    unifiedFeed,
    /const feedProfile = getProfilePinnedToDailyFeed\([\s\S]*existingPlan\.feed/,
  );
  assert.match(unifiedFeed, /readTrendingDailyFeed\(\{[\s\S]*profile: feedProfile/);
  assert.match(unifiedFeed, /getTrendingHookFeedProvider\(feedProfile/);
  assert.match(unifiedFeed, /getTrendingWallTextFeedProvider\(feedProfile/);
  assert.match(
    unifiedFeed,
    /existingPlan &&[\s\S]*isDailyFeedPinnedToHistoricalProfile\([\s\S]*return readUnifiedTrendingDailyFeed\(params\)/,
  );
});
