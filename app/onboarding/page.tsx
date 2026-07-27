import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth/auth-guard";
import { BusinessProfileOnboarding } from "@/components/business-profiles/business-profile-onboarding";

export const metadata: Metadata = {
  title: "Business profile",
  description:
    "Create the business context used to personalize Trending.",
};

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <BusinessProfileOnboarding />
    </AuthGuard>
  );
}
