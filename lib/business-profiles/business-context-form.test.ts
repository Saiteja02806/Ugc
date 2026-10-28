import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBusinessContextListText,
  businessContextValidationMessage,
  createBusinessContextListText,
} from "./business-context-form.ts";
import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

function createContext(
  overrides: Partial<WebsiteBusinessAnalysis> = {},
): WebsiteBusinessAnalysis {
  return {
    brandTone: null,
    businessName: "Example",
    businessModel: null,
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

test("list text keeps spaces and a trailing newline while a user is composing", () => {
  const text = createBusinessContextListText(
    createContext({ targetAudience: ["SaaS builders"] }),
  );
  text.targetAudience = "SaaS builders and founders\n";

  assert.equal(text.targetAudience, "SaaS builders and founders\n");
});

test("saving list text trims only completed lines, keeps commas, and drops blank lines", () => {
  const saved = applyBusinessContextListText(
    createContext(),
    {
      categories: "B2B SaaS, analytics\n\n",
      claimsToAvoid: " Guaranteed results ",
      differentiators: "Human experts, not generic advice",
      painPoints: "Tracking meals takes too long\n  ",
      targetAudience: "SaaS builders and app founders\n",
      valueProps: "Meal tracking with a photo",
    },
  );

  assert.deepEqual(saved.categories, ["B2B SaaS, analytics"]);
  assert.deepEqual(saved.targetAudience, ["SaaS builders and app founders"]);
  assert.deepEqual(saved.painPoints, ["Tracking meals takes too long"]);
  assert.deepEqual(saved.differentiators, ["Human experts, not generic advice"]);
  assert.deepEqual(saved.claimsToAvoid, ["Guaranteed results"]);
});

test("keeps Wall-of-Text reader categories while list fields are edited", () => {
  const saved = applyBusinessContextListText(
    createContext({
      wallTextPrimaryReader: "Marketing managers",
      wallTextSecondaryReader: "Agency account managers",
    }),
    {
      categories: "",
      claimsToAvoid: "",
      differentiators: "",
      painPoints: "",
      targetAudience: "Marketing managers\nAgency account managers",
      valueProps: "",
    },
  );

  assert.equal(saved.wallTextPrimaryReader, "Marketing managers");
  assert.equal(saved.wallTextSecondaryReader, "Agency account managers");
});

test("oversized edits identify the field without dropping any typed lines", () => {
  const text = createBusinessContextListText(createContext());
  text.targetAudience = Array.from({ length: 6 }, (_, index) => `Audience ${index + 1}`).join("\n");
  const candidate = applyBusinessContextListText(createContext(), text);
  assert.equal(candidate.targetAudience.length, 6);
  assert.match(businessContextValidationMessage(candidate) ?? "", /Target audience allows at most 5 entries/);
  text.targetAudience = "A".repeat(241);
  assert.match(businessContextValidationMessage(applyBusinessContextListText(createContext(), text)) ?? "", /Target audience, line 1, must be 240 characters or fewer/);
  assert.match(businessContextValidationMessage(createContext({ productSummary: "x".repeat(501) })) ?? "", /Product summary must be 500 characters or fewer/);
  assert.equal(businessContextValidationMessage(createContext({ productSummary: "A useful product." })), null);
});
