"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";

import {
  BusinessIdentityStep,
  BusinessInformationStep,
  OnboardingFrame,
  PrimaryGoalStep,
} from "@/components/business-profiles/business-profile-onboarding";

function OnboardingPreviewInner() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step") || "1";
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const [intakeType, setIntakeType] = useState<"manual" | "mobile_app_ai_prompt" | "website">("website");
  const [websiteUrl, setWebsiteUrl] = useState("https://acmeai.com");
  const [aiIdeContext, setAiIdeContext] = useState("");
  const [manual, setManual] = useState({
    brandTone: "Friendly & bold",
    businessName: "Acme AI",
    category: "Productivity",
    mainProblem: "Writing video hooks takes hours every day.",
    productSummary: "AI copilot that generates high-converting short-form video hooks in seconds.",
    targetAudience: "Solopreneurs and creator brands.",
    valueProps: "10x faster hook generation\nProven viral structures\nOne-click export",
  });
  const [businessName, setBusinessName] = useState("Acme AI");
  const [primaryGoals, setPrimaryGoals] = useState<
    (
      | "increase_revenue"
      | "generate_leads"
      | "increase_signups"
      | "increase_installs"
      | "grow_views"
      | "brand_awareness"
      | "grow_following"
      | "increase_engagement"
      | "website_traffic"
      | "product_launch"
    )[]
  >(
    stepParam === "3-selected"
      ? ["increase_revenue", "increase_signups", "brand_awareness"]
      : [],
  );

  return (
    <OnboardingFrame>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-floating transition-all duration-300">
        <div
          className="h-1.5 bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
          aria-hidden="true"
        />

        {stepParam === "1" ? (
          <BusinessInformationStep
            aiIdeContext={aiIdeContext}
            copied={false}
            error={null}
            intakeType={intakeType}
            isSaving={false}
            manual={manual}
            websiteUrl={websiteUrl}
            onAiIdeContextChange={setAiIdeContext}
            onCopyPrompt={() => {}}
            onIntakeTypeChange={setIntakeType}
            onManualChange={setManual}
            onWebsiteUrlChange={setWebsiteUrl}
          />
        ) : null}

        {stepParam === "2" ? (
          <BusinessIdentityStep
            businessName={businessName}
            error={null}
            headingRef={headingRef}
            isSaving={false}
            logoPreviewUrl={null}
            profile={{
              analysisConfidence: "high",
              analysisSummary: "AI copilot that automates short-form video creative generation for high growth brands.",
              businessName: "Acme AI",
              id: "preview-id",
              intakeType: "website",
              logoStorageKey: null,
              logoUrl: null,
              onboardingComplete: false,
              onboardingCompletedAt: null,
              onboardingMissingFields: [],
              onboardingRequiredVersion: 1,
              onboardingStep: 2,
              onboardingStatus: "incomplete",
              onboardingVersion: 1,
              preparationError: null,
              preparationStatus: "preparing",
              primaryGoal: null,
              primaryGoals: [],
              profileVersion: 1,
            }}
            onBack={() => {}}
            onBusinessNameChange={setBusinessName}
            onLogoChange={() => {}}
            onRemoveLogo={() => {}}
          />
        ) : null}

        {stepParam === "3" || stepParam === "3-selected" ? (
          <PrimaryGoalStep
            error={null}
            headingRef={headingRef}
            isSaving={false}
            primaryGoals={primaryGoals}
            onBack={() => {}}
            onPrimaryGoalToggle={(val) => {
              setPrimaryGoals((current) =>
                current.includes(val)
                  ? current.filter((g) => g !== val)
                  : [...current, val],
              );
            }}
          />
        ) : null}
      </div>
    </OnboardingFrame>
  );
}

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <OnboardingPreviewInner />
    </Suspense>
  );
}
