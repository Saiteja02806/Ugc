import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";

/**
 * A small, deterministic projection of the owner-approved business profile.
 *
 * These IDs are stable within one immutable profile version. They deliberately
 * do not attempt to be globally permanent: changing the approved context must
 * create a new profile version and therefore a new fact snapshot.
 */
export const BUSINESS_FACT_SNAPSHOT_VERSION = "business-facts-v1" as const;
export const MAX_BUSINESS_FACTS_PER_SNAPSHOT = 12;

export type BusinessFactType =
  | "audience"
  | "capability"
  | "differentiator"
  | "outcome"
  | "pain";

export type ApprovedBusinessFact = {
  id: string;
  text: string;
  type: BusinessFactType;
};

export type BusinessFactSnapshot = {
  claimsToAvoid: readonly string[];
  facts: readonly ApprovedBusinessFact[];
  version: typeof BUSINESS_FACT_SNAPSHOT_VERSION;
};

type FactSource = {
  text: unknown;
  type: BusinessFactType;
};

// Keep this explicit set in sync with reaction_business_fact_text_v1 in the
// Reaction migration. It is the ECMAScript whitespace set used by \s, written
// out so the database and application can canonicalize the same characters.
const BUSINESS_FACT_WHITESPACE = /[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/gu;

/**
 * Keep this ordering in sync with reaction_business_fact_snapshot_v1 in the
 * Supabase migration. The database reconstructs the same snapshot before a
 * job is accepted, which prevents a browser or stale app server from choosing
 * a different set of facts than the worker will receive.
 */
export function buildBusinessFactSnapshot(
  analysis: WebsiteBusinessAnalysis,
): BusinessFactSnapshot {
  const factsByType = new Map<BusinessFactType, number>();
  const facts: ApprovedBusinessFact[] = [];

  for (const source of getFactSources(analysis)) {
    const text = normalizeFactText(source.text);
    if (!text || facts.length >= MAX_BUSINESS_FACTS_PER_SNAPSHOT) continue;

    const nextNumber = (factsByType.get(source.type) ?? 0) + 1;
    factsByType.set(source.type, nextNumber);
    facts.push({
      id: `${source.type}-${nextNumber}`,
      text,
      type: source.type,
    });
  }

  return {
    claimsToAvoid: normalizeStringList(analysis.claimsToAvoid, 6),
    facts,
    version: BUSINESS_FACT_SNAPSHOT_VERSION,
  };
}

function getFactSources(analysis: WebsiteBusinessAnalysis): readonly FactSource[] {
  return [
    { text: analysis.productSummary, type: "capability" },
    ...(analysis.valueProps ?? []).map((text) => ({ text, type: "capability" as const })),
    ...(analysis.differentiators ?? []).map((text) => ({ text, type: "differentiator" as const })),
    { text: analysis.mainProblem, type: "pain" },
    ...(analysis.painPoints ?? []).map((text) => ({ text, type: "pain" as const })),
    { text: analysis.mainPromise, type: "outcome" },
    ...(analysis.targetAudience ?? []).map((text) => ({ text, type: "audience" as const })),
  ];
}

function normalizeFactText(value: unknown) {
  if (typeof value !== "string") return "";

  // Postgres `left(text, 360)` counts Unicode code points, while JavaScript
  // String#slice counts UTF-16 units. Array.from gives us the same boundary
  // when an approved fact contains an astral-plane character such as emoji.
  const normalized = value
    .replace(BUSINESS_FACT_WHITESPACE, " ")
    .replace(/^ | $/gu, "");
  return Array.from(normalized).slice(0, 360).join("");
}

function normalizeStringList(values: readonly unknown[] | null | undefined, limit: number) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeFactText(value))
        .filter(Boolean),
    ),
  ).slice(0, limit);
}
