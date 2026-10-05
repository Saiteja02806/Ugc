import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  getBackgroundJobForUser,
  type BackgroundJobRecord,
  type Json,
} from "@/lib/jobs/background-jobs";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { gatewayRetryFetch } from "@/lib/supabase/gateway-retry-fetch";
import {
  CHARACTER_CANDIDATE_COUNT,
  CHARACTER_SOURCE,
  CHARACTER_VERSION,
  CharacterGenerateRequestSchema,
  CharacterSpecSchema,
  type CharacterGenerateRequest,
  type CharacterPlan,
  type CharacterSpec,
} from "./schema";
import {
  renderCharacterPrompt,
  validateCharacterPlan,
  type CharacterPlanningInput,
} from "./planner";
import type { CharacterGenerationResponse, CharacterImageCount } from "./types";

export class CharacterGenerationError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "CharacterGenerationError";
  }
}

export type CharacterReference = {
  id: string;
  userId: string;
  referenceImageUrl: string;
  characterSpec: CharacterSpec;
};

export type CharacterReservationInput = {
  userId: string;
  batchId: string;
  fingerprint: string;
  amountPerImage: number;
  inputs: Array<Record<string, Json | undefined>>;
  useFreeAllowance: boolean;
};

export type CharacterGenerationDependencies = {
  getExistingJob: (key: string, userId: string) => Promise<BackgroundJobRecord | null>;
  requireAccess: (userId: string, request: CharacterGenerateRequest) => Promise<{ count: CharacterImageCount; useFreeAllowance: boolean }>;
  getBusinessProfile: (userId: string) => Promise<BusinessProfileRecord | null>;
  getReference: (id: string, userId: string) => Promise<CharacterReference | null>;
  plan: (input: CharacterPlanningInput) => Promise<CharacterPlan>;
  reserveBatch: (input: CharacterReservationInput) => Promise<BackgroundJobRecord[]>;
  dispatch: (job: BackgroundJobRecord) => Promise<BackgroundJobRecord>;
  getImageCreditCost: () => number;
  createId?: () => string;
};

export function characterBatchId(userId: string, idempotencyKey: string) {
  return createHash("sha256").update(JSON.stringify([userId, "characters", idempotencyKey.trim()])).digest("hex");
}

export function characterChildIdempotencyKey(batchId: string, index: number) {
  if (!/^[0-9a-f]{64}$/.test(batchId) || !Number.isInteger(index) || index < 1 || index > 3) {
    throw new Error("Invalid character batch key.");
  }
  return `character:${batchId}:${index}`;
}

export function characterRequestFingerprint(request: CharacterGenerateRequest) {
  return createHash("sha256").update(JSON.stringify({
    version: CHARACTER_VERSION,
    mode: request.mode,
    gender: request.gender ?? null,
    model: request.model,
    prompt: request.prompt ?? null,
    referenceCharacterId: request.referenceCharacterId ?? null,
    count: request.imageCount ?? CHARACTER_CANDIDATE_COUNT,
  })).digest("hex");
}

export function getCharacterJobInput(job: BackgroundJobRecord) {
  const input = job.input;
  return input && typeof input === "object" && !Array.isArray(input)
    ? input
    : null;
}

export function isCharacterGenerationJob(job: BackgroundJobRecord) {
  const input = getCharacterJobInput(job);
  return job.jobType === "generate_image" &&
    input?.characterSource === CHARACTER_SOURCE &&
    input.characterVersion === CHARACTER_VERSION &&
    typeof input.characterRequestFingerprint === "string" &&
    /^[0-9a-f]{64}$/.test(input.characterRequestFingerprint);
}

