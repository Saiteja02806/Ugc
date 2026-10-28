import { WebsiteBusinessAnalysisSchema, type WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

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

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business name", category: "Category", categories: "Category tags",
  productSummary: "Product summary", mainProblem: "Main customer problem", mainPromise: "Main promise",
  targetAudience: "Target audience", wallTextPrimaryReader: "Wall-of-Text primary reader",
  wallTextSecondaryReader: "Wall-of-Text secondary reader", painPoints: "Customer pain points",
  valueProps: "Approved capabilities / value", differentiators: "Differentiators", claimsToAvoid: "Claims to avoid",
};

/** Give actionable validation without exposing field values in error messages. */
export function businessContextValidationMessage(context: unknown): string | null {
  const result = WebsiteBusinessAnalysisSchema.safeParse(context);
  if (result.success) return null;
  const issue = result.error.issues[0];
  const label = FIELD_LABELS[String(issue.path[0])] ?? "Business Context";
  if (issue.code === "too_big") {
    const limit = String(issue.maximum);
    return issue.origin === "array"
      ? `${label} allows at most ${limit} entries. Keep each entry on a separate line.`
      : `${label}${typeof issue.path[1] === "number" ? `, line ${issue.path[1] + 1},` : ""} must be ${limit} characters or fewer.`;
  }
  return `Review ${label}. A value is missing or invalid.`;
}

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
        parseBusinessContextListText(listText[field]),
      ]),
    ),
  } as WebsiteBusinessAnalysis;
}

export function parseBusinessContextListText(value: string) {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
}
