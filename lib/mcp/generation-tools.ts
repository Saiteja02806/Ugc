import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import { AI_STUDIO_IMAGE_ASPECT_RATIOS, AI_STUDIO_VIDEO_ASPECT_RATIOS, parseAIStudioImageModel } from "@/lib/ai-studio/generation-settings";
import { getGenerationCreditCost, getUserSubscription } from "@/lib/billing/subscription-db";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { createAndDispatchReservedMcpGenerationJob } from "@/lib/jobs/background-job-service";
import {
  getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars,
  McpGenerationJobError, type BackgroundJobRecord, type Json,
} from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { isTrustedMediaReferenceUrl as isTrustedStorageUrl } from "@/lib/media/media-reference";
import { generationChildIdempotencyKey, generationRequestFingerprint } from "./generation-idempotency";
import { MCP_VIDEO_DURATIONS } from "./generation-contract";
import { executeTool, generationCount, oauthMetadata, principal, ToolFailure } from "./read-tools";

const uuid = z.uuid();
const jobStatus = z.enum([
  "cancelled", "cancel_requested", "completed", "created", "failed", "processing",
  "queued", "rendering", "stalled", "uploading_output", "waiting_external_service",
]);
const jobReceipt = z.strictObject({ job_id: uuid, status: jobStatus });
const safeJobError = z.strictObject({
  code: z.string().min(1), message: z.string().min(1), retryable: z.boolean(),
});

export { registeredGenerationMcpTools } from "./generation-contract";

function isMcpGenerationJob(job: BackgroundJobRecord) {
  const input = job.input;
  return (job.jobType === "generate_image" || job.jobType === "generate_hook_video") &&
    !!input && typeof input === "object" && !Array.isArray(input) &&
    input.mcpSource === "ugc-pilot-cloud-mcp" &&
    typeof input.mcpRequestFingerprint === "string" &&
    /^[0-9a-f]{64}$/.test(input.mcpRequestFingerprint);
}

function asGenerationFailure(error: unknown): never {
  if (error instanceof McpGenerationJobError) {
    throw new ToolFailure(error.code, error.message);
  }
  throw new ToolFailure("GENERATION_UNAVAILABLE", "Generation is temporarily unavailable.", true);
}

async function requireGenerationAccess(userId: string, jobType: "generate_image" | "generate_hook_video") {
  if (getMissingBackgroundJobStorageEnvVars().length || getMissingJobQueueEnvVars([jobType]).length) {
    throw new ToolFailure("GENERATION_UNAVAILABLE", "Generation is temporarily unavailable.", true);
  }
  let subscription;
  try {
    subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false, initializeFreeCredits: false });
  } catch {
    throw new ToolFailure("GENERATION_UNAVAILABLE", "Current plan and credits are temporarily unavailable.", true);
  }
  if (!subscription.isActive) {
    throw new ToolFailure("PLAN_REQUIRED", "An active Starter or Growth subscription is required.");
  }
}

async function getReferenceImage(userId: string, assetId?: string) {
  if (!assetId) return undefined;
  const reference = await getMediaAssetForOwner({ assetId, userId });
  if (!reference || reference.status !== "ready") {
    throw new ToolFailure("REFERENCE_NOT_FOUND", "Reference image not found.");
  }
  if (reference.collection !== "image" || !reference.mime_type.startsWith("image/") ||
      !reference.url.startsWith("https://") || !isTrustedStorageUrl(reference.url)) {
    throw new ToolFailure("UNSUPPORTED_REFERENCE", "The selected asset cannot be used as an image reference.");
  }
  return reference.url;
}

