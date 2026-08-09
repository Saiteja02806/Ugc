import { z } from "zod";

import {
  WebsiteBusinessAnalysisSchema,
  type WebsiteBusinessAnalysis,
} from "../website-analysis/schema.ts";

const compactString = z.string().trim().min(1).max(240);

export const BUSINESS_PROFILE_ONBOARDING_VERSION = 3;

export const PrimaryGoalSchema = z.enum([
  "increase_revenue",
  "generate_leads",
  "increase_signups",
  "increase_installs",
  "grow_views",
  "brand_awareness",
  "grow_following",
  "increase_engagement",
  "website_traffic",
  "product_launch",
]);

export type PrimaryGoal = z.infer<typeof PrimaryGoalSchema>;

export const PrimaryGoalsDraftSchema = z
  .array(PrimaryGoalSchema)
  .max(PrimaryGoalSchema.options.length)
  .refine((goals) => new Set(goals).size === goals.length, {
    message: "Choose each goal only once.",
  });

export type PrimaryGoalsDraft = z.infer<typeof PrimaryGoalsDraftSchema>;

export const PrimaryGoalsSchema = z
  .array(PrimaryGoalSchema)
  .min(1)
  .max(PrimaryGoalSchema.options.length)
  .refine((goals) => new Set(goals).size === goals.length, {
    message: "Choose each goal only once.",
  });

export type PrimaryGoals = z.infer<typeof PrimaryGoalsSchema>;

export const BusinessProfileOnboardingContextSchema = z
  .object({
    businessName: compactString.max(120),
  })
  .strict();

export type BusinessProfileOnboardingContext = z.infer<
  typeof BusinessProfileOnboardingContextSchema
>;

export type BusinessProfileOnboardingContextDraft = {
  businessName: string;
};

export type BusinessProfileOnboardingField =
  keyof BusinessProfileOnboardingContext;

const ONBOARDING_FIELDS = [
  "businessName",
] as const satisfies readonly BusinessProfileOnboardingField[];

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

export const BusinessDescriptionSchema = z
  .object({
    description: z.string().trim().min(20).max(4_000),
  })
  .strict();

export type BusinessDescription = z.infer<typeof BusinessDescriptionSchema>;

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
    businessModel: null,
    carouselAngles: [
      `The problem ${input.businessName} solves`,
      `A simpler way to ${input.category.toLowerCase()}`,
      `Why ${input.businessName} is different`,
    ],
    campaignPurposes: [],
    category: input.category,
    categories: [input.category],
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

export function applyBusinessProfileOnboardingContext(
  analysis: WebsiteBusinessAnalysis,
  onboardingContext: BusinessProfileOnboardingContext,
): WebsiteBusinessAnalysis {
  const context = BusinessProfileOnboardingContextSchema.parse(
    onboardingContext,
  );

  return WebsiteBusinessAnalysisSchema.parse({
    ...analysis,
    businessModel: analysis.businessModel ?? null,
    businessName: context.businessName,
    campaignPurposes: analysis.campaignPurposes ?? [],
    categories: analysis.categories ?? (analysis.category ? [analysis.category] : []),
  });
}

export function applyPrimaryGoals(
  analysis: WebsiteBusinessAnalysis,
  primaryGoals: PrimaryGoals,
): WebsiteBusinessAnalysis {
  const selectedGoals = PrimaryGoalsSchema.parse(primaryGoals);
  const canonicalGoals = PrimaryGoalSchema.options.filter((goal) =>
    selectedGoals.includes(goal),
  );

  return WebsiteBusinessAnalysisSchema.parse({
    ...analysis,
    businessModel: analysis.businessModel ?? null,
    campaignPurposes: Array.from(
      new Set(canonicalGoals.map(getCampaignPurposeForGoal)),
    ),
    categories: analysis.categories ?? (analysis.category ? [analysis.category] : []),
  });
}

export function applyPrimaryGoal(
  analysis: WebsiteBusinessAnalysis,
  primaryGoal: PrimaryGoal,
): WebsiteBusinessAnalysis {
  return applyPrimaryGoals(analysis, [primaryGoal]);
}

export function deriveBusinessProfileOnboardingContext(
  analysis: Partial<WebsiteBusinessAnalysis> | null | undefined,
): BusinessProfileOnboardingContextDraft {
  return {
    businessName: cleanString(analysis?.businessName),
  };
}

export function getMissingBusinessProfileOnboardingFields(
  analysis: Partial<WebsiteBusinessAnalysis> | null | undefined,
): BusinessProfileOnboardingField[] {
  const context = deriveBusinessProfileOnboardingContext(analysis);

  return ONBOARDING_FIELDS.filter((field) => {
    const fieldSchema = BusinessProfileOnboardingContextSchema.shape[field];
    return !fieldSchema.safeParse(context[field]).success;
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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCampaignPurposeForGoal(primaryGoal: PrimaryGoal) {
  if (primaryGoal === "increase_installs") {
    return "app_install" as const;
  }

  if (
    primaryGoal === "increase_revenue" ||
    primaryGoal === "generate_leads" ||
    primaryGoal === "increase_signups"
  ) {
    return "conversion" as const;
  }

  if (primaryGoal === "increase_engagement") {
    return "education" as const;
  }

  return "product_discovery" as const;
}
