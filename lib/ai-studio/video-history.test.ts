import assert from "node:assert/strict";
import test from "node:test";

import type { AIStudioVideoResult } from "./media-results.ts";
import {
  filterAIStudioVideoHistory,
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
