import assert from "node:assert/strict";
import test from "node:test";

import {
  getWallTextMaximumWords,
  validateGeneratedWallTextIdeas,
} from "./wall-text-text-logic.ts";

test("gives Wall-of-text more reading room than a short Hook", () => {
  assert.equal(getWallTextMaximumWords(6), 18);
  assert.equal(getWallTextMaximumWords(12), 30);
  assert.equal(getWallTextMaximumWords(60), 72);
});

test("maps each generated idea into a separate three-block Wall text payload", () => {
  const result = validateGeneratedWallTextIdeas({
    candidates: [{ candidateIndex: 2, durationSeconds: 15 }],
    generated: [
      {
        body:
          "Most teams do not need more content. They need a repeatable way to turn one useful insight into something people can understand.",
        candidateIndex: 2,
        closing: "Clarity makes consistency easier.",
        headline: "Consistency is usually a systems problem",
      },
    ],
  });

  assert.deepEqual(result, [
    {
      candidateIndex: 2,
      content: {
        blocks: [
          {
            id: "headline",
            text: "Consistency is usually a systems problem",
          },
          {
            id: "body",
            text:
              "Most teams do not need more content. They need a repeatable way to turn one useful insight into something people can understand.",
          },
          {
            id: "closing",
            text: "Clarity makes consistency easier.",
          },
        ],
        kind: "wall_text",
        layoutVersion: "wall-text-overlay-v1",
      },
    },
  ]);
});

test("rejects missing candidate mappings and unreadable copy", () => {
  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 0, durationSeconds: 6 }],
        generated: [],
      }),
    /one Wall-of-text idea for every candidate/,
  );

  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 0, durationSeconds: 6 }],
        generated: [
          {
            body:
              "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
            candidateIndex: 0,
            closing: "twenty",
            headline: "Too many words",
          },
        ],
      }),
    /too long to read/,
  );
});