async function queueGeneration(params: {
  userId: string; kind: "image" | "video"; count: 1 | 2 | 4;
  clientRequestId: string; fingerprint: string; amount: number;
  input: Record<string, Json | undefined>;
}) {
  const jobs: Array<{ job_id: string; status: BackgroundJobRecord["status"] }> = [];
  for (let index = 1; index <= params.count; index += 1) {
    try {
      const job = await createAndDispatchReservedMcpGenerationJob({
        amount: params.amount,
        fingerprint: params.fingerprint,
        idempotencyKey: generationChildIdempotencyKey({
          userId: params.userId, kind: params.kind, clientRequestId: params.clientRequestId, childIndex: index,
        }),
        input: {
          ...params.input, batchIndex: index, batchSize: params.count,
          mcpRequestFingerprint: params.fingerprint, mcpSource: "ugc-pilot-cloud-mcp",
          ...(params.kind === "image" ? { generationId: crypto.randomUUID() } : { videoId: crypto.randomUUID() }),
        },
        jobType: params.kind === "image" ? "generate_image" : "generate_hook_video",
        userId: params.userId,
      });
      jobs.push({ job_id: job.id, status: job.status });
    } catch (error) {
      if (error instanceof McpGenerationJobError && error.code === "IDEMPOTENCY_CONFLICT") asGenerationFailure(error);
      if (jobs.length === 0) asGenerationFailure(error);
      console.warn(JSON.stringify({ event: "mcp.generation.partial", kind: params.kind, started: jobs.length }));
      return { jobs, partial: true };
    }
  }
  console.info(JSON.stringify({ event: "mcp.generation.queued", kind: params.kind, count: jobs.length }));
  return { jobs, partial: false };
}

