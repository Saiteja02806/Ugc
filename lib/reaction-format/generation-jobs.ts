import "server-only";

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
import { getQueueNameForJobType, sendJobMessage } from "@/lib/queues/job-queue";

const REACTION_GENERATION_JOB_TYPE = "reaction_generation";

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
