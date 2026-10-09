import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAIStudioImageHistory,
  getImageHistoryDateLabel,
  getTodayAIStudioImages,
  groupAIStudioImageHistory,
} from "./image-history.ts";
import type { AIStudioImageResult } from "./media-results.ts";

const now = new Date(2026, 9, 1, 12);
function image(id: string, day: Date, title = "Generated image"): AIStudioImageResult {
  return { id, createdAt: day.toISOString(), title, aspectRatio: "9:16", url: `https://example.com/${id}.png` };
}

test("the workspace shows only today's images, using local calendar days", () => {
  const images = [
    image("midnight", new Date(2026, 9, 1, 0)),
    image("later", new Date(2026, 9, 1, 23, 59)),
    image("previous", new Date(2026, 8, 30, 23, 59)),
  ];
  assert.deepEqual(getTodayAIStudioImages(images, now).map(({ id }) => id), ["midnight", "later"]);
  assert.equal(images.length, 3, "older saved images are preserved");
  assert.deepEqual(getTodayAIStudioImages(images, new Date(2026, 9, 2)).map(({ id }) => id), []);
});

test("history groups all returned images by the same dates as video history", () => {
  const images = [
    image("today", now),
    image("yesterday", new Date(2026, 8, 30)),
    image("week", new Date(2026, 8, 26)),
    image("old", new Date(2026, 8, 10)),
    image("older", new Date(2025, 8, 10)),
  ];
  const groups = groupAIStudioImageHistory(images, now);
  assert.deepEqual(groups.map(({ label }) => label), ["Today", "Yesterday", "Last week", "Sep 10", "Sep 10, 2025"]);
  assert.deepEqual(groups.flatMap(({ images }) => images.map(({ id }) => id)), images.map(({ id }) => id));
});

test("history searches image titles and ratios case insensitively", () => {
  const images = [image("orange", now, "Orange product shot"), { ...image("banner", now, "Wide banner"), aspectRatio: "16:9" as const }];
  assert.deepEqual(filterAIStudioImageHistory(images, " ORANGE ").map(({ id }) => id), ["orange"]);
  assert.deepEqual(filterAIStudioImageHistory(images, "16:9").map(({ id }) => id), ["banner"]);
  assert.deepEqual(filterAIStudioImageHistory(images, "no match"), []);
  assert.deepEqual(filterAIStudioImageHistory(images, " "), images);
});

test("missing dates remain reachable in history without entering today's workspace", () => {
  const invalid = { ...image("invalid", now), createdAt: "invalid" };
  assert.equal(getImageHistoryDateLabel(invalid.createdAt, now), "Earlier");
  assert.deepEqual(getTodayAIStudioImages([invalid], now), []);
  assert.deepEqual(groupAIStudioImageHistory([invalid], now), [{ label: "Earlier", images: [invalid] }]);
});
