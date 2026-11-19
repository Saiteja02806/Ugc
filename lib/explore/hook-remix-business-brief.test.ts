import assert from "node:assert/strict";
import test from "node:test";
import { hookRemixBusinessBrief } from "./hook-remix-business-brief.ts";
import { remixTextPrompt } from "./remix-text-prompt.ts";
import { hookRemixReviewPayload } from "./hook-remix-quality.ts";
import type { ReferenceText } from "./reference-text.ts";

test("Hook generation and proofreader use factual context without campaign and Carousel suggestions", () => {
  const context = {
    businessName: "Vidmake", productSummary: "Creates short product videos.",
    targetAudience: ["SaaS founders"], mainProblem: "Making videos takes time.",
    valueProps: ["Creates a clip from an approved starting image."],
    differentiators: ["Requires human approval before publishing."],
    claimsToAvoid: ["Guaranteed views", "Automatic publishing without approval"],
    missingInfo: ["Free plan availability is unknown"], brandTone: "Conversational",
    ctaIdeas: ["Buy now"], carouselAngles: ["SaaS founders need this"],
    recommendedCarouselStructure: ["Pitch to SaaS founders"], visualKeywords: ["Office"],
    campaignPurposes: ["conversion"], confidenceReason: "Extracted from a website.",
  };
  const before = JSON.stringify(context);
  const source: ReferenceText = {
    referenceId: "hook-test", slideId: null, sourceSha256: "a".repeat(64),
    format: "hook", status: "ready", blocks: [{ text: "Is this even legal?...", startMs: 0, endMs: 3000 }],
    extractedAt: "2026-11-15T00:00:00Z", model: "user-text", notes: "",
  };
  const brief = hookRemixBusinessBrief(context);
  const expected = Object.fromEntries(Object.entries(context).filter(([key]) =>
    !["targetAudience", "mainProblem", "mainPromise", "ctaIdeas", "carouselAngles", "recommendedCarouselStructure", "visualKeywords", "campaignPurposes", "confidenceReason"].includes(key)));
  assert.deepEqual(brief, expected);
  assert.deepEqual(JSON.parse(remixTextPrompt(source, context, "No brands")).businessContext, expected);
  const draft = { blocks: ["Is this even legal?..."], heading: "", body: "" };
  assert.deepEqual(JSON.parse(hookRemixReviewPayload(source, context, "No brands", draft, 4)).businessFacts, expected);
  assert.deepEqual(JSON.parse(hookRemixReviewPayload(source, context, "", draft, 3)).businessFacts, context);
  for (const format of ["wall_text", "slideshow"] as const) {
    assert.deepEqual(JSON.parse(remixTextPrompt({ ...source, format }, context, "")).businessContext, context);
  }
  assert.equal(JSON.stringify(context), before);
  assert.ok(JSON.stringify(brief).length < JSON.stringify(context).length);
});

test("the brief keeps long owner facts, qualifications and missing data exactly", () => {
  const context = { productSummary: "A complete sentence. ".repeat(300), claimsToAvoid: ["Never omit the approval requirement."], missingInfo: ["Pricing"] };
  assert.deepEqual(hookRemixBusinessBrief(context), context);
  for (const value of [null, undefined, "legacy context", []]) {
    assert.equal(hookRemixBusinessBrief(value), value);
  }
});
