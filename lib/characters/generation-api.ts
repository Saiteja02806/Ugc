import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  deliverBillingUsageForJob,
  getGenerationCreditCost,
  getUserSubscription,
} from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import {
  getBackgroundJobByIdempotencyKey,
  getBackgroundJobForUser,
  getMissingBackgroundJobStorageEnvVars,
  type BackgroundJobRecord,
} from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMediaAssetForOwner, type MediaAssetRow } from "@/lib/media/media-storage";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { getCharacterForUser } from "./identity";
import { createCharacterPlan } from "./planner";
import {
  CharacterGenerationError,
  generateCharacterBatch,
  getCharacterJobInput,
  isCharacterGenerationJob,
  reserveCharacterGenerationBatch,
  type CharacterGenerationDependencies,
} from "./generation-service";
import type { CharacterGenerationAccess, CharacterJobStatusResponse } from "./types";
import { characterAccessFromCredits, characterRequestCount } from "./access-policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);

export async function getCharacterGenerationAccess(userId: string): Promise<CharacterGenerationAccess> {
  const subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false });
  return characterAccessFromCredits(subscription.isActive, subscription.creditsRemaining, getGenerationCreditCost("image"));
}

function requireRuntime() {
  if (getMissingBackgroundJobStorageEnvVars().length || getMissingJobQueueEnvVars(["generate_image"]).length) {
    throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "Character creation is temporarily unavailable.", 503);
  }
}

export type CharacterApiDependencies = {
  authenticate: (request: Request) => Promise<VerifiedFirebaseUser>;
  getAccess: (userId: string) => Promise<CharacterGenerationAccess>;
  generation: CharacterGenerationDependencies;
  getJob: (jobId: string, userId: string) => Promise<BackgroundJobRecord | null>;
  getAsset: (assetId: string, userId: string) => Promise<MediaAssetRow | null>;
  deliverUsage: (jobId: string) => Promise<unknown>;
  requireRuntime: () => void;
};

const defaultDependencies: CharacterApiDependencies = {
  authenticate: requireFirebaseUser,
  getAccess: getCharacterGenerationAccess,
  generation: {
    getExistingJob: (key, userId) => getBackgroundJobByIdempotencyKey(key, { jobType: "generate_image", userId }),
    async requireAccess(userId, request) {
      const access = await getCharacterGenerationAccess(userId);
      const count = characterRequestCount(access, request);
      if (!count) {
        throw new CharacterGenerationError("INSUFFICIENT_CREDITS", "You don’t have enough credits for the selected number of images.", 402);
      }
      return { count, useFreeAllowance: false };
    },
    getBusinessProfile: getBusinessProfileForUser,
    getReference: getCharacterForUser,
    plan: createCharacterPlan,
    reserveBatch: reserveCharacterGenerationBatch,
    dispatch: dispatchQueuedBackgroundJobForRecovery,
    getImageCreditCost: () => getGenerationCreditCost("image"),
  },
  getJob: (jobId, userId) => getBackgroundJobForUser({ jobId, userId }),
  getAsset: (assetId, userId) => getMediaAssetForOwner({ assetId, userId }),
  deliverUsage: deliverBillingUsageForJob,
  requireRuntime,
};

function errorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return Response.json({ ok: false, message: error.message }, { status: error.status });
  }
  if (error instanceof CharacterGenerationError) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  }
  // Provider messages can contain prompts and business facts. Keep them private.
  console.error("Character request failed.", { errorType: error instanceof Error ? error.name : "Unknown" });
  return Response.json({ ok: false, message: "Character creation is temporarily unavailable. Retry this request." }, { status: 503 });
}

export function createCharacterGenerationHandlers(dependencies: CharacterApiDependencies = defaultDependencies) {
  return {
    async generate(request: Request) {
      try {
        const user = await dependencies.authenticate(request);
        const rawBody = await request.text();
        // Bound the transport payload without imposing a character limit on the prompt.
        if (new TextEncoder().encode(rawBody).byteLength > 1_048_576) {
          throw new CharacterGenerationError("INPUT_INVALID", "This request is too large to send. Reduce its size and try again.", 413);
        }
        let body: unknown;
        try { body = JSON.parse(rawBody); } catch { throw new CharacterGenerationError("INPUT_INVALID", "Invalid character instructions."); }
        dependencies.requireRuntime();
        const result = await generateCharacterBatch(user.uid, body, dependencies.generation);
        return Response.json(result, { status: 202 });
      } catch (error) { return errorResponse(error); }
    },
    async access(request: Request) {
      try {
        const user = await dependencies.authenticate(request);
        const access = await dependencies.getAccess(user.uid);
        return Response.json({ ok: true, access }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) { return errorResponse(error); }
    },
    async status(request: Request) {
      try {
        const user = await dependencies.authenticate(request);
        const jobId = new URL(request.url).searchParams.get("jobId")?.trim() ?? "";
        if (!UUID_PATTERN.test(jobId)) throw new CharacterGenerationError("INPUT_INVALID", "Missing or invalid job id.");
        const job = await dependencies.getJob(jobId, user.uid);
        if (!job || job.userId !== user.uid || !isCharacterGenerationJob(job)) {
          throw new CharacterGenerationError("NOT_FOUND", "Influencer generation was not found.", 404);
        }
        let output: CharacterJobStatusResponse["job"]["output"] = null;
        if (job.status === "completed") {
          const raw = job.output && typeof job.output === "object" && !Array.isArray(job.output) ? job.output : null;
          const assetId = raw?.mediaAssetId;
          const asset = typeof assetId === "string" && UUID_PATTERN.test(assetId)
            ? await dependencies.getAsset(assetId, user.uid) : null;
          if (asset && asset.user_id === user.uid && asset.status === "ready" &&
              (asset.collection === "image" || asset.collection === "influencer") &&
              asset.mime_type.startsWith("image/") && asset.source_type === "generated_image" && asset.source_record_id === job.id &&
              asset.url.startsWith("https://") && isTrustedStorageUrl(asset.url) &&
              raw?.url === asset.url && raw?.key === asset.storage_key &&
              raw?.generationId === getCharacterJobInput(job)?.generationId && raw?.model === getCharacterJobInput(job)?.model) {
            output = {
              url: asset.url,
              mediaAssetId: asset.id,
              generationId: String(raw.generationId),
              width: asset.width,
              height: asset.height,
              ratio: asset.ratio,
            };
          }
          if (!output) throw new CharacterGenerationError("OUTPUT_NOT_READY", "Your influencer image is being saved. Check again shortly.", 503);
          await dependencies.deliverUsage(job.id).catch(() => {
            console.warn("Influencer usage delivery will retry.", { jobId: job.id });
          });
        }
        const result: CharacterJobStatusResponse = {
          ok: true,
          job: {
            id: job.id,
            status: job.status,
            isTerminal: TERMINAL_STATUSES.has(job.status),
            error: getPublicBackgroundJob(job).error?.message ?? null,
            output,
          },
        };
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      } catch (error) { return errorResponse(error); }
    },
  };
}

const handlers = createCharacterGenerationHandlers();
export const handleCharacterGeneration = handlers.generate;
export const handleCharacterGenerationStatus = handlers.status;
export const handleCharacterGenerationAccess = handlers.access;
