import { z } from "zod";

const compactString = z.string().trim().min(1).max(240);
const nullableCompactString = compactString.nullable();
const stringList = (maxItems: number) =>
  z.array(compactString).max(maxItems);

export const BusinessModelSchema = z.enum(["b2b", "b2c", "both"]);

export const CampaignPurposeSchema = z.enum([
  "product_discovery",
  "education",
  "conversion",
  "retargeting",
  "app_install",
]);

export const WebsiteBusinessAnalysisSchema = z
  .object({
    businessName: nullableCompactString,
    businessModel: BusinessModelSchema.nullable(),
    category: nullableCompactString,
    categories: stringList(3),
    productSummary: z.string().trim().min(1).max(500).nullable(),

    targetAudience: stringList(5),
    mainProblem: nullableCompactString,
    mainPromise: nullableCompactString,
    valueProps: stringList(6),
    painPoints: stringList(6),
    differentiators: stringList(6),

    brandTone: nullableCompactString,
    campaignPurposes: z.array(CampaignPurposeSchema).max(5),

    carouselAngles: stringList(6),
    pexelsImageQueries: stringList(8),
    visualKeywords: stringList(10),
    recommendedCarouselStructure: stringList(8),
    ctaIdeas: stringList(6),

    claimsToAvoid: stringList(6),
    missingInfo: stringList(6),

    confidence: z.enum(["low", "medium", "high"]),
    confidenceReason: z.string().trim().min(1).max(360).nullable(),
  })
  .strict();

type CurrentWebsiteBusinessAnalysis = z.infer<
  typeof WebsiteBusinessAnalysisSchema
>;

// Rows written before onboarding v1 do not contain these properties. Keep the
// read type compatible while requiring all three in newly parsed AI output.
export type WebsiteBusinessAnalysis = Omit<
  CurrentWebsiteBusinessAnalysis,
  "businessModel" | "campaignPurposes" | "categories"
> &
  Partial<
    Pick<
      CurrentWebsiteBusinessAnalysis,
      "businessModel" | "campaignPurposes" | "categories"
    >
  >;

export type WebsiteAnalysisApiResponse =
  | {
      ok: true;
      analysisId: string;
      analysis: WebsiteBusinessAnalysis;
      normalizedDomain: string;
    }
  | {
      ok: false;
      message: string;
    };
