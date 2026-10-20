import type { BackgroundJobRow } from "../types.js";
import {
  EmptyWallTextContentPlanResponseError,
  WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE,
  createWallTextContentIdeaFingerprint,
  createWallTextCreativeBriefFingerprint,
  generateWallTextContentPlanChunk,
} from "../lib/wall-text-content-plan.js";
import { RetryableJobError } from "../retryable-job-error.js";
import { logger } from "../logger.js";
import { enqueueWallTextPlanPublicationTask } from "../lib/wall-text-plan-publication-dispatch.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";

type ContentPlanJobInput = {
  operation: "wall_text_content_plan_generation";
  planId: string;
  userId: string;
};

export async function runGenerateWallTextContentPlanJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
  dependencies: {
    generateChunk: typeof generateWallTextContentPlanChunk;
    enqueuePublication?: (params: {
      planId: string;
      publicationId: string;
    }) => Promise<unknown>;
  } = {
    generateChunk: generateWallTextContentPlanChunk,
    enqueuePublication: enqueueWallTextPlanPublicationTask,
  },
): Promise<WorkerJobOutput> {
  const input = parseInput(job);
  if (!job.claim_token) throw new Error("Wall-of-text planner requires a worker claim.");
  const plan = await context.store.getWallTextContentPlan({
    jobId: job.id,
    planId: input.planId,
    userId: input.userId,
  });

  if (!plan) throw new Error("Wall-of-Text content plan was not found for this job.");

  if (plan.status === "active") {
    const existingItems = await context.store.listWallTextContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });
    return { itemCount: existingItems.length, ok: true, planId: plan.id };
  }
  if (plan.status !== "generating") {
    throw new Error(`Wall-of-Text content plan cannot run from status ${plan.status}.`);
  }

  let failureDiagnosticRecorded = false;
  try {
    let items = await context.store.listWallTextContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });
    const priorCycleItems = await context.store.listPriorWallTextContentPlanItems({
      businessProfileId: plan.business_profile_id,
      businessProfileVersion: plan.business_profile_version,
      periodStartDate: plan.period_start_date,
      userId: plan.user_id,
    });
    assertContiguousItems(items.map((item) => item.sequence_index));
    if (items.length % 5 !== 0) {
      throw new Error("Wall-of-Text plan items are not grouped into complete creative briefs.");
    }

    while (items.length < plan.target_item_count) {
      const count = Math.min(
        WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE,
        plan.target_item_count - items.length,
      );
      let generated: Awaited<
        ReturnType<typeof generateWallTextContentPlanChunk>
      >;
      const chunkStartedAt = Date.now();
      try {
        generated = await dependencies.generateChunk({
          businessDescription: plan.business_description,
          briefIndexStart: items.length / 5 + 1,
          count,
          existingItems: [...priorCycleItems, ...items],
          planningContext: plan.planning_context,
        });
      } catch (error) {
        failureDiagnosticRecorded = await recordPlannerFailureDiagnostic({
          context,
          error,
          job,
          planId: plan.id,
          userId: plan.user_id,
        });
        throw toWallTextContentPlanRetry(error);
      }
      const sequenceStart = items.length + 1;
      const briefIndexStart = items.length / 5 + 1;
      const inserted = await context.store.persistWallTextContentPlanBriefChunk({
        jobId: job.id,
        claimToken: job.claim_token,
        expectedItemCount: items.length,
        briefs: generated.briefs.map((brief) => ({
          audience_context: brief.audienceContext,
          brief_fingerprint: createWallTextCreativeBriefFingerprint(brief),
          brief_index: briefIndexStart + brief.briefSlotIndex,
          creative_seed: brief.creativeSeed,
          emotional_tension: brief.emotionalTension,
          human_moment: brief.humanMoment,
          // The existing database column is retained for legacy plans only.
          // New freeform plans do not send this value to the Wall writer.
          preferred_format_family: "freeform",
          supported_angle: brief.supportedAngle,
        })),
        items: generated.items.map((item) => ({
          brief_index: briefIndexStart + item.briefSlotIndex,
          content_idea: item.contentIdea,
          feeling: item.feeling,
          idea_fingerprint: createWallTextContentIdeaFingerprint(item.contentIdea),
          private_context: item.planningBrief,
          sequence_index:
            sequenceStart +
            item.briefSlotIndex * 5 +
            item.itemSlotIndex,
        })),
        planId: plan.id,
        userId: plan.user_id,
      });

      if (inserted.length !== count) {
        throw new Error("Wall-of-Text content-plan chunk persistence was incomplete.");
      }
      items = [...items, ...inserted].sort(
        (left, right) => left.sequence_index - right.sequence_index,
      );

      logger.info("Wall content-plan chunk saved", {
        jobId: job.id,
        planId: plan.id,
        chunkItemCount: count,
        savedItemCount: items.length,
        targetItemCount: plan.target_item_count,
        durationMs: Date.now() - chunkStartedAt,
      });

      await context.checkpoint({
        progress: Math.min(
          95,
          Math.round((items.length / plan.target_item_count) * 90),
        ),
        stage: "generating_wall_text_content_plan",
        status: "waiting_external_service",
      });

      if (plan.early_delivery_enabled) {
        // The commit above already created the publication outbox row. Queue a
        // deterministic Cloud Task for that row; the five-minute scan remains
        // responsible only for the crash window before this dispatch succeeds.
        try {
          const publication = await context.store.getWallTextPlanPublication({
            itemCount: items.length,
            planId: plan.id,
            userId: plan.user_id,
          });

          if (!publication) {
            throw new Error("The committed Wall-of-Text publication outbox row was not found.");
          }

          await (dependencies.enqueuePublication ?? enqueueWallTextPlanPublicationTask)({
            planId: plan.id,
            publicationId: publication.id,
          });
        } catch (error) {
          logger.warn("Wall plan publication task will be recovered if dispatch is unavailable", {
            planId: plan.id, savedItemCount: items.length,
            error: error instanceof Error ? error.message : "Publication task dispatch failed",
          });
        }
      }
    }

    const activated = await context.store.completeWallTextContentPlanGeneration({
      claimToken: job.claim_token,
      jobId: job.id,
      planId: plan.id,
      userId: plan.user_id,
    });
    return {
      itemCount: items.length,
      ok: true,
      planId: activated.id,
      status: activated.status,
    };
  } catch (error) {
    if (!failureDiagnosticRecorded) {
      await recordPlannerFailureDiagnostic({
        context,
        error,
        job,
        planId: plan.id,
        userId: plan.user_id,
      });
    }
    throw error;
  }
}

