import {
  buildBusinessFactSnapshot,
  type ApprovedBusinessFact,
  type BusinessFactSnapshot,
} from "../business-profiles/fact-catalog.ts";
import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";
import type { WallTextGroundingMetadata } from "./wall-text-types.ts";

/**
 * Wall V2 is deliberately an assignment contract, not an extra creative
 * suggestion.  The exact snapshot and selected fact are saved with the
 * reservation before the writer is called, so a later prompt retry cannot
 * silently swap business evidence.
 */
export const WALL_TEXT_GROUNDING_CONTEXT_VERSION =
  "wall-text-grounding-v2" as const;

export type WallTextFactGrounding = {
  assignedFact: ApprovedBusinessFact;
  contextVersion: typeof WALL_TEXT_GROUNDING_CONTEXT_VERSION;
  factSnapshot: BusinessFactSnapshot;
};

/**
 * Candidate indices are stable inside a reserved batch. This supplies a
 * canonical initial fact for a reservation; new planned cards replace it with
 * their plan-selected fact before writing. Cycling still keeps legacy cards
 * grounded without inventing claims or requiring a minimum fact count.
 */
export function buildWallTextFactGroundingAssignments(params: {
  analysis: WebsiteBusinessAnalysis;
  candidateIndexes: readonly number[];
}) {
  const factSnapshot = buildBusinessFactSnapshot(params.analysis);
  const result = new Map<number, WallTextFactGrounding>();
  if (factSnapshot.facts.length === 0) return result;

  for (const candidateIndex of params.candidateIndexes) {
    const index = Math.abs(Math.trunc(candidateIndex)) % factSnapshot.facts.length;
    const assignedFact = factSnapshot.facts[index]!;
    result.set(candidateIndex, {
      assignedFact,
      contextVersion: WALL_TEXT_GROUNDING_CONTEXT_VERSION,
      factSnapshot,
    });
  }

  return result;
}

/**
 * Parses the database-owned assignment. Missing grounding is intentionally
 * valid for reservations created before this rollout; an announced V2 value
 * that is malformed fails closed instead of falling back to a reviewer.
 */
export function parseWallTextFactGrounding(value: unknown) {
  const record = asRecord(value);
  if (!record || record.contextVersion === undefined) return null;
  if (record.contextVersion !== WALL_TEXT_GROUNDING_CONTEXT_VERSION) {
    throw new Error("Wall-of-text grounding context version is invalid.");
  }

  const factSnapshot = parseFactSnapshot(record.factSnapshot);
  const assignedFact = parseFact(record.assignedFact);
  const canonicalFact = factSnapshot.facts.find(
    (fact) => fact.id === assignedFact.id,
  );
  if (!canonicalFact || !sameFact(canonicalFact, assignedFact)) {
    throw new Error("Wall-of-text grounding assignment is invalid.");
  }

  return {
    assignedFact,
    contextVersion: WALL_TEXT_GROUNDING_CONTEXT_VERSION,
    factSnapshot,
  } satisfies WallTextFactGrounding;
}

export function selectWallTextGroundingFact(
  grounding: WallTextFactGrounding,
  factId: string,
): WallTextFactGrounding {
  const assignedFact = grounding.factSnapshot.facts.find(
    (fact) => fact.id === factId,
  );
  if (!assignedFact) {
    throw new Error("Wall-of-text plan selected an unapproved business fact.");
  }
  return {
    ...grounding,
    assignedFact,
  };
}

export function toWallTextGroundingMetadata(
  grounding: WallTextFactGrounding,
): WallTextGroundingMetadata {
  return {
    anchorId: grounding.assignedFact.id,
    factSnapshotVersion: grounding.factSnapshot.version,
    factText: grounding.assignedFact.text,
    factType: grounding.assignedFact.type,
    version: WALL_TEXT_GROUNDING_CONTEXT_VERSION,
  };
}

