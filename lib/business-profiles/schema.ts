import { z } from "zod";

import {
  WebsiteBusinessAnalysisSchema,
  type WebsiteBusinessAnalysis,
} from "@/lib/website-analysis/schema";

const compactString = z.string().trim().min(1).max(240);

export const BusinessProfileIntakeTypeSchema = z.enum([
  "website",
  "mobile_app_ai_prompt",
  "manual",
]);

export type BusinessProfileIntakeType = z.infer<
  typeof BusinessProfileIntakeTypeSchema
>;

export const ManualBusinessProfileSchema = z.object({
  brandTone: z.string().trim().max(160).optional(),
  businessName: compactString.max(120),
  category: compactString.max(120),
  mainProblem: compactString.max(360),
  productSummary: z.string().trim().min(20).max(1_000),
  targetAudience: z.string().trim().min(3).max(600),
  valueProps: z.string().trim().min(3).max(1_000),
});

export type ManualBusinessProfile = z.infer<typeof ManualBusinessProfileSchema>;

export function buildManualBusinessAnalysis(
  input: ManualBusinessProfile,
): WebsiteBusinessAnalysis {
  const audience = splitLines(input.targetAudience, 5);
  const valueProps = splitLines(input.valueProps, 6);
  const keywords = splitWords(
    [input.category, input.productSummary, input.mainProblem].join(" "),
    10,
  );

  return WebsiteBusinessAnalysisSchema.parse({
    brandTone: input.brandTone?.trim() || null,
    businessName: input.businessName,
    carouselAngles: [
      `The problem ${input.businessName} solves`,
      `A simpler way to ${input.category.toLowerCase()}`,
      `Why ${input.businessName} is different`,
    ],
    category: input.category,
    claimsToAvoid: [],
    confidence: "high",
    confidenceReason: "Structured directly from the business owner's onboarding input.",
    ctaIdeas: ["Learn more", "Try it today", "See how it works"],
    differentiators: valueProps.slice(0, 3),
    mainProblem: input.mainProblem,
    mainPromise: valueProps[0] ?? input.productSummary.slice(0, 180),
    missingInfo: [],
    painPoints: [input.mainProblem],
    pexelsImageQueries: [
      `${input.category} app on phone`,
      `${input.category} workspace objects`,
      "clean abstract background",
    ],
    productSummary: input.productSummary,
    recommendedCarouselStructure: [
      `Hook: ${input.mainProblem}`,
      `Problem: ${input.mainProblem}`,
      `Solution: ${input.productSummary.slice(0, 180)}`,
      `Benefit: ${valueProps[0] ?? input.productSummary.slice(0, 140)}`,
      "CTA: Learn more",
    ],
    targetAudience: audience,
    valueProps,
    visualKeywords: keywords,
  });
}

function splitLines(value: string, maxItems: number) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function splitWords(value: string, maxItems: number) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z][a-z-]{2,}/g)
        ?.filter((word) => !new Set(["and", "that", "with", "from", "this", "your"]).has(word))
        .slice(0, maxItems) ?? [],
    ),
  );
}