async function recordPlannerFailureDiagnostic(params: {
  context: WorkerJobContext;
  error: unknown;
  job: BackgroundJobRow;
  planId: string;
  userId: string;
}) {
  const diagnostic = describePlannerFailure(params.error);
  try {
    await params.context.store.recordWallTextFailureDiagnostic({
      backgroundJobId: params.job.id,
      contentPlanId: params.planId,
      details: diagnostic.details,
      errorCode: diagnostic.errorCode,
      errorMessage: getErrorMessage(params.error),
      retryable: diagnostic.retryable,
      stage: diagnostic.stage,
      userId: params.userId,
    });
    return true;
  } catch (recordError) {
    logger.warn("Could not record private Wall planner diagnostic", {
      error: getErrorMessage(recordError),
      jobId: params.job.id,
      planId: params.planId,
    });
    return false;
  }
}

function describePlannerFailure(error: unknown) {
  const record = asRecord(error);
  const status = getNumber(record?.status) ?? getNumber(record?.statusCode);
  const providerCode = getString(record?.code) ?? getString(record?.error_code);
  const providerType = getString(record?.type) ?? getString(record?.error_type);
  const message = getErrorMessage(error);
  const name = error instanceof Error ? error.name : typeof error;
  const normalizedMessage = message.toLowerCase();
  const billingCode = providerCode?.toLowerCase();

  let errorCode = "wall_text_planner_failed";
  let retryable = false;
  let stage = "planner";
  if (error instanceof EmptyWallTextContentPlanResponseError) {
    errorCode = "model_output_empty";
    retryable = true;
    stage = "parser";
  } else if (/model refused the request/i.test(message)) {
    errorCode = "model_output_refusal";
    stage = "parser";
  } else if (status === 400) {
    errorCode = "wall_text_provider_invalid_request";
  } else if (status === 401 || status === 403) {
    errorCode = "wall_text_provider_authentication_failed";
  } else if (status === 429 && [
    "credit_balance_exhausted",
    "organization_spend_limit_exceeded",
    "project_spend_limit_exceeded",
    "organization_usage_limit_exceeded",
  ].includes(billingCode ?? "")) {
    errorCode = "wall_text_provider_billing_limit";
  } else if (status === 429 || name === "RateLimitError") {
    errorCode = "wall_text_provider_rate_limited";
    retryable = true;
  } else if (
    status === 408 ||
    (status !== null && status >= 500) ||
    ["APIConnectionError", "APIConnectionTimeoutError", "APITimeoutError", "InternalServerError", "AbortError"].includes(name) ||
    /request timed out|network error|connection reset/i.test(message)
  ) {
    errorCode = "wall_text_provider_transient";
    retryable = true;
  } else if (
    /content-plan response|json|schema|briefs?\.|ideas?\./i.test(normalizedMessage)
  ) {
    errorCode = "model_output_schema_invalid";
    retryable = true;
    stage = "parser";
  } else if (/persist|claim|constraint|column .* does not exist/i.test(normalizedMessage)) {
    errorCode = "wall_text_persistence_rejected";
    stage = "persistence";
  }

  return {
    details: {
      candidateRejections: [],
      errorName: name.slice(0, 120),
      finishReason: error instanceof EmptyWallTextContentPlanResponseError
        ? error.finishReason
        : null,
      providerErrorCode: providerCode,
      providerErrorType: providerType,
      providerRequestId: getString(record?.request_id) ?? getString(record?._request_id),
      providerStatus: status,
    },
    errorCode,
    retryable,
    stage,
  };
}

export function toWallTextContentPlanRetry(error: unknown) {
  if (error instanceof RetryableJobError) return error;

  const diagnostic = describePlannerFailure(error);
  if (diagnostic.retryable) {
    return new RetryableJobError(
      "The Wall-of-Text content-plan request will resume from its last saved chunk.",
      {
        code: diagnostic.errorCode,
        retryAfterSeconds: 45,
      },
    );
  }

  const terminal = error instanceof Error
    ? error
    : new Error(getErrorMessage(error));
  return Object.assign(terminal, { code: diagnostic.errorCode });
}

function parseInput(job: BackgroundJobRow): ContentPlanJobInput {
  const value = job.input_json;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Wall-of-Text content-plan job input must be an object.");
  }
  if (
    value.operation !== "wall_text_content_plan_generation" ||
    typeof value.planId !== "string" ||
    !value.planId.trim() ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    value.userId !== job.user_id
  ) {
    throw new Error("Wall-of-Text content-plan job input is invalid.");
  }
  return {
    operation: value.operation,
    planId: value.planId,
    userId: value.userId,
  };
}

function assertContiguousItems(sequenceIndexes: number[]) {
  for (const [index, sequenceIndex] of sequenceIndexes.entries()) {
    if (sequenceIndex !== index + 1) {
      throw new Error("Wall-of-Text content-plan items are not contiguous.");
    }
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
