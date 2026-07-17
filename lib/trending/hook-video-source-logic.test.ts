import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserInfluencerId,
  createNonRepeatingHookVideoCycle,
  groupCatalogInfluencers,
  getHookVideoBrowseEntryKey,
  parseHookInfluencerId,
  shuffleHookVideoEntries,
} from "./hook-video-source-logic.ts";
import type { HookVideoBrowseEntry } from "./hook-video-types.ts";

test("groups catalog clips by the avatar metadata key", () => {
  const groups = groupCatalogInfluencers([
    {
      id: "clip-1",
      metadata: { avatar: "maya" },
      name: "Maya - Confident",
      thumbnail_url: "https://example.com/maya-1.webp",
    },
    {
      id: "clip-2",
      metadata: { avatar: "maya" },
      name: "Maya - Curious",
      thumbnail_url: "https://example.com/maya-2.webp",
    },
    {
      id: "clip-3",
      metadata: { avatar: "lewis" },
      name: "Lewis - Direct",
      thumbnail_url: null,
    },
  ]);

  assert.deepEqual(groups, [
    {
      id: "catalog:maya",
      name: "Maya",
      sourceKind: "catalog",
      thumbnailUrl: "https://example.com/maya-1.webp",
      videoCount: 2,
    },
    {
      id: "catalog:lewis",
      name: "Lewis",
      sourceKind: "catalog",
      thumbnailUrl: null,
      videoCount: 1,
    },
  ]);
});

test("parses catalog and user influencer identifiers without exposing media paths", () => {
  assert.deepEqual(parseHookInfluencerId("catalog:maya"), {
    key: "maya",
    sourceKind: "catalog",
  });
  assert.deepEqual(parseHookInfluencerId(buildUserInfluencerId("asset-123")), {
    assetId: "asset-123",
    sourceKind: "user",
  });
  assert.equal(parseHookInfluencerId("asset-123"), null);
});

test("shuffles every video exactly once without mutating the source list", () => {
  const source = ["video-1", "video-2", "video-3", "video-4"];
  const randomValues = [0.75, 0.1, 0.5];
  const shuffled = shuffleHookVideoEntries(
    source,
    () => randomValues.shift() ?? 0,
  );

  assert.notDeepEqual(shuffled, source);
  assert.deepEqual([...shuffled].sort(), [...source].sort());
  assert.equal(new Set(shuffled).size, source.length);
  assert.deepEqual(source, ["video-1", "video-2", "video-3", "video-4"]);
});

test("Surprise me excludes seen videos and resets only after exhaustion", () => {
  const entries = [
    buildBrowseEntry("video-1"),
    buildBrowseEntry("video-2"),
    buildBrowseEntry("video-3"),
  ];
  const partialCycle = createNonRepeatingHookVideoCycle(
    entries,
    new Set([getHookVideoBrowseEntryKey(entries[0])]),
    () => 0,
  );

  assert.equal(partialCycle.resetCycle, false);
  assert.deepEqual(
    partialCycle.entries.map((entry) => entry.video.id).sort(),
    ["video-2", "video-3"],
  );

  const resetCycle = createNonRepeatingHookVideoCycle(
    entries,
    new Set(entries.map(getHookVideoBrowseEntryKey)),
    () => 0,
  );

  assert.equal(resetCycle.resetCycle, true);
  assert.deepEqual(
    resetCycle.entries.map((entry) => entry.video.id).sort(),
    ["video-1", "video-2", "video-3"],
  );
});

function buildBrowseEntry(videoId: string): HookVideoBrowseEntry {
  return {
    influencer: {
      id: "catalog:maya",
      name: "Maya",
      sourceKind: "catalog",
      thumbnailUrl: null,
      videoCount: 3,
    },
    video: {
      durationSeconds: 8,
      id: videoId,
      influencerId: "catalog:maya",
      ratio: "9:16",
      sourceKind: "catalog",
      thumbnailUrl: null,
      title: videoId,
      trimEnd: 8,
      trimStart: 0,
    },
  };
}
