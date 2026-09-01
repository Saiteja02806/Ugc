import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

export const CAROUSEL_CONTENT_PLAN_MODEL = "gpt-4o-mini";
export const CAROUSEL_CONTENT_PLAN_PROMPT_VERSION =
  "carousel-content-plan-creative-briefs-v6-item-context-concept-lanes";
export const CAROUSEL_CONTENT_PLAN_TARGET_COUNT = 150;
export const CAROUSEL_CONTENT_PLAN_BRIEF_COUNT = 30;
export const CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;
export const CAROUSEL_CONTENT_PLAN_WRITER_BATCH_SIZE = 5;
export const CAROUSEL_CONTENT_PLAN_GENERATION_CHUNK_SIZE = 25;

export type CarouselContentPlanCreativeInput = {
  creativeSeed: string;
  emotion: string;
};

export type CarouselPlanningContext = {
  brandTone: string | null;
  campaignPurposes: string[];
  category: string | null;
  differentiators: string[];
  mainProblem: string | null;
  mainPromise: string | null;
  painPoints: string[];
  targetAudience: string[];
  valueProps: string[];
};

export function buildCarouselBusinessDescription(
  analysis: WebsiteBusinessAnalysis,
) {
  const businessName = clean(analysis.businessName);
  const productSummary = clean(analysis.productSummary);

  if (productSummary) {
    return businessName && !includesNormalized(productSummary, businessName)
      ? `${businessName}: ${productSummary}`.slice(0, 4_000)
      : productSummary.slice(0, 4_000);
  }

  const category = clean(analysis.category);

  if (businessName && category) {
    return `${businessName} is a ${category} application or business.`;
  }

  if (businessName) {
    return `${businessName} is an application or business.`;
  }

  if (category) {
    return `An application or business in the ${category} category.`;
  }

  throw new Error(
    "The business profile does not contain enough information for a minimal Carousel description.",
  );
}

export function buildCarouselPlanningContext(
  analysis: WebsiteBusinessAnalysis,
): CarouselPlanningContext {
  return {
    brandTone: clean(analysis.brandTone) || null,
    campaignPurposes: unique(analysis.campaignPurposes ?? []),
    category: clean(analysis.category) || null,
    differentiators: unique(analysis.differentiators),
    mainProblem: clean(analysis.mainProblem) || null,
    mainPromise: clean(analysis.mainPromise) || null,
    painPoints: unique(analysis.painPoints),
    targetAudience: unique(analysis.targetAudience),
    valueProps: unique(analysis.valueProps),
  };
}

function clean(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function includesNormalized(value: string, candidate: string) {
  return value.toLocaleLowerCase().includes(candidate.toLocaleLowerCase());
}

function unique(values: readonly string[]) {
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, 6);
}
