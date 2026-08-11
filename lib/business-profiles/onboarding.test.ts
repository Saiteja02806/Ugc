import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessProfileOnboardingContextSchema,
  PrimaryGoalSchema,
  PrimaryGoalsSchema,
  applyBusinessProfileOnboardingContext,
  applyPrimaryGoal,
  applyPrimaryGoals,
  buildManualBusinessAnalysis,
  deriveBusinessProfileOnboardingContext,
  getMissingBusinessProfileOnboardingFields,
} from "./schema.ts";

function createBaseAnalysis() {
  return buildManualBusinessAnalysis({
    brandTone: "Helpful",
    businessName: "Meal Map",
    category: "Nutrition",
    mainProblem: "People struggle to plan meals",
    productSummary:
      "Meal Map helps people organize practical meal plans around their preferences.",
    targetAudience: "People who want meal planning help",
    valueProps: "Flexible meal ideas, Easier weekly planning",
  });
}

test("business identity requires only the customer-facing business name", () => {
  assert.equal(
    BusinessProfileOnboardingContextSchema.safeParse({
      businessName: "Meal Map",
    }).success,
    true,
  );
  assert.equal(
    BusinessProfileOnboardingContextSchema.safeParse({
      businessName: "Meal Map",
      teamSize: "Just me",
    }).success,
    false,
  );
  assert.equal(
    BusinessProfileOnboardingContextSchema.safeParse({ businessName: "" })
      .success,
    false,
  );
});

test("goals accept multiple approved values without duplicates", () => {
  assert.equal(
    PrimaryGoalSchema.safeParse("increase_revenue").success,
    true,
  );
  assert.equal(
    PrimaryGoalSchema.safeParse("product_type").success,
    false,
  );
  assert.equal(
    PrimaryGoalsSchema.safeParse([
      "increase_revenue",
      "brand_awareness",
    ]).success,
    true,
  );
  assert.equal(PrimaryGoalsSchema.safeParse([]).success, false);
  assert.equal(
    PrimaryGoalsSchema.safeParse([
      "increase_revenue",
      "increase_revenue",
    ]).success,
    false,
  );
});

test("selected goals become predictable deduplicated campaign-purpose context", () => {
  assert.deepEqual(
    applyPrimaryGoal(createBaseAnalysis(), "increase_installs").campaignPurposes,
    ["app_install"],
  );
  assert.deepEqual(
    applyPrimaryGoal(createBaseAnalysis(), "increase_revenue").campaignPurposes,
    ["conversion"],
  );
  assert.deepEqual(
    applyPrimaryGoal(createBaseAnalysis(), "brand_awareness").campaignPurposes,
    ["product_discovery"],
  );
  assert.deepEqual(
    applyPrimaryGoals(createBaseAnalysis(), [
      "increase_revenue",
      "generate_leads",
      "increase_installs",
      "increase_engagement",
      "brand_awareness",
    ]).campaignPurposes,
    ["conversion", "app_install", "product_discovery", "education"],
  );
});

test("the business name override preserves analyzed facts and safety context", () => {
  const base = {
    ...createBaseAnalysis(),
    businessName: null,
    claimsToAvoid: ["Guaranteed health outcomes"],
  };
  const merged = applyBusinessProfileOnboardingContext(base, {
    businessName: "Meal Map",
  });

  assert.equal(merged.businessName, "Meal Map");
  assert.deepEqual(merged.targetAudience, base.targetAudience);
  assert.deepEqual(merged.valueProps, base.valueProps);
  assert.deepEqual(merged.claimsToAvoid, ["Guaranteed health outcomes"]);
});

test("the business name override upgrades profiles saved before targeting fields existed", () => {
  const legacyAnalysis: Partial<ReturnType<typeof createBaseAnalysis>> = {
    ...createBaseAnalysis(),
  };
  delete legacyAnalysis.businessModel;
  delete legacyAnalysis.campaignPurposes;
  delete legacyAnalysis.categories;
  const merged = applyBusinessProfileOnboardingContext(
    legacyAnalysis as ReturnType<typeof createBaseAnalysis>,
    { businessName: "Meal Map" },
  );

  assert.equal(merged.businessModel, null);
  assert.deepEqual(merged.campaignPurposes, []);
  assert.deepEqual(merged.categories, ["Nutrition"]);
});

test("analysis remains incomplete only while the business name is missing", () => {
  const unnamedAnalysis = { ...createBaseAnalysis(), businessName: null };

  assert.deepEqual(deriveBusinessProfileOnboardingContext(unnamedAnalysis), {
    businessName: "",
  });
  assert.deepEqual(getMissingBusinessProfileOnboardingFields(unnamedAnalysis), [
    "businessName",
  ]);

  const complete = applyBusinessProfileOnboardingContext(unnamedAnalysis, {
    businessName: "Meal Map",
  });
  assert.deepEqual(getMissingBusinessProfileOnboardingFields(complete), []);
});
