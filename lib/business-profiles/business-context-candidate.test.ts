import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBusinessContextCandidateReady,
  prepareBusinessContextCandidate,
} from "./business-context-candidate.ts";
import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

function createContext(
  overrides: Partial<WebsiteBusinessAnalysis> = {},
): WebsiteBusinessAnalysis {
  return {
    brandTone: null,
    businessName: "Example",
    campaignPurposes: [],
    carouselAngles: [],
    category: null,
    categories: [],
    claimsToAvoid: [],
    confidence: "low",
    confidenceReason: null,
    ctaIdeas: [],
    differentiators: [],
    mainProblem: null,
    mainPromise: null,
    missingInfo: [],
    painPoints: [],
    pexelsImageQueries: [],
    productSummary: null,
    recommendedCarouselStructure: [],
    targetAudience: [],
    valueProps: [],
    visualKeywords: [],
    ...overrides,
  };
}

test("a draft with no business facts stays reviewable but cannot be applied", () => {
  const candidate = prepareBusinessContextCandidate(createContext());

  assert.equal(candidate.status, "needs_facts");
  assert.equal(candidate.factCount, 0);
  assert.throws(
    () => assertBusinessContextCandidateReady(createContext()),
    /business_context_draft_needs_facts/,
  );
});

test("one approved fact is ready and preserves the fact snapshot used by grounding", () => {
  const candidate = prepareBusinessContextCandidate(
    createContext({ productSummary: "Turns meal photos into nutrition logs." }),
  );

  assert.equal(candidate.status, "ready");
  assert.equal(candidate.factCount, 1);
  assert.deepEqual(candidate.factSnapshot.facts, [
    {
      id: "capability-1",
      text: "Turns meal photos into nutrition logs.",
      type: "capability",
    },
  ]);
});
