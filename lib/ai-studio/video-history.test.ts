import assert from "node:assert/strict";
import test from "node:test";

import type { AIStudioVideoResult } from "./media-results.ts";
import {
  filterAIStudioVideoHistory,
  getTodayAIStudioVideos,
  groupAIStudioVideoHistory,
} from "./video-history.ts";

const videos: AIStudioVideoResult[] = [
  {
    createdAt: "2026-09-29T06:30:00.000Z",
    durationSeconds: 5,
    id: "today",
    mediaAssetId: "today",
    modelLabel: "Seedance 2.5",
    prompt: "Create a vertical product launch",
    ratio: "9:16",
    resolution: "720p",
    status: "Ready",
    thumbnailUrl: null,
    title: "Generated video",
    url: "https://cdn.example.com/today.mp4",
  },
  {
    createdAt: "2026-09-28T06:30:00.000Z",
    durationSeconds: 5,
    id: "yesterday",
    mediaAssetId: "yesterday",
    modelLabel: "Google Omni",
    prompt: "Show a founder in an office",
    ratio: "9:16",
    resolution: "1080p",
    status: "Ready",
    thumbnailUrl: null,
    title: "Generated video",
    url: "https://cdn.example.com/yesterday.mp4",
  },
];

test("filters AI Studio video history by prompt and generation settings", () => {
  assert.deepEqual(
    filterAIStudioVideoHistory(videos, "omni").map((video) => video.id),
    ["yesterday"],
  );
  assert.deepEqual(
    filterAIStudioVideoHistory(videos, "product").map((video) => video.id),
    ["today"],
  );
});

test("starts a fresh feed at the user's local midnight without deleting history", () => {
  const beforeMidnight = new Date(2026, 8, 29, 23, 59, 59);
  const afterMidnight = new Date(2026, 8, 30, 0, 0, 1);
  const localVideos = [
    { ...videos[0], id: "previous", createdAt: beforeMidnight.toISOString() },
    { ...videos[1], id: "new", createdAt: afterMidnight.toISOString() },
    { ...videos[0], id: "invalid", createdAt: "invalid" },
  ];
  assert.deepEqual(getTodayAIStudioVideos(localVideos, beforeMidnight).map((video) => video.id), ["previous"]);
  assert.deepEqual(getTodayAIStudioVideos(localVideos, afterMidnight).map((video) => video.id), ["new"]);
  assert.equal(filterAIStudioVideoHistory(localVideos, "").length, 3);
});

test("groups AI Studio video history into human-readable dates", () => {
  assert.deepEqual(
    groupAIStudioVideoHistory(videos, new Date("2026-09-29T12:00:00.000Z")).map(
      (group) => [group.label, group.videos.map((video) => video.id)],
    ),
    [
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
    ],
  );
});