function assertOwnedBatch(jobs: BackgroundJobRecord[], userId: string, batchId: string, fingerprint: string, requestedCount?: CharacterImageCount) {
  const count = getCharacterJobInput(jobs[0])?.batchSize;
  if ((count !== 1 && count !== 2 && count !== CHARACTER_CANDIDATE_COUNT) || jobs.length !== count) {
    throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "The influencer batch is temporarily unavailable. Retry this request.", 503);
  }
  // Older fingerprints used count=3 even for a one-image free batch. Preserve
  // their omitted-count replays, but never treat an explicit 3 as that same batch.
  if (requestedCount !== undefined && requestedCount !== count) {
    throw new CharacterGenerationError("IDEMPOTENCY_CONFLICT", "This request already belongs to a different number of images. Start a new request.", 409);
  }
  for (const [index, job] of jobs.entries()) {
    const input = getCharacterJobInput(job);
    if (!isCharacterGenerationJob(job) || job.userId !== userId ||
        input?.batchId !== batchId || input?.batchSize !== count || input?.candidateIndex !== index + 1 ||
        job.idempotencyKey !== characterChildIdempotencyKey(batchId, index + 1)) {
      throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "The influencer batch could not be verified.", 503);
    }
    if (input.characterRequestFingerprint !== fingerprint) {
      throw new CharacterGenerationError("IDEMPOTENCY_CONFLICT", "This request already belongs to different character instructions. Start a new request.", 409);
    }
    if (typeof input.generationId !== "string" || !input.generationId.trim()) {
      throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "The influencer batch is temporarily unavailable.", 503);
    }
  }
}

/** Authenticated owner only; the database reserves the entire selected batch atomically. */
export async function generateCharacterBatch(userId: string, rawRequest: unknown, dependencies: CharacterGenerationDependencies): Promise<CharacterGenerationResponse> {
  const parsed = CharacterGenerateRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    throw new CharacterGenerationError("INPUT_INVALID", parsed.error.issues[0]?.message || "Invalid character instructions.");
  }
  const request = parsed.data;
  const batchId = characterBatchId(userId, request.idempotencyKey);
  const fingerprint = characterRequestFingerprint(request);
  const existing = await Promise.all(Array.from({ length: CHARACTER_CANDIDATE_COUNT }, (_, index) =>
    dependencies.getExistingJob(characterChildIdempotencyKey(batchId, index + 1), userId)));
  let jobs: BackgroundJobRecord[];
  if (existing.some(Boolean)) {
    // A replay must not call the planner, consume more credits or read changed
    // business facts. Recover delivery using the already committed batch.
    jobs = existing.filter((job): job is BackgroundJobRecord => !!job);
    assertOwnedBatch(jobs, userId, batchId, fingerprint, request.imageCount);
  } else {
    const access = await dependencies.requireAccess(userId, request);
    const reference = request.referenceCharacterId
      ? await dependencies.getReference(request.referenceCharacterId, userId)
      : null;
    if (request.referenceCharacterId && (!reference || reference.userId !== userId ||
        !reference.referenceImageUrl.startsWith("https://") || !isTrustedStorageUrl(reference.referenceImageUrl))) {
      throw new CharacterGenerationError("REFERENCE_NOT_FOUND", "The saved influencer could not be found.", 404);
    }
    const referenceSpec = reference ? CharacterSpecSchema.parse(reference.characterSpec) : null;
    const profile = await dependencies.getBusinessProfile(userId);
    if (profile && profile.userId !== userId) {
      throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "Your business setup could not be loaded.", 503);
    }
    if (request.mode === "assisted" && !profile) {
      throw new CharacterGenerationError("BUSINESS_PROFILE_REQUIRED", "Complete your business setup before creating an influencer for you.", 409);
    }
    const planningInput: CharacterPlanningInput = { request, businessContext: profile?.context ?? null, referenceSpec };
    const plan = validateCharacterPlan(await dependencies.plan(planningInput), planningInput);
    const inputs = plan.candidates.slice(0, access.count).map((spec, index): Record<string, Json | undefined> => ({
      aspectRatio: "9:16",
      batchId,
      batchIndex: index + 1,
      batchSize: access.count,
      businessProfileId: profile?.id ?? null,
      businessProfileVersion: profile?.profileVersion ?? null,
      candidateIndex: index + 1,
      characterSource: CHARACTER_SOURCE,
      characterVersion: CHARACTER_VERSION,
      characterRequestFingerprint: fingerprint,
      characterPlan: plan,
      characterSpec: spec,
      generationId: (dependencies.createId ?? crypto.randomUUID)(),
      gender: spec.gender,
      mode: request.mode,
      model: request.model,
      prompt: renderCharacterPrompt(spec, !!reference),
      referenceCharacterId: reference?.id ?? null,
      referenceImageUrl: reference?.referenceImageUrl ?? null,
    }));
    jobs = await dependencies.reserveBatch({
      userId, batchId, fingerprint,
      amountPerImage: access.useFreeAllowance ? 0 : dependencies.getImageCreditCost(),
      inputs,
      useFreeAllowance: access.useFreeAllowance,
    });
    // A concurrent request may have already committed a different plan for the
    // same semantic input. Always dispatch and return the durable database rows.
    assertOwnedBatch(jobs, userId, batchId, fingerprint, request.imageCount);
  }
  const dispatched = await Promise.all(jobs.map((job) => dependencies.dispatch(job)));
  return {
    ok: true,
    jobs: dispatched.map((job) => ({ jobId: job.id, generationId: String(getCharacterJobInput(job)?.generationId) })),
    requestedCount: jobs.length as CharacterImageCount,
    partial: false,
    message: jobs.length === 1 ? "Your influencer is being created." : `${jobs.length} influencer candidates are being created.`,
  };
}

