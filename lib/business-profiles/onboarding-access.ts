import type { BusinessProfileRecord } from "./db.ts";
import {
  BUSINESS_PROFILE_ONBOARDING_VERSION,
  getMissingBusinessProfileOnboardingFields,
} from "./schema.ts";

export const BUSINESS_PROFILE_ONBOARDING_REQUIRED_CODE =
  "onboarding_required" as const;

export function isBusinessProfileOnboardingComplete(
  profile: Pick<
    BusinessProfileRecord,
    "context" | "onboardingStatus" | "onboardingVersion" | "primaryGoals"
  >,
) {
  return (
    profile.onboardingStatus === "completed" &&
    profile.onboardingVersion >= BUSINESS_PROFILE_ONBOARDING_VERSION &&
    profile.primaryGoals.length > 0 &&
    getMissingBusinessProfileOnboardingFields(profile.context).length === 0
  );
}

export function getBusinessProfileOnboardingGate(
  profile: BusinessProfileRecord | null,
) {
  return profile && isBusinessProfileOnboardingComplete(profile)
    ? null
    : {
        code: BUSINESS_PROFILE_ONBOARDING_REQUIRED_CODE,
        message:
          "Complete the required business onboarding before using Trending.",
        status: 409 as const,
      };
}
