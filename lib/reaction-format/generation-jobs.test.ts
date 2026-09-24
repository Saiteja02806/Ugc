import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompletedReactionCoverageShortfall,
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

test("surfaces an unavailable Reaction catalog as a stable coverage shortfall", () => {
  const shortfall = getCompletedReactionCoverageShortfall({
    jobs: [{
      attemptCount: 1,
      createdAt: "2026-09-24T00:00:00.000Z",
      errorCode: null,
      errorMessage: null,
      id: "job-1",
      input: {
        businessProfileId: "profile-1",
        businessProfileVersion: 1,
        requestKey: "reaction-v2:feed-1:profile-1:active-62:need-2",
      },
      jobType: "reaction_generation",
      maxAttempts: 3,
      output: {
        failedCount: 0,
        readyCount: 0,
        requestedCount: 2,
        shortfallCount: 2,
        shortfallReason: "reaction_catalog_capacity_exhausted",
        status: "partial",
      },
      projectId: "project-1",
      status: "completed",
      updatedAt: "2026-09-24T00:00:00.000Z",
      userId: "user-1",
    }],
    profile: { id: "profile-1", profileVersion: 1 },
    requestKey: "reaction-v2:feed-1:profile-1:active-62:need-2",
  });

  assert.deepEqual(shortfall, {
    kind: "coverage_shortfall",
    message: "No additional Reaction Reels can be prepared until the approved catalog has a renderable alpha clip and background.",
    missingCount: 2,
    readyCount: 0,
    requestedCount: 2,
  });
});
