import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAIStudioImageHistory,
  getImageHistoryDateLabel,
  getVisibleAIStudioImages,
  groupAIStudioImageHistory,
  isImageCompletionForeground,
  mergeAIStudioImageHistory,
} from "./image-history.ts";
import type { AIStudioImageResult } from "./media-results.ts";

const now = new Date(2026, 9, 1, 22);
const images: AIStudioImageResult[] = [
  image("older", "Orange product", new Date(2026, 8, 28, 14).toISOString(), "1:1"),
  image("today-1", "Portrait in a studio", new Date(2026, 9, 1, 20).toISOString(), "9:16"),
  image("yesterday", "Landscape at sunset", new Date(2026, 8, 30, 16).toISOString(), "16:9"),
  image("today-2", "Second portrait", new Date(2026, 9, 1, 21).toISOString(), "9:16"),
];

test("the main canvas starts empty and shows only the current session", () => {
  assert.deepEqual(getVisibleAIStudioImages(images, [], null), []);
  assert.deepEqual(
    getVisibleAIStudioImages(images, ["today-1", "today-2"], null).map(({ id }) => id),
    ["today-1", "today-2"],
  );
  assert.equal(images.length, 4, "hiding history must not remove saved images");
});

test("a selected history image temporarily replaces the session without duplicating results", () => {
  assert.deepEqual(
    getVisibleAIStudioImages(images, ["today-1", "today-2"], "older").map(({ id }) => id),
    ["older"],
  );
  assert.deepEqual(getVisibleAIStudioImages(images, ["today-1"], "missing"), []);
});

test("image history search matches titles and aspect ratios case insensitively", () => {
  assert.deepEqual(filterAIStudioImageHistory(images, "  ORANGE ").map(({ id }) => id), ["older"]);
  assert.deepEqual(filterAIStudioImageHistory(images, "9:16").map(({ id }) => id), ["today-1", "today-2"]);
  assert.deepEqual(filterAIStudioImageHistory(images, "unknown"), []);
  assert.equal(filterAIStudioImageHistory(images, " "), images);
});

test("image history groups newest images first without mutating the source list", () => {
  const groups = groupAIStudioImageHistory(images, now);
  assert.deepEqual(groups.map(({ label }) => label), ["Today", "Yesterday", "Last week"]);
  assert.deepEqual(groups[0]?.images.map(({ id }) => id), ["today-2", "today-1"]);
  assert.equal(images[0]?.id, "older");
});

test("invalid dates remain available in the Earlier history group", () => {
  const invalid = image("unknown-date", "Saved image", "invalid", "4:5");
  const groups = groupAIStudioImageHistory([invalid, ...images], now);
  assert.equal(groups.at(-1)?.label, "Earlier");
  assert.equal(groups.at(-1)?.images[0]?.id, "unknown-date");
  assert.equal(getImageHistoryDateLabel("invalid", now), "Earlier");
});

test("a refresh retains recovered output until the media list catches up", () => {
  const recovered = image("recovered", "Completed request", now.toISOString(), "9:16");
  const firstRefresh = mergeAIStudioImageHistory(images, [recovered]);
  const secondRefresh = mergeAIStudioImageHistory(images, [recovered]);
  assert.equal(firstRefresh.find(({ id }) => id === "recovered"), recovered);
  assert.equal(secondRefresh.find(({ id }) => id === "recovered"), recovered);
  assert.equal(getVisibleAIStudioImages(secondRefresh, ["recovered"], null)[0], recovered);

  const persisted = { ...recovered, title: "Saved completed request" };
  const persistedRefresh = mergeAIStudioImageHistory([persisted, ...images], [recovered]);
  assert.equal(persistedRefresh.filter(({ id }) => id === "recovered").length, 1);
  assert.equal(persistedRefresh.find(({ id }) => id === "recovered"), persisted);
});

test("a saved asset without prompt metadata retains its recovered submitted prompt", () => {
  const recovered = { ...images[1]!, prompt: "The full submitted prompt\nwith all instructions." };
  const [merged] = mergeAIStudioImageHistory([{ ...recovered, prompt: undefined, title: "Saved image" }], [recovered]);
  assert.equal(merged?.title, "Saved image");
  assert.equal(merged?.prompt, recovered.prompt);
  assert.deepEqual(filterAIStudioImageHistory([merged!], "all instructions"), [merged]);
  const [refreshed] = mergeAIStudioImageHistory([{ ...recovered, prompt: "Earlier metadata prompt" }], [recovered]);
  assert.equal(refreshed?.prompt, recovered.prompt, "a refresh cannot replace the captured submitted prompt");
});

test("late completion cannot return to the canvas after a new session", () => {
  const jobId = "job-1";
  const eligibleJobs = new Set([jobId]);
  assert.equal(isImageCompletionForeground(jobId, 1, 1, eligibleJobs), true);
  assert.equal(isImageCompletionForeground(jobId, 1, 2, eligibleJobs), false, "New session invalidates the older completion");
  assert.equal(isImageCompletionForeground(jobId, 2, 2, new Set()), false, "dismissed jobs stay in history");
  assert.equal(isImageCompletionForeground(jobId, 1, 3, new Set([jobId])), false, "reusing an ID for a retry does not revive an earlier completion");
  assert.equal(isImageCompletionForeground(jobId, 3, 3, new Set([jobId])), true);
});

function image(
  id: string,
  title: string,
  createdAt: string,
  aspectRatio: AIStudioImageResult["aspectRatio"],
): AIStudioImageResult {
  return { id, title, createdAt, aspectRatio, url: `https://example.com/${id}.png` };
}
