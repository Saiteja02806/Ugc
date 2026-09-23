import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMatchingReactionGenerationContext,
  type ReactionGenerationContextSnapshot,
} from "./generation-jobs.ts";

const expectedContext: ReactionGenerationContextSnapshot = {
  audience: ["creators"],
  commonSituations: ["planning content"],
  contextVersion: "reaction-grounding-v2",
  desiredOutcomes: ["publish consistently"],
  factSnapshot: {
    claimsToAvoid: ["guaranteed growth"],
    facts: [
      {
        id: "capability-1",
        text: "UGC Pilot schedules approved social content.",
        type: "capability",
      },
    ],
    version: "business-facts-v1",
  },
  pains: ["planning content"],
  productName: "UGC Pilot",
};

test("accepts a persisted Reaction fact snapshot after JSONB reorders its object keys", () => {
  const persistedContext = {
    ...expectedContext,
    factSnapshot: {
      facts: expectedContext.factSnapshot.facts.map((fact) => ({ ...fact })),
      version: expectedContext.factSnapshot.version,
      claimsToAvoid: [...expectedContext.factSnapshot.claimsToAvoid],
    },
  };

  assert.equal(
    hasMatchingReactionGenerationContext(persistedContext, expectedContext),
    true,
  );
});

test("rejects a persisted Reaction fact snapshot when a fact changes", () => {
  const persistedContext = {
    ...expectedContext,
    factSnapshot: {
      claimsToAvoid: [...expectedContext.factSnapshot.claimsToAvoid],
      facts: [{ ...expectedContext.factSnapshot.facts[0], text: "Different claim." }],
      version: expectedContext.factSnapshot.version,
    },
  };

  assert.equal(
    hasMatchingReactionGenerationContext(persistedContext, expectedContext),
    false,
  );
});
