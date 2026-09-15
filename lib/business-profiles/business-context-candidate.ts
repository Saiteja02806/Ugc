import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";
import {
  buildBusinessFactSnapshot,
  type BusinessFactSnapshot,
} from "./fact-catalog.ts";

/**
 * Candidate preparation is deliberately deterministic and local. It verifies
 * that a staged context can ground future Wall-of-Text and Reaction content
 * without turning a Settings save into another model request or changing the
 * active profile.
 *
 * One approved fact is sufficient: generation rotates facts across requested
 * slots, so a short factual context remains usable without an arbitrary
 * minimum-fact rule. Zero facts is the one hard stop because no truthful
 * anchor can then be assigned.
 */
export type BusinessContextCandidateReadiness = {
  factCount: number;
  factSnapshot: BusinessFactSnapshot;
  status: "needs_facts" | "ready";
};

export function prepareBusinessContextCandidate(
  context: WebsiteBusinessAnalysis,
): BusinessContextCandidateReadiness {
  const factSnapshot = buildBusinessFactSnapshot(context);

  return {
    factCount: factSnapshot.facts.length,
    factSnapshot,
    status: factSnapshot.facts.length > 0 ? "ready" : "needs_facts",
  };
}

export function assertBusinessContextCandidateReady(
  context: WebsiteBusinessAnalysis,
) {
  const candidate = prepareBusinessContextCandidate(context);

  if (candidate.status !== "ready") {
    throw new Error("business_context_draft_needs_facts");
  }

  return candidate;
}
