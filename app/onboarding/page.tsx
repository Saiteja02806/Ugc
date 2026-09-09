import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth/auth-guard";
import { BackgroundBusinessOnboarding } from "@/components/business-profiles/background-business-onboarding";

export const metadata: Metadata = {
  title: "Business profile",
  description:
    "Create the business context used to personalize Trending.",
};

export default function OnboardingPage() {
  return (
    <AuthGuard requireBusinessProfile={false}>
      <BackgroundBusinessOnboarding />
    </AuthGuard>
  );
}
