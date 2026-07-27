import assert from "node:assert/strict";
import test from "node:test";

import {
  getTrendingHookMaximumWords,
  validateGeneratedTrendingHookTexts,
} from "./trending-hook-text-logic.ts";

test("Hook text limits follow each source video's real duration", () => {
  assert.equal(getTrendingHookMaximumWords(3), 8);
  assert.equal(getTrendingHookMaximumWords(4), 11);
  assert.equal(getTrendingHookMaximumWords(5), 14);
});

test("validates one readable Hook text for every video candidate", () => {
  assert.deepEqual(
    validateGeneratedTrendingHookTexts({
      candidates: [
        { candidateIndex: 0, durationSeconds: 3 },
        { candidateIndex: 1, durationSeconds: 5 },
      ],
      generated: [
        { candidateIndex: 1, text: "Stop losing hours to reports." },
        { candidateIndex: 0, text: "Reports should not take all morning." },
      ],
    }),
    [
      {
        candidateIndex: 0,
        text: "Reports should not take all morning.",
      },
      {
        candidateIndex: 1,
        text: "Stop losing hours to reports.",
      },
    ],
  );
});

test("rejects Hook text that cannot be read during the source clip", () => {
  assert.throws(
    () =>
      validateGeneratedTrendingHookTexts({
        candidates: [{ candidateIndex: 0, durationSeconds: 3 }],
        generated: [
          {
            candidateIndex: 0,
            text: "This sentence contains far too many words to read during a tiny clip",
          },
        ],
      }),
    /too long to read/,
  );
});
