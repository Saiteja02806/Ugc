import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWallTextBusinessContext,
  estimateWallTextReadingSeconds,
  getWallTextMaximumWords,
  getWallTextPreviewTitle,
  validateGeneratedWallTextIdeas,
} from "./wall-text-text-logic.ts";

const CURRENT_EXAMPLE = {
  candidateIndex: 2,
  fullText:
    "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
  pattern: "situation_discovery" as const,
  segments: [
    {
      lines: ["I logged every meal"],
      role: "lead" as const,
    },
    {
      lines: ["but skipped drinks", "oil and small bites."],
      role: "support" as const,
    },
    {
      lines: ["Those missing details", "quietly changed", "the final total."],
      role: "closing" as const,
    },
  ],
};

test("uses the six-second Wall 24-word hard limit", () => {
  assert.equal(getWallTextMaximumWords(), 24);
});

test("maps the assigned pattern and semantic segments into the Wall v4 payload", () => {
  const result = validateGeneratedWallTextIdeas({
    candidates: [{ candidateIndex: 2, durationSeconds: 6.016 }],
    generated: [CURRENT_EXAMPLE],
  });

  assert.deepEqual(result, [
    {
      candidateIndex: 2,
      content: {
        fullText: CURRENT_EXAMPLE.fullText,
        kind: "wall_text",
        layoutVersion: "wall-text-overlay-v4",
        pattern: "situation_discovery",
        segments: CURRENT_EXAMPLE.segments,
      },
    },
  ]);
});

test("estimates comfort from the native clip duration", () => {
  assert.ok(estimateWallTextReadingSeconds(CURRENT_EXAMPLE.fullText) < 6.016);
  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 2, durationSeconds: 4.5 }],
        generated: [CURRENT_EXAMPLE],
      }),
    /longer than the 4.5-second clip/,
  );
});

test("sends only Wall-relevant Business Profile context", () => {
  const context = buildWallTextBusinessContext({
    brandTone: "Warm and practical",
    businessName: "Calorie Fit",
    carouselAngles: ["Carousel angle"],
    category: "Nutrition",
    claimsToAvoid: ["Guaranteed weight loss"],
    confidence: "high",
    confidenceReason: "Clear source material",
    ctaIdeas: ["Join the waitlist"],
    differentiators: ["Expert feedback"],
    mainProblem: "Meal logging takes too long",
    mainPromise: "Make nutrition easier to understand",
    missingInfo: [],
    painPoints: ["Confusing meal data"],
    pexelsImageQueries: ["healthy meal"],
    productSummary: "A nutrition tracking service",
    recommendedCarouselStructure: ["Hook", "Problem", "CTA"],
    targetAudience: ["Busy professionals"],
    valueProps: ["Context-aware nutrition guidance"],
    visualKeywords: ["healthy"],
  });

  assert.deepEqual(Object.keys(context).sort(), [
    "brandTone",
    "businessName",
    "category",
    "claimsToAvoid",
    "differentiators",
    "mainProblem",
    "mainPromise",
    "painPoints",
    "productSummary",
    "targetAudience",
    "valueProps",
  ]);
  assert.equal(JSON.stringify(context).includes("Join the waitlist"), false);
  assert.equal(JSON.stringify(context).includes("Carousel angle"), false);
});

