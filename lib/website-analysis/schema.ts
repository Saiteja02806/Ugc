import { z } from "zod";

const compactString = z.string().trim().min(1).max(240);
const nullableCompactString = compactString.nullable();
const stringList = (maxItems: number) =>
  z.array(compactString).max(maxItems);

export const WebsiteBusinessAnalysisSchema = z
  .object({
    businessName: nullableCompactString,
    category: nullableCompactString,
    productSummary: z.string().trim().min(1).max(500).nullable(),

    targetAudience: stringList(5),
    mainProblem: nullableCompactString,
    mainPromise: nullableCompactString,
    valueProps: stringList(6),
    painPoints: stringList(6),
    differentiators: stringList(6),

    brandTone: nullableCompactString,

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

export type WebsiteBusinessAnalysis = z.infer<
  typeof WebsiteBusinessAnalysisSchema
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
