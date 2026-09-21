import assert from "node:assert/strict";
import test from "node:test";

import { buildWallTextPlanningContext } from "./wall-text-content-plan.ts";
import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

function createAnalysis(
  overrides: Partial<WebsiteBusinessAnalysis> = {},
): WebsiteBusinessAnalysis {
  return {
    brandTone: null,
    businessName: "Example",
    campaignPurposes: [],
    carouselAngles: [],
    category: "Marketing software",
    categories: ["Marketing software"],
    claimsToAvoid: [],
    confidence: "high",
    confidenceReason: null,
    ctaIdeas: [],
    differentiators: [],
    mainProblem: null,
    mainPromise: null,
    missingInfo: [],
    painPoints: [],
    pexelsImageQueries: [],
    productSummary: "Helps teams organize their marketing work.",
    recommendedCarouselStructure: [],
    targetAudience: ["Marketing managers", "Agency account managers"],
    valueProps: [],
    visualKeywords: [],
    ...overrides,
  };
}

test("sends explicit primary and secondary Wall reader categories into plan context", () => {
  const planningContext = buildWallTextPlanningContext(createAnalysis({
    wallTextPrimaryReader: "In-house marketing managers",
    wallTextSecondaryReader: "Agency account managers",
  }));

  assert.deepEqual(planningContext.wallTextReaders, {
    primary: "In-house marketing managers",
    secondary: "Agency account managers",
  });
});

test("uses existing target-audience evidence when an older context lacks Wall reader fields", () => {
  const planningContext = buildWallTextPlanningContext(createAnalysis({
    wallTextPrimaryReader: undefined,
    wallTextSecondaryReader: undefined,
  }));

  assert.deepEqual(planningContext.wallTextReaders, {
    primary: "Marketing managers",
    secondary: "Agency account managers",
  });
});

test("does not send the same reader twice", () => {
  const planningContext = buildWallTextPlanningContext(createAnalysis({
    wallTextPrimaryReader: "Marketing managers",
    wallTextSecondaryReader: " marketing managers ",
  }));

  assert.deepEqual(planningContext.wallTextReaders, {
    primary: "Marketing managers",
    secondary: null,
  });
});
