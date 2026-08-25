import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselBusinessDescription,
  buildCarouselPlanningContext,
} from "./content-plan.ts";

test("projects rich analysis into only one minimal business description", () => {
  const description = buildCarouselBusinessDescription({
    brandTone: "direct",
    businessName: "CampaignFlow",
    carouselAngles: ["less overwhelm"],
    category: "campaign management",
    claimsToAvoid: ["guaranteed growth"],
    confidence: "high",
    confidenceReason: "Product copy is explicit.",
    ctaIdeas: ["Start planning"],
    differentiators: ["one workspace"],
    mainProblem: "fragmented campaign work",
    mainPromise: "organized campaigns",
    missingInfo: [],
    painPoints: ["switching tools"],
    pexelsImageQueries: ["campaign planning"],
    productSummary: "An application for planning and managing campaign work.",
    recommendedCarouselStructure: ["hook", "problem", "solution"],
    targetAudience: ["campaign managers"],
    valueProps: ["less switching"],
    visualKeywords: ["campaign board"],
  });

  assert.equal(
    description,
    "CampaignFlow: An application for planning and managing campaign work.",
  );
  assert.doesNotMatch(description, /campaign managers|less switching|hook/i);
});

test("does not duplicate a business name already present in the summary", () => {
  const description = buildCarouselBusinessDescription({
    brandTone: null,
    businessName: "CampaignFlow",
    carouselAngles: [],
    category: null,
    claimsToAvoid: [],
    confidence: "medium",
    confidenceReason: null,
    ctaIdeas: [],
    differentiators: [],
    mainProblem: null,
    mainPromise: null,
    missingInfo: [],
    painPoints: [],
    pexelsImageQueries: [],
    productSummary: "CampaignFlow helps organize campaign work.",
    recommendedCarouselStructure: [],
    targetAudience: [],
    valueProps: [],
    visualKeywords: [],
  });

  assert.equal(description, "CampaignFlow helps organize campaign work.");
});

test("keeps approved profile facts available for private creative briefs", () => {
  const context = buildCarouselPlanningContext({
    brandTone: "warm and direct",
    businessName: "CampaignFlow",
    businessModel: "b2b",
    campaignPurposes: ["education", "conversion"],
    carouselAngles: [],
    categories: ["campaign management"],
    category: "campaign management",
    claimsToAvoid: [],
    confidence: "high",
    confidenceReason: null,
    ctaIdeas: [],
    differentiators: ["one workspace"],
    mainProblem: "fragmented campaign work",
    mainPromise: "organized campaigns",
    missingInfo: [],
    painPoints: ["switching tools"],
    pexelsImageQueries: [],
    productSummary: "An application for planning campaign work.",
    recommendedCarouselStructure: [],
    targetAudience: ["campaign managers"],
    valueProps: ["less switching"],
    visualKeywords: [],
  });

  assert.deepEqual(context, {
    brandTone: "warm and direct",
    campaignPurposes: ["education", "conversion"],
    category: "campaign management",
    differentiators: ["one workspace"],
    mainProblem: "fragmented campaign work",
    mainPromise: "organized campaigns",
    painPoints: ["switching tools"],
    targetAudience: ["campaign managers"],
    valueProps: ["less switching"],
  });
});
