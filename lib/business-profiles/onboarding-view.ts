import type { BusinessProfileRecord } from "./db";
import { isBusinessProfileOnboardingComplete } from "./onboarding-access";
import { BUSINESS_PROFILE_ONBOARDING_VERSION, getMissingBusinessProfileOnboardingFields } from "./schema";

/** Shared website/IDE projection; never expose the owner or internal analysis fields. */
export function toClientOnboardingProfile(profile: BusinessProfileRecord) {
  const onboardingComplete = isBusinessProfileOnboardingComplete(profile);
  return {
    analysisConfidence: profile.context.confidence,
    analysisSummary: profile.context.productSummary,
    businessName: profile.context.businessName,
    id: profile.id,
    intakeType: profile.intakeType,
    logoStorageKey: profile.logoStorageKey,
    logoUrl: profile.logoUrl,
    onboardingComplete,
    onboardingCompletedAt: profile.onboardingCompletedAt,
    onboardingMissingFields: [
      ...getMissingBusinessProfileOnboardingFields(profile.context),
      ...(profile.primaryGoals.length > 0 ? [] : ["primaryGoals"]),
    ],
    onboardingRequiredVersion: BUSINESS_PROFILE_ONBOARDING_VERSION,
    onboardingStep: profile.onboardingStep,
    onboardingStatus: onboardingComplete ? "completed" as const : "incomplete" as const,
    onboardingVersion: profile.onboardingVersion,
    preparationError: profile.preparationError,
    preparationStatus: profile.preparationStatus,
    primaryGoal: profile.primaryGoal,
    primaryGoals: profile.primaryGoals,
    profileVersion: profile.profileVersion,
  };
}
