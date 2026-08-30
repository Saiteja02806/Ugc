import assert from "node:assert/strict";
import test from "node:test";

import {
  selectFreshThenRecycledTrendingHookCandidates,
  selectTrendingHookCandidates,
} from "./trending-hook-feed-logic.ts";
import type { HookVideoBrowseEntry } from "./hook-video-types.ts";

function createEntry(params: {
  durationSeconds: number | null;
  id: string;
  influencerKey?: string;
  ratio?: "4:5" | "9:16";
  reactionType?: string | null;
  trimEnd?: number | null;
  trimStart?: number;
  visualGroup?: string;
}): HookVideoBrowseEntry {
  const influencerKey = params.influencerKey ?? "maya";

  return {
    influencer: {
      id: `catalog:${influencerKey}`,
      name: influencerKey,
      sourceKind: "catalog",
      thumbnailUrl: null,
      videoCount: 1,
    },
    video: {
      durationSeconds: params.durationSeconds,
      hookTextPlacement: null,
      id: params.id,
      influencerId: `catalog:${influencerKey}`,
      influencerKey,
      ratio: params.ratio ?? "9:16",
      reactionType:
        params.reactionType === undefined
          ? "focused_attention"
          : params.reactionType,
      sourceKind: "catalog",
      thumbnailUrl: null,
      title: params.id,
      trimEnd: params.trimEnd ?? null,
      trimStart: params.trimStart ?? 0,
      visualGroup: params.visualGroup ?? "indoor_selfie_closeup",
    },
  };
}

test("selects vertical Hook sources and preserves their variable durations", () => {
  const candidates = selectTrendingHookCandidates([
    createEntry({ durationSeconds: 3, id: "three-seconds" }),
    createEntry({ durationSeconds: 4, id: "four-seconds" }),
    createEntry({ durationSeconds: 5, id: "five-seconds" }),
  ]);

  assert.deepEqual(
    candidates.map(({ durationSeconds, entry }) => ({
      durationSeconds,
      id: entry.video.id,
    })),
    [
      { durationSeconds: 3, id: "three-seconds" },
      { durationSeconds: 4, id: "four-seconds" },
      { durationSeconds: 5, id: "five-seconds" },
    ],
  );
});

test("uses the actual trimmed duration and ignores unsuitable sources", () => {
  const candidates = selectTrendingHookCandidates([
    createEntry({
      durationSeconds: 8,
      id: "trimmed",
      trimEnd: 5.5,
      trimStart: 1.5,
    }),
    createEntry({ durationSeconds: 4, id: "landscape", ratio: "4:5" }),
    createEntry({ durationSeconds: null, id: "unknown-duration" }),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.durationSeconds, 4);
  assert.equal(candidates[0]?.sourceDurationSeconds, 8);
});

test("queues a technically valid Trending source even without a catalog reaction", () => {
  const candidates = selectTrendingHookCandidates([
    createEntry({ durationSeconds: 4, id: "reviewed" }),
    createEntry({
      durationSeconds: 4,
      id: "unreviewed",
      reactionType: "unreviewed",
    }),
    createEntry({
      durationSeconds: 4,
      id: "user-upload",
      reactionType: null,
    }),
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.entry.video.id),
    ["reviewed", "unreviewed", "user-upload"],
  );
});

test("queues every technically valid Hook source for every business", () => {
  const candidates = selectTrendingHookCandidates([
    createEntry({
      durationSeconds: 4,
      id: "amusement",
      reactionType: "amusement_laughter",
    }),
    createEntry({
      durationSeconds: 4,
      id: "reveal",
      reactionType: "secret_reveal",
    }),
    createEntry({
      durationSeconds: 4,
      id: "concern",
      reactionType: "concern_anxiety",
    }),
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.entry.video.id),
    ["amusement", "reveal", "concern"],
  );
});

test("uses fresh Hook videos first, then fills the request with recycled videos", () => {
  const candidates = selectFreshThenRecycledTrendingHookCandidates({
    inventory: [
      createEntry({ durationSeconds: 4, id: "old-1", influencerKey: "old-1" }),
      createEntry({ durationSeconds: 4, id: "old-2", influencerKey: "old-2" }),
      createEntry({ durationSeconds: 4, id: "old-3", influencerKey: "old-3" }),
      createEntry({ durationSeconds: 4, id: "new-1", influencerKey: "new-1" }),
      createEntry({ durationSeconds: 4, id: "new-2", influencerKey: "new-2" }),
      createEntry({ durationSeconds: 4, id: "new-3", influencerKey: "new-3" }),
    ],
    requestedCount: 5,
    usedVideoIds: new Set(["old-1", "old-2", "old-3"]),
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.entry.video.id),
    ["new-1", "new-2", "new-3", "old-1", "old-2"],
  );
});

test("prefers different influencers, reactions, and visual groups", () => {
  const candidates = selectTrendingHookCandidates([
    createEntry({
      durationSeconds: 4,
      id: "maya-shock-1",
      influencerKey: "maya",
      reactionType: "shock_surprise",
      visualGroup: "indoor_selfie_closeup",
    }),
    createEntry({
      durationSeconds: 4,
      id: "maya-shock-2",
      influencerKey: "maya",
      reactionType: "shock_surprise",
      visualGroup: "indoor_selfie_closeup",
    }),
    createEntry({
      durationSeconds: 4,
      id: "amara-curious",
      influencerKey: "amara",
      reactionType: "curiosity_discovery",
      visualGroup: "sofa_reaction",
    }),
    createEntry({
      durationSeconds: 4,
      id: "talia-concern",
      influencerKey: "talia",
      reactionType: "concern_anxiety",
      visualGroup: "office_selfie",
    }),
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.entry.video.id),
    [
      "maya-shock-1",
      "amara-curious",
      "talia-concern",
      "maya-shock-2",
    ],
  );
});
