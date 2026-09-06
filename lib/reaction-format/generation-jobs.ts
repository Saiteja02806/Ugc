import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  attachQueueMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  getBackgroundJobById,
  listBackgroundJobsForUser,
  markBackgroundJobFailed,
  type BackgroundJobRecord,
} from "@/lib/jobs/background-jobs";
import { retryAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { getQueueNameForJobType, sendJobMessage } from "@/lib/queues/job-queue";

const REACTION_GENERATION_JOB_TYPE = "reaction_generation";
const REACTION_CATALOG_UNAVAILABLE_MESSAGE =
  "Reaction generation requires active alpha clips and active backgrounds.";

type ReactionCatalogDatabase = {
  public: {
    Tables: {
      reaction_background_assets: {
        Row: { id: string; status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reaction_clip_assets: {
        Row: { has_alpha: boolean; id: string; status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let reactionCatalogClient: SupabaseClient<ReactionCatalogDatabase> | null = null;

export type ReactionRefillResult =
  | { job: BackgroundJobRecord; kind: "job" }
  | {
      kind: "coverage_shortfall";
      message: string;
      missingCount: number;
      readyCount: number;
      requestedCount: number;
    };

export async function enqueueTrendingReactionRefill(
  profile: BusinessProfileRecord,
  params: {
    currentActiveCount: number;
    dailyFeedKey: string;
    requestedCount: number;
  },
): Promise<ReactionRefillResult> {
  const requestedCount = Math.max(1, Math.min(12, Math.trunc(params.requestedCount)));
  const currentActiveCount = Math.max(0, Math.trunc(params.currentActiveCount));
  const requestPrefix = getReactionRequestPrefix(profile, params.dailyFeedKey);
  const existingJobs = await listBackgroundJobsForUser({
    jobType: REACTION_GENERATION_JOB_TYPE,
    limit: 100,
    userId: profile.userId,
  });
  const coverageShortfall = getCompletedReactionCoverageShortfall({
    jobs: existingJobs,
    profile,
    requestPrefix,
  });
  if (coverageShortfall) return coverageShortfall;

  const requestKey = `${requestPrefix}active-${currentActiveCount}:need-${requestedCount}`;
  const creation = await createBackgroundJobWithCreationResult({
    idempotencyKey: `reaction-generation:${profile.userId}:${requestKey}`,
    input: {
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      generationContext: buildReactionGenerationContext(profile),
      projectId: profile.projectId,
      requestKey,
      requestedCount,
      userId: profile.userId,
    },
    jobType: REACTION_GENERATION_JOB_TYPE,
    maxAttempts: 3,
    projectId: profile.projectId,
    queueName: getQueueNameForJobType(REACTION_GENERATION_JOB_TYPE),
    userId: profile.userId,
  });
  const job = creation.job;

  if (!isMatchingReactionGenerationJob(job, profile, requestKey)) {
    throw new Error("Reaction generation job ownership does not match the requested Trending refill.");
  }

  const retriedJob = await retryCatalogBlockedReactionJob({ job, profile });
  if (retriedJob) return { job: retriedJob, kind: "job" };

  if (job.status === "completed" || job.status === "failed") return { job, kind: "job" };
  if (!shouldDeliverCarouselJobMessage({ job, wasJustCreated: creation.created })) return { job, kind: "job" };

  const claimed = await claimBackgroundJobDelivery(job);
  if (!claimed) return { job, kind: "job" };
  try {
    await sendBackgroundJobMessageWithBestEffortAttachment({
      attachMessage: (queueMessageId) => attachQueueMessageToBackgroundJob({ jobId: job.id, queueMessageId }),
      jobId: job.id,
      onAttachmentError: (error) => {
        console.error("Reaction job was sent but its queue message id could not be persisted:", error);
      },
      sendMessage: () => sendJobMessage({ jobId: job.id, jobType: REACTION_GENERATION_JOB_TYPE }),
    });
  } catch (error) {
    if (creation.created) {
      await markBackgroundJobFailed({
        errorMessage: error instanceof Error ? error.message : "Could not queue Reaction generation.",
        jobId: job.id,
      }).catch((persistenceError) => {
        console.error("Could not save Reaction enqueue failure:", persistenceError);
      });
    }
    throw error;
  }
  return { job: (await getBackgroundJobById(job.id)) ?? job, kind: "job" };
}

/**
 * A catalog import can legitimately happen after a user requested their daily
 * Reaction refill.  Retry only that precise, pre-planning failure once the
 * catalog is actually available.  Other failures remain user-retryable rather
 * than being retried on every Trending page load.
 */
async function retryCatalogBlockedReactionJob(params: {
  job: BackgroundJobRecord;
  profile: Pick<BusinessProfileRecord, "userId">;
}) {
  if (
    params.job.status !== "failed" ||
    params.job.errorMessage !== REACTION_CATALOG_UNAVAILABLE_MESSAGE ||
    params.job.attemptCount >= params.job.maxAttempts ||
    !(await hasActiveReactionCatalog())
  ) {
    return null;
  }

  try {
    return await retryAndDispatchBackgroundJob({
      jobId: params.job.id,
      userId: params.profile.userId,
    });
  } catch (error) {
    // Concurrent feed loads can race to retry the same failed job.  The
    // database retry RPC permits exactly one transition; the other request
    // should reuse the now-queued job rather than turn the feed into an error.
    const current = await getBackgroundJobById(params.job.id);
    if (current && current.status !== "failed") return current;
    throw error;
  }
}

async function hasActiveReactionCatalog() {
  const client = getReactionCatalogClient();
  const [clips, backgrounds] = await Promise.all([
    client
      .from("reaction_clip_assets")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("has_alpha", true),
    client
      .from("reaction_background_assets")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  if (clips.error || backgrounds.error) {
    throw new Error(
      `Could not verify Reaction catalog availability: ${clips.error?.message ?? backgrounds.error?.message}`,
    );
  }

  return (clips.count ?? 0) > 0 && (backgrounds.count ?? 0) > 0;
}

function getReactionCatalogClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Reaction catalog storage is not configured.");
  }

  if (!reactionCatalogClient) {
    reactionCatalogClient = createClient<ReactionCatalogDatabase>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return reactionCatalogClient;
}

export function getCompletedReactionCoverageShortfall(params: {
  jobs: readonly BackgroundJobRecord[];
  profile: Pick<BusinessProfileRecord, "id" | "profileVersion">;
  requestPrefix: string;
}): Extract<ReactionRefillResult, { kind: "coverage_shortfall" }> | null {
  for (const job of params.jobs) {
    if (job.status !== "completed" || !isMatchingReactionCoverageJob(job, params.profile, params.requestPrefix)) {
      continue;
    }
    const output = asRecord(job.output);
    const requestedCount = numberValue(output?.requestedCount);
    const readyCount = numberValue(output?.readyCount);
    const failedCount = numberValue(output?.failedCount);
    const shortfallCount = numberValue(output?.shortfallCount);
    if (
      output?.status !== "partial" ||
      requestedCount === null ||
      readyCount === null ||
      failedCount !== 0 ||
      readyCount < 1 ||
      readyCount >= requestedCount ||
      shortfallCount !== requestedCount - readyCount
    ) {
      continue;
    }
    const missingCount = requestedCount - readyCount;
    return {
      kind: "coverage_shortfall",
      message: `Prepared ${readyCount} of ${requestedCount} Reaction Reels; ${missingCount} more need approved catalog coverage.`,
      missingCount,
      readyCount,
      requestedCount,
    };
  }
  return null;
}

function buildReactionGenerationContext(profile: BusinessProfileRecord) {
  const analysis = profile.context;
  return {
    audience: dedupe([...(analysis.targetAudience ?? []), ...(analysis.categories ?? []), analysis.category ?? ""]),
    commonSituations: dedupe([...(analysis.painPoints ?? []), analysis.mainProblem ?? ""]),
    desiredOutcomes: dedupe([...(analysis.valueProps ?? []), analysis.mainPromise ?? ""]),
    pains: dedupe([...(analysis.painPoints ?? []), analysis.productSummary ?? ""]),
    productName: analysis.businessName ?? null,
  };
}

function dedupe(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 12);
}

function isMatchingReactionGenerationJob(
  job: Awaited<ReturnType<typeof createBackgroundJobWithCreationResult>>["job"],
  profile: BusinessProfileRecord,
  requestKey: string,
) {
  const input = job.input;
  return (
    job.jobType === REACTION_GENERATION_JOB_TYPE &&
    job.userId === profile.userId &&
    job.projectId === profile.projectId &&
    Boolean(
      input && typeof input === "object" && !Array.isArray(input) &&
      input.businessProfileId === profile.id &&
      input.businessProfileVersion === profile.profileVersion &&
      input.requestKey === requestKey,
    )
  );
}

function isMatchingReactionCoverageJob(
  job: BackgroundJobRecord,
  profile: Pick<BusinessProfileRecord, "id" | "profileVersion">,
  requestPrefix: string,
) {
  const input = asRecord(job.input);
  return (
    job.jobType === REACTION_GENERATION_JOB_TYPE &&
    input?.businessProfileId === profile.id &&
    input.businessProfileVersion === profile.profileVersion &&
    typeof input.requestKey === "string" &&
    input.requestKey.startsWith(requestPrefix)
  );
}

function getReactionRequestPrefix(
  profile: Pick<BusinessProfileRecord, "profileVersion">,
  dailyFeedKey: string,
) {
  return `reaction-v1:${dailyFeedKey}:profile-${profile.profileVersion}:`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)
    ? value
    : null;
}
