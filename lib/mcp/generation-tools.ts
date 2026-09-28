import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import { AI_STUDIO_IMAGE_ASPECT_RATIOS, parseAIStudioImageModel } from "@/lib/ai-studio/generation-settings";
import { getGenerationCreditCost, getUserSubscription } from "@/lib/billing/subscription-db";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { createAndDispatchReservedMcpGenerationJob } from "@/lib/jobs/background-job-service";
import {
  getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars,
  McpGenerationJobError, type BackgroundJobRecord,
} from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { generationChildIdempotencyKey, generationRequestFingerprint } from "./generation-idempotency";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

const uuid = z.uuid();
const jobStatus = z.enum([
  "cancelled", "cancel_requested", "completed", "created", "failed", "processing",
  "queued", "rendering", "stalled", "uploading_output", "waiting_external_service",
]);
const jobReceipt = z.strictObject({ job_id: uuid, status: jobStatus });
const safeJobError = z.strictObject({
  code: z.string().min(1), message: z.string().min(1), retryable: z.boolean(),
});

export const registeredGenerationMcpTools = ["generate_image", "get_job"] as const;

function isMcpGenerationJob(job: BackgroundJobRecord) {
  const input = job.input;
  return job.jobType === "generate_image" &&
    !!input && typeof input === "object" && !Array.isArray(input) &&
    input.mcpSource === "ugc-pilot-cloud-mcp" &&
    typeof input.mcpRequestFingerprint === "string" &&
    /^[0-9a-f]{64}$/.test(input.mcpRequestFingerprint);
}

function asGenerationFailure(error: unknown): never {
  if (error instanceof McpGenerationJobError) {
    throw new ToolFailure(error.code, error.message);
  }
  throw new ToolFailure("GENERATION_UNAVAILABLE", "Image generation is temporarily unavailable.", true);
}

export function registerGenerationMcpTools(server: McpServer) {
  server.registerTool("generate_image", {
    description: "Reserve image credits and queue 1, 2, or 4 images. Reusing the request ID with the same input returns the existing jobs.",
    inputSchema: z.strictObject({
      prompt: z.string().trim().min(1).max(2000),
      aspect_ratio: z.enum(AI_STUDIO_IMAGE_ASPECT_RATIOS).default("9:16"),
      reference_asset_id: uuid.optional(),
      count: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
      client_request_id: z.string().trim().min(1).max(200),
    }),
    outputSchema: z.strictObject({ jobs: z.array(jobReceipt).min(1).max(4), partial: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("generation:write"),
    _meta: oauthMetadata("generation:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "generation:write");
    if (getMissingBackgroundJobStorageEnvVars().length || getMissingJobQueueEnvVars(["generate_image"]).length) {
      throw new ToolFailure("GENERATION_UNAVAILABLE", "Image generation is temporarily unavailable.", true);
    }

    let subscription;
    try {
      subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false });
    } catch {
      throw new ToolFailure("GENERATION_UNAVAILABLE", "Current plan and credits are temporarily unavailable.", true);
    }
    if (!subscription.isActive) {
      throw new ToolFailure("PLAN_REQUIRED", "An active Starter or Growth subscription is required.");
    }

    let referenceImageUrl: string | undefined;
    if (args.reference_asset_id) {
      const reference = await getMediaAssetForOwner({ assetId: args.reference_asset_id, userId });
      if (!reference || reference.status !== "ready") {
        throw new ToolFailure("REFERENCE_NOT_FOUND", "Reference image not found.");
      }
      if (reference.collection !== "image" || !reference.mime_type.startsWith("image/") ||
          !reference.url.startsWith("https://") || !isTrustedStorageUrl(reference.url)) {
        throw new ToolFailure("UNSUPPORTED_REFERENCE", "The selected asset cannot be used as an image reference.");
      }
      referenceImageUrl = reference.url;
    }

    const fingerprint = generationRequestFingerprint({
      kind: "image", prompt: args.prompt, aspectRatio: args.aspect_ratio,
      count: args.count, referenceAssetId: args.reference_asset_id,
    });
    const model = parseAIStudioImageModel(undefined);
    const jobs: Array<{ job_id: string; status: BackgroundJobRecord["status"] }> = [];

    for (let index = 1; index <= args.count; index += 1) {
      try {
        const job = await createAndDispatchReservedMcpGenerationJob({
          amount: getGenerationCreditCost("image"),
          fingerprint,
          idempotencyKey: generationChildIdempotencyKey({
            userId, kind: "image", clientRequestId: args.client_request_id, childIndex: index,
          }),
          input: {
            aspectRatio: args.aspect_ratio,
            batchIndex: index,
            batchSize: args.count,
            generationId: crypto.randomUUID(),
            mcpRequestFingerprint: fingerprint,
            mcpSource: "ugc-pilot-cloud-mcp",
            model,
            prompt: args.prompt,
            referenceImageUrl,
          },
          jobType: "generate_image",
          userId,
        });
        jobs.push({ job_id: job.id, status: job.status });
      } catch (error) {
        if (error instanceof McpGenerationJobError && error.code === "IDEMPOTENCY_CONFLICT") {
          asGenerationFailure(error);
        }
        if (jobs.length === 0) asGenerationFailure(error);
        console.warn(JSON.stringify({ event: "mcp.generation.partial", kind: "image", started: jobs.length }));
        return { jobs, partial: true };
      }
    }

    console.info(JSON.stringify({ event: "mcp.generation.queued", kind: "image", count: jobs.length }));
    return { jobs, partial: false };
  }));

  server.registerTool("get_job", {
    description: "Check an owned MCP image job and retrieve its completed output asset ID.",
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
      if (!asset || asset.status !== "ready" || asset.collection !== "image") {
        throw new ToolFailure("INTERNAL_ERROR", "The completed output is not available yet.", true);
      }
      outputAssetIds.push(asset.id);
    }

    const publicJob = getPublicBackgroundJob(job);
    const safeError = publicJob.error;
    return {
      id: job.id,
      type: "image_generation",
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
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    };
  }));
}