test("rejects missing mappings, generic marketing, and CTA copy", () => {
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
        candidates: [{ candidateIndex: 2, durationSeconds: 6.016 }],
        generated: [
          {
            ...CURRENT_EXAMPLE,
            fullText: CURRENT_EXAMPLE.fullText.replace(
              "I logged every meal",
              "Unlock your dinner",
            ),
            segments: [
              {
                lines: ["Unlock your dinner"],
                role: "lead",
              },
              ...CURRENT_EXAMPLE.segments.slice(1),
            ],
          },
        ],
      }),
    /generic promotional copy/,
  );

  const ctaText =
    "Meal logging took too long. A photo drafted the details in seconds. Start tracking today and reclaim your evening.";
  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 0, durationSeconds: 7 }],
        generated: [
          {
            candidateIndex: 0,
            fullText: ctaText,
            pattern: "problem_change_result",
            segments: [
              {
                lines: ["Meal logging took", "too long."],
                role: "lead",
              },
              {
                lines: ["A photo drafted", "the details in seconds."],
                role: "support",
              },
              {
                lines: ["Start tracking today", "and reclaim your evening."],
                role: "closing",
              },
            ],
          },
        ],
      }),
    /call to action|generic promotional copy/,
  );

  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 5, durationSeconds: 6 }],
        generated: [
          {
            candidateIndex: 5,
            fullText:
              "See your progress clearly. Scattered numbers become one useful picture. Patterns feel easier to notice and understand.",
            pattern: "action_benefit",
            segments: [
              {
                lines: ["See your progress clearly."],
                role: "lead",
              },
              {
                lines: ["Scattered numbers become", "one useful picture."],
                role: "support",
              },
              {
                lines: ["Patterns feel easier", "to notice and understand."],
                role: "closing",
              },
            ],
          },
        ],
      }),
    /call to action/,
  );

  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 5, durationSeconds: 6 }],
        generated: [
          {
            candidateIndex: 5,
            fullText:
              "Reviewing progress insights removes scattered numbers and makes the bigger picture much easier to see and understand",
            pattern: "action_benefit",
            segments: [
              {
                lines: [
                  "Reviewing progress insights",
                  "removes scattered numbers",
                ],
                role: "lead",
              },
              {
                lines: ["and makes the bigger", "picture much easier"],
                role: "support",
              },
              {
                lines: ["to see", "and understand"],
                role: "closing",
              },
            ],
          },
        ],
      }),
    /two or three short grammatical sentences/,
  );

  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 4, durationSeconds: 6 }],
        generated: [
          {
            candidateIndex: 4,
            fullText:
              "Nutrition guidance can feel generic. Personalized context connects choices to goals. Focus on small changes that fit your routine.",
            pattern: "belief_reframe",
            segments: [
              {
                lines: ["Nutrition guidance", "can feel generic."],
                role: "lead",
              },
              {
                lines: [
                  "Personalized context",
                  "connects choices to goals.",
                ],
                role: "support",
              },
              {
                lines: ["Focus on small changes", "that fit your routine."],
                role: "closing",
              },
            ],
          },
        ],
      }),
    /call to action/,
  );
});

test("rejects mismatched full text and unsafe semantic line breaks", () => {
  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 2, durationSeconds: 6.016 }],
        generated: [
          {
            ...CURRENT_EXAMPLE,
            fullText: `${CURRENT_EXAMPLE.fullText} Extra words.`,
          },
        ],
      }),
    /must exactly represent/,
  );

  assert.throws(
    () =>
      validateGeneratedWallTextIdeas({
        candidates: [{ candidateIndex: 2, durationSeconds: 6.016 }],
        generated: [
          {
            ...CURRENT_EXAMPLE,
            fullText: CURRENT_EXAMPLE.fullText.replace(
              "but skipped drinks oil and small bites.",
              "but skipped drinks and small bites.",
            ),
            segments: [
              CURRENT_EXAMPLE.segments[0],
              {
                lines: ["but skipped drinks and", "small bites."],
                role: "support",
              },
              CURRENT_EXAMPLE.segments[2],
            ],
          },
        ],
      }),
    /cannot follow an article, conjunction, or preposition/,
  );
});

test("builds an accessible preview title from fullText", () => {
  assert.equal(
    getWallTextPreviewTitle("A short and complete thought."),
    "A short and complete thought.",
  );
  assert.match(getWallTextPreviewTitle(CURRENT_EXAMPLE.fullText), /…$/);
});
