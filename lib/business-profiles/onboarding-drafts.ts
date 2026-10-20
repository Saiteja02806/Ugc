import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getBusinessProfileForUser, isBusinessProfileOnboardingComplete } from "./db";
import type { BusinessLogoAsset } from "./logo";
import type { OnboardingSession, OnboardingDraft } from "./onboarding-draft-contract";
import type { BusinessProfileSetupInput } from "./setup";
import { WebsiteBusinessAnalysisSchema } from "@/lib/website-analysis/schema";
import { getWebsiteAnalysisBySourceJobId } from "@/lib/website-analysis/supabase";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { dispatchQueuedBackgroundJobForRecovery, retryAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { prebuildTrendingAfterOnboarding } from "@/lib/trending/onboarding-prebuild";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { isBackgroundOnboardingEnabled } from "./onboarding-rollout";

type DraftRow = {
  id: string; user_id: string; revision: number; source_revision: number;
  source_input: BusinessProfileSetupInput; source_job_id: string;
  analysis_id: string | null; business_name: string; logo: BusinessLogoAsset | null;
  primary_goals: OnboardingDraft["primaryGoals"]; step: 2 | 3; timezone: string;
  submitted_at: string | null; completed_at: string | null; profile_id: string | null;
  finalization_job_id: string | null;
};

export class OnboardingDraftError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Business onboarding storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getOnboardingDraft(userId: string): Promise<DraftRow | null> {
  const { data, error } = await client().from("business_onboarding_drafts").select("*").eq("user_id", userId).maybeSingle();
  // Deploy compatible code before the additive migration without breaking onboarding.
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw error;
  return data as DraftRow | null;
}

export async function readOnboardingSession(userId: string): Promise<OnboardingSession> {
  const [draft, profile] = await Promise.all([getOnboardingDraft(userId), getBusinessProfileForUser(userId)]);
  if (draft) return { ok: true, mode: "background", draft: await toClientDraft(draft) };
  const { error } = await client().from("business_onboarding_drafts").select("id").limit(0);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") throw error;
  const { data: legacyJobs, error: jobsError } = await client().from("background_jobs").select("id")
    .eq("user_id", userId).eq("job_type", "media_analysis").contains("input_json", { operation: "business_profile_setup" }).limit(1);
  if (jobsError) throw jobsError;
  return { ok: true, mode: profile || error || legacyJobs?.length || !isBackgroundOnboardingEnabled(userId) ? "legacy" : "background", draft: null };
}

export async function mutateOnboardingDraft(userId: string, action: string, payload: Record<string, unknown>) {
  const { data, error } = await client().rpc("mutate_business_onboarding_v1", {
    p_user_id: userId, p_action: action, p_payload: payload,
  });
  if (error) {
    if (/onboarding_revision_conflict/.test(error.message)) throw new OnboardingDraftError("Your setup changed in another request. Reload your saved progress before continuing.");
    if (/onboarding_legacy_profile/.test(error.message)) throw new OnboardingDraftError("Your saved profile uses the existing setup. Reload to continue.");
    if (/onboarding_draft_not_found/.test(error.message)) throw new OnboardingDraftError("This onboarding session is no longer available.", 404);
    console.error("Onboarding transition failed", { action, code: error.code, message: error.message });
    throw new OnboardingDraftError("Could not save your setup. Reload your saved progress and try again.");
  }
  return data as DraftRow;
}

export async function dispatchOnboardingJobs(draft: DraftRow) {
  // Jobs were committed inside the same transaction as the accepted draft.
  // Failed publication leaves them queued for the existing recovery scheduler.
  await Promise.all([draft.source_job_id, draft.finalization_job_id].filter((id): id is string => !!id).map(async id => {
    const job = await getBackgroundJobForUser({ jobId: id, userId: draft.user_id });
    if (job) await dispatchQueuedBackgroundJobForRecovery(job);
  }));
}

export async function retryOnboardingJob(userId: string, draftId: string) {
  const draft = await getOnboardingDraft(userId);
  if (!draft || draft.id !== draftId) throw new OnboardingDraftError("This onboarding session is no longer available.", 404);
  const jobId = draft.analysis_id ? draft.finalization_job_id : draft.source_job_id;
  if (!jobId) throw new OnboardingDraftError("There is no setup job to retry.");
  const job = await getBackgroundJobForUser({ jobId, userId });
  if (job && (job.status === "failed" || job.status === "stalled")) {
    await retryAndDispatchBackgroundJob({ jobId, userId });
  } else if (job?.status === "queued") {
    await dispatchOnboardingJobs(draft);
  }
}

export async function toClientDraft(draft: DraftRow): Promise<OnboardingDraft> {
  const [analysisJob, finalizationJob, analysis] = await Promise.all([
    getBackgroundJobForUser({ jobId: draft.source_job_id, userId: draft.user_id }),
    draft.finalization_job_id ? getBackgroundJobForUser({ jobId: draft.finalization_job_id, userId: draft.user_id }) : null,
    draft.analysis_id ? getWebsiteAnalysisBySourceJobId({ sourceJobId: draft.source_job_id, userId: draft.user_id }) : null,
  ]);
  return {
    id: draft.id, revision: draft.revision, sourceRevision: draft.source_revision, sourceInput: draft.source_input,
    businessName: draft.business_name, suggestedName: analysis?.analysis.businessName ?? null,
    logoStorageKey: draft.logo?.storageKey ?? null, logoUrl: draft.logo?.url ?? null,
    primaryGoals: draft.primary_goals, step: draft.step, submitted: !!draft.submitted_at,
    completed: !!draft.completed_at, analysisReady: !!draft.analysis_id,
    analysisJob: analysisJob ? getPublicBackgroundJob(analysisJob) : null,
    finalizationJob: finalizationJob ? getPublicBackgroundJob(finalizationJob) : null,
  };
}

export async function finalizeOnboardingJob(params: { userId: string; jobId: string; draftId: string; sourceRevision: number }) {
  const draft = await getOnboardingDraft(params.userId);
  if (!draft || draft.id !== params.draftId || draft.source_revision !== params.sourceRevision || draft.finalization_job_id !== params.jobId) {
    return { operation: "business_profile_setup", skipped: "superseded" };
  }
  const stored = await getWebsiteAnalysisBySourceJobId({ sourceJobId: draft.source_job_id, userId: params.userId });
  if (!stored || stored.id !== draft.analysis_id) throw new Error("Onboarding analysis is not ready.");
  // Validate provider output again before granting access or starting the trial.
  WebsiteBusinessAnalysisSchema.parse(stored.analysis);
  const saved = await mutateOnboardingDraft(params.userId, "finalize", { draftId: draft.id,
    sourceRevision: params.sourceRevision, jobId: params.jobId, analysis: stored.analysis });
  if (!saved.completed_at || saved.finalization_job_id !== params.jobId) return { operation: "business_profile_setup", skipped: "superseded" };
  const profile = await getBusinessProfileForUser(params.userId);
  if (!profile || profile.id !== saved.profile_id || !isBusinessProfileOnboardingComplete(profile)) throw new Error("Finalized profile is unavailable.");
  const results = await prebuildTrendingAfterOnboarding({ profile, timezone: saved.timezone, includeHookVideos: areTrendingHookVideosEnabled() });
  if (results.some(result => result.status === "failed")) throw new Error("Onboarding completed; content preparation needs a retry.");
  return { operation: "business_profile_setup", profileId: profile.id, profileVersion: profile.profileVersion };
}
