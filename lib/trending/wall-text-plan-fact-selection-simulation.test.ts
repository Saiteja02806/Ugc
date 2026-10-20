import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";
import {
  buildWallTextPlanningContext,
} from "./wall-text-content-plan.ts";
import {
  buildWallTextFactGroundingAssignments,
  getWallTextGroundingIssue,
  selectWallTextGroundingFact,
  toWallTextGroundingMetadata,
} from "./wall-text-grounding.ts";

const ugcPilotAnalysis: WebsiteBusinessAnalysis = {
  brandTone: "Clear and practical",
  businessName: "UGC Pilot",
  businessModel: "b2b",
  campaignPurposes: ["product_discovery"],
  carouselAngles: [],
  categories: ["Social media marketing"],
  category: "Social media marketing",
  claimsToAvoid: [],
  confidence: "high",
  confidenceReason: "Owner-approved",
  ctaIdeas: [],
  differentiators: ["Manage several Instagram accounts from one workspace"],
  mainProblem: "Post approvals take too much of a marketing manager's day",
  mainPromise: "Make content planning easier to manage",
  missingInfo: [],
  painPoints: ["A final approval can hold up the rest of the day's work"],
  pexelsImageQueries: [],
  productSummary: "UGC Pilot helps teams prepare social content before publishing.",
  recommendedCarouselStructure: [],
  targetAudience: ["Marketing managers"],
  valueProps: [
    "Keep human approval before a post goes live",
    "Plan content for several Instagram accounts in one workspace",
  ],
  visualKeywords: [],
};

test("simulation: a plan-selected fact stays with its idea on the first write and a retry", () => {
  const planningContext = buildWallTextPlanningContext(ugcPilotAnalysis);
  const plannedFact = planningContext.approvedFactSnapshot.facts.find(
    (fact) => fact.text === "Keep human approval before a post goes live",
  );
  assert.ok(plannedFact, "The plan must choose from the saved approved facts.");

  // A reservation initially has a compatible canonical snapshot. The plan's
  // saved selectedFactId replaces only its positional placeholder before the
  // Writer sees it, and the same replacement is repeated on a retry.
  const reservationGrounding = buildWallTextFactGroundingAssignments({
    analysis: ugcPilotAnalysis,
    candidateIndexes: [0],
  }).get(0)!;
  assert.notEqual(reservationGrounding.assignedFact.id, plannedFact.id);

  const firstAttemptGrounding = selectWallTextGroundingFact(
    reservationGrounding,
    plannedFact.id,
  );
  const retryGrounding = selectWallTextGroundingFact(
    reservationGrounding,
    plannedFact.id,
  );
  assert.deepEqual(
    toWallTextGroundingMetadata(retryGrounding),
    toWallTextGroundingMetadata(firstAttemptGrounding),
  );

  // This is intentionally a natural paraphrase: it shares none of the old
  // two-word anchor requirement, but it says exactly what the selected fact
  // means in the plan's situation.
  const simulatedWriterCopy =
    "Before a post is published, the final check should feel quick and clear. UGC Pilot leaves the go-ahead with the team, so one decision does not consume the whole afternoon.";
  const words = simulatedWriterCopy.split(/\s+/u).filter(Boolean).length;
  assert.ok(words >= 24 && words <= 48);
  assert.equal(
    getWallTextGroundingIssue({
      grounding: firstAttemptGrounding,
      text: simulatedWriterCopy,
    }),
    null,
  );
});