export function registerGenerationMcpTools(server: McpServer) {
  server.registerTool("generate_image", {
    description: "Reserve image credits and queue 1, 2, or 4 images. Reusing the request ID with the same input returns the existing jobs.",
    inputSchema: z.strictObject({
      prompt: z.string().trim().min(1).max(2000).describe("The image instruction, up to 2,000 characters."),
      aspect_ratio: z.enum(AI_STUDIO_IMAGE_ASPECT_RATIOS).default("9:16").describe("Output image aspect ratio."),
      reference_asset_id: uuid.optional().describe("Optional ID of one ready image in this account to use as a reference."),
      count: generationCount.default(1),
      client_request_id: z.string().trim().min(1).max(200).describe("A caller-generated stable ID. Reuse it only to retry the same request."),
    }),
    outputSchema: z.strictObject({ jobs: z.array(jobReceipt).min(1).max(4), partial: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("generation:write"),
    _meta: oauthMetadata("generation:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "generation:write");
    await requireGenerationAccess(userId, "generate_image");
    const referenceImageUrl = await getReferenceImage(userId, args.reference_asset_id);
    return queueGeneration({
      userId, kind: "image", count: args.count, clientRequestId: args.client_request_id,
      amount: getGenerationCreditCost("image"),
      fingerprint: generationRequestFingerprint({
        kind: "image", prompt: args.prompt, aspectRatio: args.aspect_ratio,
        count: args.count, referenceAssetId: args.reference_asset_id,
      }),
      input: { aspectRatio: args.aspect_ratio, model: parseAIStudioImageModel(undefined), prompt: args.prompt, referenceImageUrl },
    });
  }));

  server.registerTool("generate_video", {
    description: "Reserve video credits by duration and queue 1, 2, or 4 videos. Reusing the request ID with the same input returns the existing jobs.",
    inputSchema: z.strictObject({
      prompt: z.string().trim().min(1).max(1000).describe("The video instruction, up to 1,000 characters."),
      aspect_ratio: z.enum(AI_STUDIO_VIDEO_ASPECT_RATIOS).default("9:16"),
      duration_seconds: z.literal(MCP_VIDEO_DURATIONS).describe("Required duration in whole seconds, from 3 through 10. Credits are charged by duration."),
      reference_asset_id: uuid.optional().describe("Optional ID of one ready image in this account to animate."),
      count: generationCount.default(1),
      client_request_id: z.string().trim().min(1).max(200).describe("A caller-generated stable ID. Reuse it only to retry the same request."),
    }),
    outputSchema: z.strictObject({ jobs: z.array(jobReceipt).min(1).max(4), partial: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("generation:write"),
    _meta: oauthMetadata("generation:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "generation:write");
    await requireGenerationAccess(userId, "generate_hook_video");
    const referenceImageUrl = await getReferenceImage(userId, args.reference_asset_id);
    return queueGeneration({
      userId, kind: "video", count: args.count, clientRequestId: args.client_request_id,
      amount: getGenerationCreditCost("video", args.duration_seconds),
      fingerprint: generationRequestFingerprint({
        kind: "video", prompt: args.prompt, aspectRatio: args.aspect_ratio,
        count: args.count, referenceAssetId: args.reference_asset_id, durationSeconds: args.duration_seconds,
      }),
      input: {
        aspectRatio: args.aspect_ratio, durationSeconds: args.duration_seconds,
        avatarImageUrl: referenceImageUrl, hookIdea: args.prompt,
        // Omni supports the complete V1 3-10 second range; Seedance starts at 4.
        model: "google_omni", promptMode: "direct", projectId: "ai-studio", userId,
      },
    });
  }));

  server.registerTool("get_job", {
    description: "Check an owned MCP image or video job and retrieve its completed output asset ID.",
    inputSchema: z.strictObject({ job_id: uuid }),
    outputSchema: z.strictObject({
      id: uuid,
      type: z.enum(["image_generation", "video_generation"]),
      status: jobStatus,
      progress: z.number().min(0).max(100).nullable(),
      stage: z.string().nullable(),
      output_asset_ids: z.array(uuid),
      error: safeJobError.nullable(),
      created_at: z.iso.datetime(),
      updated_at: z.iso.datetime(),
    }),
    annotations: { readOnlyHint: true },
    scopeChallenge: requireScopes("jobs:read"),
    _meta: oauthMetadata("jobs:read"),
  }, async ({ job_id }, ctx) => executeTool(async () => {
    const userId = principal(ctx, "jobs:read");
    const job = await getBackgroundJobForUser({ jobId: job_id, userId });
    if (!job || !isMcpGenerationJob(job)) throw new ToolFailure("NOT_FOUND", "Job not found.");

    const outputAssetIds: string[] = [];
    if (job.status === "completed") {
      const output = job.output;
      const assetId = output && typeof output === "object" && !Array.isArray(output)
        ? output.mediaAssetId : null;
      if (typeof assetId !== "string" || !uuid.safeParse(assetId).success) {
        throw new ToolFailure("INTERNAL_ERROR", "The completed output is not available yet.", true);
      }
      const asset = await getMediaAssetForOwner({ assetId, userId });
      if (!asset || asset.status !== "ready" || asset.collection !== (job.jobType === "generate_image" ? "image" : "video")) {
        throw new ToolFailure("INTERNAL_ERROR", "The completed output is not available yet.", true);
      }
      outputAssetIds.push(asset.id);
    }

    const publicJob = getPublicBackgroundJob(job);
    const safeError = publicJob.error;
    return {
      id: job.id,
      type: job.jobType === "generate_image" ? "image_generation" : "video_generation",
      status: job.status,
      progress: typeof job.progress === "number" && job.progress >= 0 && job.progress <= 100 ? job.progress : null,
      stage: job.stage,
      output_asset_ids: outputAssetIds,
      error: safeError ? {
        code: ["CANCELLED", "INPUT_INVALID", "OUTPUT_UPLOAD_FAILED", "PROVIDER_TIMEOUT", "QUEUE_DELIVERY_FAILED", "WORKER_STALLED"].includes(safeError.code)
          ? safeError.code : "GENERATION_FAILED",
        message: safeError.message,
        retryable: safeError.retryable,
      } : null,
      created_at: new Date(job.createdAt).toISOString(),
      updated_at: new Date(job.updatedAt).toISOString(),
    };
  }));
}