// Supabase JSON fields use mutable arrays, while the fact catalog exposes an
// immutable snapshot. Serialize explicitly instead of casting away that
// boundary before the reservation is persisted.
export function serializeWallTextFactGrounding(
  grounding: WallTextFactGrounding,
) {
  return {
    assignedFact: { ...grounding.assignedFact },
    contextVersion: grounding.contextVersion,
    factSnapshot: {
      claimsToAvoid: [...grounding.factSnapshot.claimsToAvoid],
      facts: grounding.factSnapshot.facts.map((fact) => ({ ...fact })),
      version: grounding.factSnapshot.version,
    },
  };
}

/**
 * This deterministic validation prevents an approved fact snapshot from
 * becoming permission to repeat a claim the owner marked unsafe. The selected
 * fact was matched to the idea during planning, so literal word overlap is
 * not used as a proxy for meaning.
 */
export function getWallTextGroundingIssue(params: {
  grounding: WallTextFactGrounding;
  text: string;
}) {
  const normalizedText = normalizeForComparison(params.text);

  if (
    params.grounding.factSnapshot.claimsToAvoid.some((claim) => {
      const normalizedClaim = normalizeForComparison(claim);
      return normalizedClaim.length >= 5 && normalizedText.includes(normalizedClaim);
    })
  ) {
    return "forbidden_claim";
  }

  if (hasUnsupportedHighRiskClaim(params.text, params.grounding.assignedFact.text)) {
    return "unsupported_business_claim";
  }

  return null;
}

function parseFactSnapshot(value: unknown): BusinessFactSnapshot {
  const record = asRecord(value);
  if (record?.version !== "business-facts-v1" || !Array.isArray(record.facts)) {
    throw new Error("Wall-of-text fact snapshot is invalid.");
  }
  if (!Array.isArray(record.claimsToAvoid) || record.facts.length > 12) {
    throw new Error("Wall-of-text fact snapshot is invalid.");
  }

  const facts = record.facts.map(parseFact);
  const ids = new Set(facts.map((fact) => fact.id));
  if (ids.size !== facts.length) {
    throw new Error("Wall-of-text fact snapshot contains duplicate fact IDs.");
  }

  const claimsToAvoid = record.claimsToAvoid.map((claim) => {
    if (typeof claim !== "string" || !claim.trim()) {
      throw new Error("Wall-of-text fact snapshot is invalid.");
    }
    return claim.trim().replace(/\s+/gu, " ").slice(0, 360);
  });

  return { claimsToAvoid, facts, version: "business-facts-v1" };
}

function parseFact(value: unknown): ApprovedBusinessFact {
  const record = asRecord(value);
  const type = record?.type;
  if (
    !record ||
    typeof record.id !== "string" ||
    !record.id.trim() ||
    typeof record.text !== "string" ||
    !record.text.trim() ||
    ![
      "audience",
      "capability",
      "differentiator",
      "outcome",
      "pain",
    ].includes(String(type))
  ) {
    throw new Error("Wall-of-text fact assignment is invalid.");
  }
  return {
    id: record.id.trim().slice(0, 120),
    text: record.text.trim().replace(/\s+/gu, " ").slice(0, 360),
    type: type as ApprovedBusinessFact["type"],
  };
}

function sameFact(left: ApprovedBusinessFact, right: ApprovedBusinessFact) {
  return left.id === right.id && left.text === right.text && left.type === right.type;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeForComparison(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasUnsupportedHighRiskClaim(text: string, factText: string) {
  const normalizedFact = normalizeForComparison(factText);
  const supports = (...phrases: readonly string[]) =>
    phrases.some((phrase) => normalizedFact.includes(phrase));

  if (
    /\b(?:automatically|automatic|autopilot|hands[-\s]?free)\b/iu.test(text) &&
    !supports("automatically", "automatic", "autopilot", "hands free")
  ) {
    return true;
  }
  if (
    /\b(?:actual|exact|accurate|precise|100\s*%|guarantee(?:d|s)?)\b/iu.test(text) &&
    !supports("actual", "exact", "accurate", "precise", "100", "guarantee")
  ) {
    return true;
  }
  if (
    /\b(?:instant|instantly)\b/iu.test(text) &&
    !supports("instant", "instantly")
  ) {
    return true;
  }
  return false;
}
