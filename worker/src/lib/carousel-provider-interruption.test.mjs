import assert from "node:assert/strict";
import { mock, test } from "node:test";
let calls = 0;
const settings = [];
mock.module("openai", { defaultExport: class {
  constructor(options) { settings.push(options); }
  chat = { completions: { create: async () => { calls++; const error = new Error("Request timed out."); error.name = "APIConnectionTimeoutError"; throw error; } } };
} });
const { buildCarouselContentPlanBatch } = await import("../../dist/lib/carousel-llm-slide-plan.js");
const { buildCarouselStructure2StoryPlanBatch } = await import("../../dist/lib/carousel-structure-2-planner.js");
const { isRetryableContentPlanProviderError } = await import("../../dist/lib/content-plan-provider-retry.js");
const { RetryableJobError } = await import("../../dist/retryable-job-error.js");
test("initial provider interruption emits one request and never fans out to five candidate repairs", async () => {
  process.env.OPENAI_API_KEY = "fixture-no-network";
  const analysis = { businessName: "CampaignFlow", category: "marketing software", productSummary: "A workspace for organizing campaign work.",
    mainProblem: "Scattered campaign context", mainPromise: "Organized handoffs", targetAudience: ["small teams"], valueProps: ["Shared task context"],
    painPoints: ["Missed handoffs"], differentiators: ["Context beside each decision"], claimsToAvoid: ["guarantees"], visualKeywords: ["paper calendar"], carouselAngles: ["Clear handoff"], brandTone: "practical", confidence: "high", ctaIdeas: [] };
  await assert.rejects(buildCarouselContentPlanBatch({ analysis, businessDescription: analysis.productSummary, recentHistory: [],
    items: Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, candidateIndex: slotIndex, contentFormatId: "list", hookFamilyId: "surprise", creativeSeed: `Clear handoff ${slotIndex}`, emotion: "relief" })) }), error => isRetryableContentPlanProviderError(error));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(buildCarouselStructure2StoryPlanBatch({ businessDescription: analysis.productSummary,
    assignments: Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, candidateIndex: slotIndex, storyFormatId: "wrong_belief", creativeSeed: `Clear handoff ${slotIndex}`, emotion: "relief" })) }), error => error instanceof RetryableJobError);
  assert.equal(calls, 1);
  assert.ok(settings.every(options => options.timeout === 120000 && options.maxRetries === 0));
  assert.equal(isRetryableContentPlanProviderError(new Error("Unsupported claim: guaranteed growth")), false);
});
