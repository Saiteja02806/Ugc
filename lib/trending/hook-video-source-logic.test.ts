import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserInfluencerId,
  groupCatalogInfluencers,
  parseHookInfluencerId,
} from "./hook-video-source-logic.ts";

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
