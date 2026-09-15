import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";
import {
  buildWallTextFactGroundingAssignments,
  getWallTextGroundingIssue,
  parseWallTextFactGrounding,
  toWallTextGroundingMetadata,
} from "./wall-text-grounding.ts";

const analysis: WebsiteBusinessAnalysis = {
  brandTone: "Friendly and practical",
  businessName: "Meal Lens",
  businessModel: "b2c",
  campaignPurposes: ["product_discovery"],
  carouselAngles: [],
  categories: ["Nutrition"],
  category: "Nutrition",
  claimsToAvoid: ["Guaranteed weight loss"],
  confidence: "high",
  confidenceReason: "Owner-approved",
  ctaIdeas: [],
  differentiators: ["Ingredient estimates from a single meal photo"],
  mainProblem: "Manual meal logging takes too long",
  mainPromise: "Make meal tracking feel less manual",
  missingInfo: [],
  painPoints: ["Forgetting ingredients after eating"],
  pexelsImageQueries: [],
  productSummary: "A meal photo helps capture meal details",
  recommendedCarouselStructure: [],
  targetAudience: ["Busy people tracking meals"],
  valueProps: ["Turn a meal photo into a draft log"],
  visualKeywords: [],
};

test("cycles an immutable business fact snapshot across Wall slots", () => {
  const assignments = buildWallTextFactGroundingAssignments({
    analysis,
    candidateIndexes: [0, 1, 7],
  });

  const first = assignments.get(0)!;
  const second = assignments.get(1)!;
  const cycled = assignments.get(7)!;
  assert.equal(first.contextVersion, "wall-text-grounding-v2");
  assert.equal(first.factSnapshot.version, "business-facts-v1");
  assert.notEqual(first.assignedFact.id, second.assignedFact.id);
  assert.equal(cycled.assignedFact.id, first.assignedFact.id);
  assert.deepEqual(parseWallTextFactGrounding(first), first);
});

test("requires Business Context instead of creating generic new Wall copy with zero facts", () => {
  const emptyAnalysis: WebsiteBusinessAnalysis = {
    ...analysis,
    differentiators: [],
    mainProblem: "",
    mainPromise: "",
    painPoints: [],
    productSummary: "",
    targetAudience: [],
    valueProps: [],
  };
  const assignments = buildWallTextFactGroundingAssignments({
    analysis: emptyAnalysis,
    candidateIndexes: [0, 1],
  });
  assert.equal(assignments.size, 0);

  const feed = readFileSync(
    new URL("./trending-wall-text-feed.ts", import.meta.url),
    "utf8",
  );
  const guardIndex = feed.indexOf("wall_text_business_context_needed");
  const reservationIndex = feed.indexOf("reserveWallTextGenerationBatch({");
  assert.ok(guardIndex >= 0);
  assert.ok(reservationIndex > guardIndex);
});

test("requires a visible assigned-business anchor without another AI review", () => {
  const grounding = buildWallTextFactGroundingAssignments({
    analysis,
    candidateIndexes: [0],
  }).get(0)!;

  assert.equal(
    getWallTextGroundingIssue({
      grounding,
      text: "Taking a meal photo before eating makes the details easier to remember later.",
    }),
    null,
  );
  assert.equal(
    getWallTextGroundingIssue({
      grounding,
      text: "The little choices in a busy day can feel harder than they need to.",
    }),
    "missing_business_anchor",
  );
  assert.equal(
    getWallTextGroundingIssue({
      grounding,
      text: "A meal photo promises guaranteed weight loss without manual logging.",
    }),
    "forbidden_claim",
  );
  assert.equal(
    getWallTextGroundingIssue({
      grounding,
      text: "A meal photo automatically records every detail before the day gets busy.",
    }),
    "unsupported_business_claim",
  );

  assert.deepEqual(toWallTextGroundingMetadata(grounding), {
    anchorId: grounding.assignedFact.id,
    factSnapshotVersion: "business-facts-v1",
    factText: grounding.assignedFact.text,
    factType: grounding.assignedFact.type,
    version: "wall-text-grounding-v2",
  });
});

test("fails closed when a declared grounding assignment is altered", () => {
  const grounding = buildWallTextFactGroundingAssignments({
    analysis,
    candidateIndexes: [0],
  }).get(0)!;

  assert.throws(
    () =>
      parseWallTextFactGrounding({
        ...grounding,
        assignedFact: { ...grounding.assignedFact, text: "Invented capability" },
      }),
    /grounding assignment is invalid/i,
  );
});

test("sends only a server-assigned fact and the no-hallucination contract to the V2 writer", () => {
  const prompt = readFileSync(
    new URL("./wall-prompt.ts", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /Do not hallucinate\. Generate based only on the information available/i);
  assert.match(prompt, /APPROVED FACT SNAPSHOT/);
  assert.match(prompt, /assignedBusinessFact/);
  assert.match(prompt, /groundingRequired/);
  assert.match(prompt, /the assignedBusinessFact is the only business fact you may state/i);
});

test("database persistence rejects a swapped Wall fact snapshot or creative anchor", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260914121000_add_wall_text_grounding_v2.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /reaction_business_fact_snapshot_v1/i);
  assert.match(migration, /validate_wall_text_generation_assignment_grounding_v2/i);
  assert.match(migration, /focus_json->'factSnapshot' is distinct from canonical_snapshot/i);
  assert.match(migration, /validate_wall_text_creative_grounding_v2/i);
  assert.match(migration, /new\.text_content->'grounding' is distinct from expected_grounding/i);
  assert.match(migration, /revoke all on function[\s\S]+grant execute[\s\S]+service_role/i);
});
