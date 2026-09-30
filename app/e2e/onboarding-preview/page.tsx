"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  StreamlinedProgressStep,
  StreamlinedSourceStep,
} from "@/components/business-profiles/background-business-onboarding";
import { OnboardingFrame } from "@/components/business-profiles/business-profile-onboarding";
import type { OnboardingDraft } from "@/lib/business-profiles/onboarding-draft-contract";
import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";

function previewJob(status: PublicBackgroundJob["status"]): PublicBackgroundJob {
  const failed = status === "failed";

  return {
    cancelRequestedAt: null,
    completedAt: status === "completed" ? "2026-09-25T00:00:00.000Z" : null,
    createdAt: "2026-09-25T00:00:00.000Z",
    error: failed ? { code: "PREVIEW_ERROR", message: "Preview setup error", retryable: true } : null,
    failedAt: failed ? "2026-09-25T00:00:00.000Z" : null,
    id: `preview-${status}`,
    jobType: "media_analysis",
    output: null,
    outputReference: null,
    progress: null,
    projectId: "default-project",
    queuedAt: "2026-09-25T00:00:00.000Z",
    stage: null,
    startedAt: status === "queued" ? null : "2026-09-25T00:00:00.000Z",
    status,
    updatedAt: "2026-09-25T00:00:00.000Z",
  };
}

function OnboardingPreviewInner() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step") || "1";
  const [source, setSource] = useState<"manual" | "website">(
    step === "1-manual-error" ? "manual" : "website",
  );
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const failed = step === "2-error";
  const ready = step === "2-ready" || step === "2-complete";
  const previewSource = searchParams.get("source");
  const previewWebsiteUrl = previewSource === "app-store"
    ? "https://apps.apple.com/in/app/duolingo-language-chess/id570060128"
    : previewSource === "play-store"
      ? "https://play.google.com/store/apps/details?id=com.brainyscreenblocker"
      : websiteUrl || "https://duolingo.com/";

  const draft: OnboardingDraft = {
    analysisJob: previewJob(failed ? "failed" : ready ? "completed" : "processing"),
    analysisReady: ready,
    businessName: "",
    completed: step === "2-complete",
    finalizationJob: ready ? previewJob(step === "2-complete" ? "completed" : "processing") : null,
    id: "preview-onboarding-draft",
    logoStorageKey: null,
    logoUrl: null,
    primaryGoals: ["brand_awareness"],
    revision: 1,
    sourceInput: source === "manual"
      ? {
          businessName: businessName || "Moonlight Studio",
          description: description || "We help independent coaches turn client notes into clear, personalized programs.",
          experience: "streamlined",
          intakeType: "manual",
        }
      : { experience: "streamlined", intakeType: "website", websiteUrl: previewWebsiteUrl },
    sourceRevision: 1,
    step: 2,
    submitted: ready,
    suggestedName: source === "manual" ? businessName || "Moonlight Studio" : "Duolingo",
  };

  return (
    <OnboardingFrame minimal>
      {step === "1" || step === "1-manual-error" ? (
        <StreamlinedSourceStep
          businessName={businessName}
          description={description}
          error={step === "1-manual-error" ? "Unable to analyze that URL. Try entering your product details manually." : null}
          isSaving={false}
          source={source}
          websiteUrl={websiteUrl}
          onBusinessNameChange={setBusinessName}
          onDescriptionChange={setDescription}
          onSourceChange={setSource}
          onSubmit={(event) => event.preventDefault()}
          onWebsiteUrlChange={setWebsiteUrl}
        />
      ) : (
        <StreamlinedProgressStep
          draft={draft}
          error={null}
          isSaving={false}
          statusUnavailable={false}
          onChangeSource={() => {}}
          onContinue={() => {}}
          onRetry={() => {}}
        />
      )}
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
