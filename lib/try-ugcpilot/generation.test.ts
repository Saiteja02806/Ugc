import assert from "node:assert/strict";
import test from "node:test";

import {
  AnalyzeRequestSchema,
  INITIAL_POST_COUNT,
  REFILL_POST_COUNT,
  RefillRequestSchema,
  UgcPilotDemoError,
  validatePosts,
} from "./generation.ts";

const validWallOfText = Array.from({ length: 24 }, (_, index) => `word${index + 1}`).join(" ");

test("accepts exactly the requested number of complete Wall-of-Text posts", () => {
  const posts = validatePosts(
    {
      posts: Array.from({ length: INITIAL_POST_COUNT }, (_, index) => ({
        topic: `Topic ${index + 1}`,
        hook: `Hook ${index + 1}`,
        wallOfText: validWallOfText,
      })),
    },
    INITIAL_POST_COUNT,
    1,
  );

  assert.equal(posts.length, INITIAL_POST_COUNT);
  assert.deepEqual(posts.map((post) => post.id), Array.from({ length: INITIAL_POST_COUNT }, (_, index) => `post_${index + 1}`));
});

test("rejects incomplete or non-Wall-of-Text model output", () => {
  assert.throws(
    () =>
      validatePosts(
        {
          posts: [
            {
              topic: "Too short",
              hook: "A short hook",
              wallOfText: "only five words are here now",
            },
          ],
        },
        1,
        1,
      ),
    (error: unknown) => error instanceof UgcPilotDemoError && error.code === "AI_RESPONSE_INVALID",
  );
});

test("accepts complete creator copy without a brittle word-count requirement", () => {
  const posts = validatePosts(
    {
      posts: [
        {
          topic: "Clear next step",
          hook: "Make the next action obvious",
          wallOfText:
            "Make the next action obvious, remove the friction around it, and review the result before deciding what deserves your attention after that.",
        },
      ],
    },
    1,
    1,
  );

  assert.equal(posts.length, 1);
});

test("accepts only the public analysis and stateless refill request shapes", () => {
  assert.equal(AnalyzeRequestSchema.safeParse({ url: "https://example.com" }).success, true);
  assert.equal(AnalyzeRequestSchema.safeParse({ url: "" }).success, false);

  assert.equal(
    RefillRequestSchema.safeParse({
      businessContext: {
        brand: "Example",
        url: "https://example.com",
        title: "Example",
        description: "Example product",
        markdown: "Public product information.",
      },
      nextPostNumber: INITIAL_POST_COUNT + 1,
      recentHooks: Array.from({ length: REFILL_POST_COUNT }, (_, index) => `Hook ${index + 1}`),
    }).success,
    true,
  );
});
