import type { PrimaryGoal } from "./schema";
import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";

export type OnboardingDraft = {
  id: string;
  revision: number;
  sourceRevision: number;
  sourceInput: {
    intakeType: "website" | "manual" | "mobile_app_ai_prompt";
    websiteUrl?: string;
    aiIdeContext?: string;
    manual?: { businessName: string; brandTone?: string; category: string; mainProblem: string;
      productSummary: string; targetAudience: string; valueProps: string };
  };
  businessName: string;
  suggestedName: string | null;
  logoStorageKey: string | null;
  logoUrl: string | null;
  primaryGoals: PrimaryGoal[];
  step: 2 | 3;
  submitted: boolean;
  completed: boolean;
  analysisReady: boolean;
  analysisJob: PublicBackgroundJob | null;
  finalizationJob: PublicBackgroundJob | null;
};

export type OnboardingSession = {
  ok: true;
  mode: "background" | "legacy";
  draft: OnboardingDraft | null;
};

export type OnboardingAnalysisState = Pick<OnboardingDraft, "analysisReady" | "sourceInput"> & {
  analysisJob: Pick<PublicBackgroundJob, "status"> | null;
};

export function getOnboardingAnalysisLabel(draft: OnboardingAnalysisState, unavailable = false) {
  if (unavailable) return "We couldn't update the analysis status. Your saved details are safe.";
  if (draft.analysisReady) return "Website analysis complete.";
  const status = draft.analysisJob?.status;
  if (status === "failed" || status === "cancelled" || status === "stalled") {
    return "We couldn't analyze your website. Retry or enter your business details manually.";
  }
  if (status === "queued" || status === "created") {
    return "Your website analysis is queued. Keep going with your setup.";
  }
  return "Analyzing your website in the background. Keep going with your setup.";
}

export function isOnboardingJobFailed(job: Pick<PublicBackgroundJob, "status"> | null) {
  return job?.status === "failed" || job?.status === "stalled" || job?.status === "cancelled";
}
