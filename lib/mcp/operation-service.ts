import "server-only";

import { z } from "zod";
import { getPublicBackgroundJob, isActiveBackgroundJobStatus, isRetryableBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getBackgroundJobForUser, type BackgroundJobRecord } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { getMcpStore } from "./store";
import { ToolFailure } from "./read-tools";

const safeCodes = new Set(["CANCELLED", "INPUT_INVALID", "OUTPUT_UPLOAD_FAILED", "PROVIDER_TIMEOUT",
  "QUEUE_DELIVERY_FAILED", "WORKER_STALLED", "PROVIDER_REFERENCE_IMAGE_REJECTED", "PROVIDER_CONTENT_MODERATION",
  "PROVIDER_INSUFFICIENT_CREDITS", "provider_submission_uncertain", "provider_operation_failed", "CONTENT_PREPARATION_UNAVAILABLE"]);

export async function getOperationForOwner(userId: string, jobId: string) {
  let job;
  try { job = await getBackgroundJobForUser({ userId, jobId }); }
  catch { throw new ToolFailure("OPERATIONS_UNAVAILABLE", "Job history is temporarily unavailable.", true); }
  if (!job || job.userId !== userId || job.jobType === "test_worker_job")
    throw new ToolFailure("NOT_FOUND", "Operation not found.");
  return job;
}

export function operationSummary(job: BackgroundJobRecord) {
  const publicJob = getPublicBackgroundJob(job);
  return {
    id: job.id, type: publicJob.jobType, status: job.status, project_id: job.projectId,
    progress: typeof job.progress === "number" && job.progress >= 0 && job.progress <= 100 ? job.progress : null,
    stage: job.stage, created_at: job.createdAt, updated_at: job.updatedAt,
    // Keep database timestamp precision; Date.toISOString() loses microseconds.
    expected_updated_at: job.updatedAt, attempt_count: job.attemptCount, max_attempts: job.maxAttempts,
    cancellation_requested_at: job.cancelRequestedAt,
    can_cancel: isActiveBackgroundJobStatus(job.status) && job.status !== "cancel_requested",
    can_retry: isRetryableBackgroundJob(job),
    error: publicJob.error ? { ...publicJob.error,
      code: safeCodes.has(publicJob.error.code) ? publicJob.error.code : "JOB_FAILED" } : null,
  };
}

export async function operationDetails(job: BackgroundJobRecord, userId: string) {
  const output = job.output && typeof job.output === "object" && !Array.isArray(job.output) ? job.output : {};
  const candidates = [output.mediaAssetId, output.outputAssetId, output.audioAssetId, output.assetId,
    ...(Array.isArray(output.mediaAssetIds) ? output.mediaAssetIds : [])];
  const output_asset_ids: string[] = [];
  if (job.status === "completed") {
    for (const id of [...new Set(candidates.filter((id): id is string => typeof id === "string" && z.uuid().safeParse(id).success))].slice(0, 20)) {
      let asset;
      try { asset = await getMediaAssetForOwner({ userId, assetId: id }); }
      catch { throw new ToolFailure("OPERATIONS_UNAVAILABLE", "Completed media is temporarily unavailable.", true); }
      if (asset?.status === "ready" && asset.user_id === userId) output_asset_ids.push(asset.id);
    }
  }
  const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input : {};
  const finishing_request_id = job.jobType === "render_demo_video" && job.projectId === "explore" &&
    input.version === 1 && input.userId === userId && typeof input.requestKey === "string" &&
    z.uuid().safeParse(input.requestKey).success && job.idempotencyKey === `explore-finish:${input.requestKey}`
    ? input.requestKey : null;
  return { operation: operationSummary(job), output_asset_ids, finishing_request_id };
}

export async function controlOperation(params: {
  userId: string; jobId: string; requestId: string; expectedUpdatedAt: string; action: "cancel" | "retry";
}) {
  const existing = await getOperationForOwner(params.userId, params.jobId);
  const receiptResponse = z.strictObject({ job_id: z.uuid(), request_id: z.uuid(), replayed: z.boolean(),
    accepted_at: z.iso.datetime({ offset: true }) });
  // A known receipt must still be recoverable if dispatch settings later change.
  // Only a new retry checks dispatch readiness, before any credit transaction.
  let saved;
  try {
    const result = await getMcpStore().from("mcp_job_control_requests").select("request_id")
      .eq("user_id", params.userId).eq("request_id", params.requestId).maybeSingle();
    if (result.error) throw result.error;
    saved = result.data;
  } catch { throw new ToolFailure("OPERATIONS_UNAVAILABLE", "Operation recovery is temporarily unavailable. Preserve the request ID.", true); }
  if (params.action === "retry" && !saved && isRetryableBackgroundJob(existing) &&
    getMissingBackgroundJobCloudTasksEnvVars([existing.jobType]).length)
    throw new ToolFailure("OPERATION_DISPATCH_UNAVAILABLE", "Retry dispatch is not configured. Preserve the request ID and read the current status.", true);
  const { data, error } = await getMcpStore().rpc("mcp_control_background_job", {
    p_user_id: params.userId, p_job_id: params.jobId, p_request_id: params.requestId,
    p_expected_updated_at: params.expectedUpdatedAt, p_action: params.action,
    p_retry_allowed: isRetryableBackgroundJob(existing),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("mcp_operation_request_conflict")) throw new ToolFailure("REQUEST_CONFLICT", "This request ID was already used with different operation inputs.");
    if (message.includes("mcp_operation_changed")) throw new ToolFailure("OPERATION_CHANGED", "The operation changed. Read its current status before requesting another action.");
    if (message.includes("mcp_operation_not_found")) throw new ToolFailure("NOT_FOUND", "Operation not found.");
    if (message.includes("mcp_operation_not_retryable") || message.includes("background job is not retryable") ||
      message.includes("maximum attempts") || message.includes("billing_retry_already_committed") ||
      message.includes("billing_retry_reservation_conflict")) throw new ToolFailure("OPERATION_NOT_RETRYABLE", "This operation cannot be retried. Read its status for supported recovery.");
    if (message.includes("insufficient_billing_credits")) throw new ToolFailure("INSUFFICIENT_CREDITS", "You do not have enough credits to retry this generation.");
    if (message.includes("paid_subscription_required") || message.includes("complimentary_generation_access_required"))
      throw new ToolFailure("PLAN_REQUIRED", "This retry requires active access to the original credit plan.");
    throw new ToolFailure("OPERATIONS_UNAVAILABLE", "The action could not be confirmed. Preserve and reuse the same request ID and inputs.", true);
  }
  const receipt = receiptResponse.safeParse(data);
  if (!receipt.success || receipt.data.job_id !== params.jobId || receipt.data.request_id !== params.requestId)
    throw new ToolFailure("OPERATIONS_UNAVAILABLE", "The action could not be confirmed. Preserve and reuse the same request ID and inputs.", true);
  let job = await getOperationForOwner(params.userId, params.jobId);
  // Cloud Tasks identity is job + attempt; this existing recovery dispatcher
  // preserves a funded queued row for recovery if delivery fails.
  if (params.action === "retry" && job.status === "queued" && !job.queueMessageId) {
    job = await dispatchQueuedBackgroundJobForRecovery(job);
  }
  return { operation: operationSummary(job), request_id: receipt.data.request_id,
    replayed: receipt.data.replayed, accepted_at: receipt.data.accepted_at };
}
