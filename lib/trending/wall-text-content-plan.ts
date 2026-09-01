import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

export const WALL_TEXT_CONTENT_PLAN_MODEL = "gpt-5-mini";
export const WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION =
  "wall-text-content-plan-five-context-v5-item-context-concept-lanes";
export const WALL_TEXT_CONTENT_PLAN_TARGET_COUNT = 200;
export const WALL_TEXT_CONTENT_PLAN_BRIEF_COUNT = 40;
export const WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

export type WallTextPlanningContext = {
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

export function buildWallTextContentPlanDescription(
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
    return `${businessName} is a business in the ${category} category.`;
  }
  if (businessName) return `${businessName} is a business.`;
  if (category) return `A business in the ${category} category.`;

  throw new Error(
    "The business profile does not contain enough information for a Wall-of-Text content plan.",
  );
}

export function buildWallTextPlanningContext(
  analysis: WebsiteBusinessAnalysis,
): WallTextPlanningContext {
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
