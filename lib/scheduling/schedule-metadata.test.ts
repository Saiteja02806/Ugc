import assert from "node:assert/strict";
import test from "node:test";

import { normalizeScheduleMetadata } from "./schedule-metadata.ts";

test("preserves and normalizes the authoritative Hook text lines", () => {
  assert.deepEqual(
    normalizeScheduleMetadata({
      hookText: "Imagine time-consuming meal logging when this exists",
      hookTextLines: [
        " Imagine   time-consuming ",
        " meal logging when this exists ",
      ],
      mediaMode: "combined_video",
    }),
    {
      hookText: "Imagine time-consuming meal logging when this exists",
      hookTextLines: [
        "Imagine time-consuming",
        "meal logging when this exists",
      ],
      mediaMode: "combined_video",
    },
  );
});

test("keeps the existing primitive metadata contract and rejects unsafe arrays", () => {
  assert.deepEqual(
    normalizeScheduleMetadata({
      enabled: true,
      retryCount: 2,
      title: "A schedule",
      nested: { ignored: true },
      arbitraryArray: ["ignored"],
      hookTextLines: ["valid", "", "third"],
    }),
    {
      enabled: true,
      retryCount: 2,
      title: "A schedule",
    },
  );
});

test("bounds Hook text lines before they enter schedule metadata", () => {
  assert.deepEqual(
    normalizeScheduleMetadata({
      hookTextLines: ["a".repeat(79)],
    }),
    {},
  );

  assert.deepEqual(
    normalizeScheduleMetadata({
      hookTextLines: ["one", "two", "three", "four"],
    }),
    {},
  );
});
