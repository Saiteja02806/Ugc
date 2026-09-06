import assert from "node:assert/strict";
import test from "node:test";

import {
  getBusinessProfileOnboardingGate,
  isBusinessProfileOnboardingComplete,
} from "./onboarding-access.ts";
import {
  applyBusinessProfileOnboardingContext,
  applyPrimaryGoals,
  buildManualBusinessAnalysis,
  type PrimaryGoal,
} from "./schema.ts";

const context = applyPrimaryGoals(
  applyBusinessProfileOnboardingContext(
    buildManualBusinessAnalysis({
      businessName: "Temporary analyzer value",
      category: "Nutrition",
      mainProblem: "People struggle to plan meals",
      productSummary:
        "Meal Map helps people organize practical meal plans around their preferences.",
      targetAudience: "People who want meal planning help",
      valueProps: "Flexible meal ideas, Easier weekly planning",
    }),
    { businessName: "Meal Map" },
  ),
  ["increase_revenue", "brand_awareness"],
);

const completedProfile = {
  analysisId: "analysis-1",
  context,
  id: "profile-1",
  intakeType: "manual" as const,
  latestGenerationBatchId: null,
  logoFileSizeBytes: null,
  logoHeight: null,
  logoMimeType: null,
  logoStorageKey: null,
  logoUrl: null,
  logoWidth: null,
  onboardingCompletedAt: "2026-08-03T00:00:00.000Z",
  onboardingStep: 3 as const,
  onboardingStatus: "completed" as const,
  onboardingVersion: 3,
  preparationError: null,
  preparationStatus: "preparing" as const,
  primaryGoal: "increase_revenue" as const,
  primaryGoals: ["increase_revenue", "brand_awareness"] as PrimaryGoal[],
  profileVersion: 1,
  projectId: "default-project",
  trendingTimezone: null,
  trendingWalkthroughCompletedAt: null,
  userId: "user-1",
};

test("allows Trending only for a persisted v3 profile with a name and goal", () => {
  assert.equal(isBusinessProfileOnboardingComplete(completedProfile), true);
  assert.equal(getBusinessProfileOnboardingGate(completedProfile), null);
});

test("returns onboarding_required for a missing or incomplete profile", () => {
  assert.deepEqual(getBusinessProfileOnboardingGate(null), {
    code: "onboarding_required",
    message: "Complete the required business onboarding before using Trending.",
    status: 409,
  });

  const gate = getBusinessProfileOnboardingGate({
    ...completedProfile,
    onboardingCompletedAt: null,
    onboardingStatus: "incomplete",
    onboardingVersion: 0,
  });

  assert.equal(gate?.code, "onboarding_required");
  assert.equal(gate?.status, 409);
});

test("does not trust persisted completion when the business name is absent", () => {
  const gate = getBusinessProfileOnboardingGate({
    ...completedProfile,
    context: { ...completedProfile.context, businessName: null },
  });

  assert.equal(gate?.code, "onboarding_required");
});

test("does not trust persisted completion when no goals are selected", () => {
  const gate = getBusinessProfileOnboardingGate({
    ...completedProfile,
    primaryGoals: [],
  });

  assert.equal(gate?.code, "onboarding_required");
});