let databaseClient: SupabaseClient | null = null;
function getDatabaseClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "Character creation is temporarily unavailable.", 503);
  databaseClient ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: gatewayRetryFetch },
  });
  return databaseClient;
}

export async function hasUnusedFreeCharacterGeneration(userId: string) {
  const { data, error } = await getDatabaseClient().from("character_free_generation_allowances")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "Character creation is temporarily unavailable.", 503);
  return data === null;
}

export async function reserveCharacterGenerationBatch(input: CharacterReservationInput): Promise<BackgroundJobRecord[]> {
  const { data, error } = await getDatabaseClient().rpc("character_create_reserved_generation_batch", {
    p_user_id: input.userId,
    p_idempotency_key: input.batchId,
    p_fingerprint: input.fingerprint,
    p_amount_per_image: input.amountPerImage,
    p_inputs_json: input.inputs,
    p_queue_name: "ai-generation",
    p_use_free_allowance: input.useFreeAllowance,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("idempotency_conflict") || message.includes("reservation_conflict") || message.includes("job_conflict")) {
      throw new CharacterGenerationError("IDEMPOTENCY_CONFLICT", "This request already belongs to different character instructions.", 409);
    }
    if (message.includes("insufficient_billing_credits")) {
      throw new CharacterGenerationError("INSUFFICIENT_CREDITS", "You don’t have enough credits for the selected number of images.", 402);
    }
    if (message.includes("paid_subscription_required")) {
      throw new CharacterGenerationError("PLAN_REQUIRED", "An active Starter or Growth subscription is required to create an influencer.", 403);
    }
    if (message.includes("character_free_generation_already_used")) {
      throw new CharacterGenerationError("FREE_ALLOWANCE_USED", "Your free influencer generation has been used. Upgrade to create more.", 403);
    }
    throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "Character creation is temporarily unavailable. Retry this request.", 503);
  }
  if (!Array.isArray(data) || data.length !== input.inputs.length) {
    throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "The influencer batch could not be verified.", 503);
  }
  const jobs = await Promise.all(data.map((row: unknown) => {
    const record = row && typeof row === "object" ? row as { job?: { id?: unknown } } : null;
    const id = record?.job?.id;
    return typeof id === "string" ? getBackgroundJobForUser({ jobId: id, userId: input.userId }) : null;
  }));
  if (jobs.some((job) => !job)) throw new CharacterGenerationError("GENERATION_UNAVAILABLE", "The influencer batch is temporarily unavailable.", 503);
  return (jobs as BackgroundJobRecord[]).sort((a, b) => Number(getCharacterJobInput(a)?.candidateIndex) - Number(getCharacterJobInput(b)?.candidateIndex));
}
