import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

export const BUSINESS_CONTEXT_LIST_FIELDS = [
  "categories",
  "claimsToAvoid",
  "differentiators",
  "painPoints",
  "targetAudience",
  "valueProps",
] as const;

export type BusinessContextListField =
  (typeof BUSINESS_CONTEXT_LIST_FIELDS)[number];

export type BusinessContextListText = Record<BusinessContextListField, string>;

const BUSINESS_CONTEXT_LIST_LIMITS: Record<BusinessContextListField, number> = {
  categories: 3,
  claimsToAvoid: 6,
  differentiators: 6,
  painPoints: 6,
  targetAudience: 5,
  valueProps: 6,
};

/**
 * Text areas need their own raw edit state. Normalizing as the user types
 * erases a space at the end of a word and a newline that starts the next item.
 */
export function createBusinessContextListText(
  context: WebsiteBusinessAnalysis,
): BusinessContextListText {
  return Object.fromEntries(
    BUSINESS_CONTEXT_LIST_FIELDS.map((field) => [
      field,
      (context[field] ?? []).join("\n"),
    ]),
  ) as BusinessContextListText;
}

/**
 * Persist only intentional, non-blank lines. Commas remain ordinary prose:
 * these fields are labelled "one per line", and a comma can be part of an
 * audience, pain point, capability, or claim.
 */
export function applyBusinessContextListText(
  context: WebsiteBusinessAnalysis,
  listText: BusinessContextListText,
): WebsiteBusinessAnalysis {
  return {
    ...context,
    ...Object.fromEntries(
      BUSINESS_CONTEXT_LIST_FIELDS.map((field) => [
        field,
        parseBusinessContextListText(listText[field], field),
      ]),
    ),
  } as WebsiteBusinessAnalysis;
}

export function parseBusinessContextListText(
  value: string,
  field: BusinessContextListField,
) {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, BUSINESS_CONTEXT_LIST_LIMITS[field]);
}
