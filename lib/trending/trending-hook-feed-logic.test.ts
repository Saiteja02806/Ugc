import assert from "node:assert/strict";
import test from "node:test";

import { selectTrendingHookCandidates } from "./trending-hook-feed-logic.ts";
import type { HookVideoBrowseEntry } from "./hook-video-types.ts";

function createEntry(params: {
  durationSeconds: number | null;
  id: string;
  ratio?: "4:5" | "9:16";
  trimEnd?: number | null;
  trimStart?: number;
}): HookVideoBrowseEntry {
  return {
    influencer: {
      id: "catalog:maya",
      name: "Maya",
      sourceKind: "catalog",
      thumbnailUrl: null,
      videoCount: 1,
    },
    video: {
      durationSeconds: params.durationSeconds,
      id: params.id,
      influencerId: "catalog:maya",
      ratio: params.ratio ?? "9:16",
      sourceKind: "catalog",
      thumbnailUrl: null,
      title: params.id,
      trimEnd: params.trimEnd ?? null,
      trimStart: params.trimStart ?? 0,
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
