import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "@/lib/jobs/background-jobs";

type RunStatus =
  | "queued"
  | "processing"
  | "continuation_pending"
  | "completed"
  | "source_exhausted"
  | "superseded"
  | "failed";

type RunRow = {
  completed_valid_count: number;
  run_id: string;
  run_status: RunStatus;
  target_valid_count: number;
};

type ChunkRow = RunRow & {
  candidate_payloads: Json;
  chunk_id: string | null;
  chunk_number: number | null;
  remaining_valid_count: number;
};

type DispatchRecoveryRow = {
  attempt_count: number;
  chunk_id: string;
  dispatch_id: string;
  run_id: string;
  target_valid_count: number;
  user_id: string;
};

type InitialRunRepairRow = {
  chunk_id: string;
  run_id: string;
  user_id: string;
};

type TrendingHookGenerationRpcClient = {
  rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    data: T[] | T | null;
    error: { message: string } | null;
  }>;
};

export type TrendingHookGenerationRun = {
  completedValidCount: number;
  id: string;
  status: RunStatus;
  targetValidCount: number;
};

export type TrendingHookGenerationChunk = TrendingHookGenerationRun & {
  candidates: Array<Record<string, Json>>;
  chunkId: string | null;
  chunkNumber: number | null;
  remainingValidCount: number;
};

export type TrendingHookGenerationDispatchRecoveryClaim = {
  attemptCount: number;
  chunkId: string;
  dispatchId: string;
  runId: string;
  targetValidCount: number;
  userId: string;
  claimToken: string;
};

let client: SupabaseClient | null = null;

export function getMissingTrendingHookGenerationRunEnvVars() {
  const missing: string[] = [];

  if (
    !process.env.SUPABASE_URL?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function createOrResumeTrendingHookGenerationRun(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  candidatePool: Array<Record<string, Json>>;
  promptVersion: string;
  selectionVersion: string;
  sourceSelectionKey: string | null;
  targetValidCount: number;
  userId: string;
}) {
  const row = await callRpc<RunRow>(
    "create_or_resume_trending_hook_generation_run_v1",
    {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_candidate_pool: params.candidatePool,
      p_prompt_version: params.promptVersion,
      p_selection_version: params.selectionVersion,
      p_source_selection_key: params.sourceSelectionKey ?? "",
      p_target_valid_count: params.targetValidCount,
      p_user_id: params.userId,
    },
  );

  return toRun(row);
}

/**
 * Creates or resumes the durable run and reserves its next chunk through one
 * Postgres RPC. A successful response means the run, reserved chunk, and its
 * dispatch-outbox row committed together; a failed response commits none of
 * the new setup work.
 */
export async function createOrResumeAndReserveTrendingHookGenerationChunk(
  params: {
    businessProfileId: string;
    businessProfileVersion: number;
    candidatePool: Array<Record<string, Json>>;
    promptVersion: string;
    selectionVersion: string;
    sourceSelectionKey: string | null;
    targetValidCount: number;
    userId: string;
  },
) {
  const row = await callRpc<ChunkRow>(
    "create_or_resume_and_reserve_trending_hook_generation_chunk_v2",
    {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_candidate_pool: params.candidatePool,
      p_prompt_version: params.promptVersion,
      p_selection_version: params.selectionVersion,
      p_source_selection_key: params.sourceSelectionKey ?? "",
      p_target_valid_count: params.targetValidCount,
      p_user_id: params.userId,
    },
  );

  return toChunk(row);
}

export async function reserveTrendingHookGenerationChunk(params: {
  runId: string;
}) {
  const row = await callRpc<ChunkRow>(
    "reserve_trending_hook_generation_chunk_v2",
    {
      p_run_id: params.runId,
    },
  );

  return toChunk(row);
}

/**
 * Repairs historical runs created by the old two-RPC setup. New runs should
 * never match this shape because their initial chunk is created atomically.
 */
export async function reserveMissingInitialTrendingHookGenerationChunks(params: {
  limit: number;
}) {
  const supabase = getClient() as unknown as TrendingHookGenerationRpcClient;
  const { data, error } = await supabase.rpc<InitialRunRepairRow>(
    "reserve_missing_initial_trending_hook_generation_chunks_v2",
    { p_limit: params.limit },
  );

  if (error) {
    throw new Error(
      `Could not repair initial Trending Hook generation chunks: ${error.message}`,
    );
  }

  const records = Array.isArray(data) ? data : [];

  return records.map((row) => ({
    chunkId: requireUuid(row.chunk_id, "chunk_id"),
    runId: requireUuid(row.run_id, "run_id"),
    userId: requireText(row.user_id, "user_id"),
  }));
}

export async function attachTrendingHookGenerationChunkJob(params: {
  backgroundJobId: string;
  chunkId: string;
}) {
  const row = await callRpc<boolean>(
    "attach_trending_hook_generation_chunk_job_v1",
    {
      p_background_job_id: params.backgroundJobId,
      p_chunk_id: params.chunkId,
    },
  );

  return row === true;
}

export async function releaseUnattachedTrendingHookGenerationChunk(params: {
  chunkId: string;
  errorMessage: string;
}) {
  const row = await callRpc<boolean>(
    "release_unattached_trending_hook_generation_chunk_v1",
    {
      p_chunk_id: params.chunkId,
      p_error_message: params.errorMessage,
    },
  );

  return row === true;
}

/**
 * Claims chunks that were reserved but never received a physical background
 * job. This is an emergency repair path only: normal preparation dispatches
 * the job in the same request without waiting for the scheduler.
 */
export async function claimDueTrendingHookGenerationChunkDispatches(params: {
  limit: number;
  staleAfterSeconds?: number;
}) {
  const claimToken = randomUUID();
  const supabase = getClient() as unknown as TrendingHookGenerationRpcClient;
  const { data, error } = await supabase.rpc<DispatchRecoveryRow>(
    "claim_due_trending_hook_generation_chunk_dispatches_v1",
    {
      p_claim_token: claimToken,
      p_limit: params.limit,
      p_stale_after_seconds: params.staleAfterSeconds ?? 300,
    },
  );

  if (error) {
    throw new Error(
      `Could not claim Trending Hook generation dispatches: ${error.message}`,
    );
  }

  const records = Array.isArray(data) ? data : [];

  return records.map((row) => ({
    attemptCount: toNonNegativeInteger(row.attempt_count, "attempt_count"),
    chunkId: requireUuid(row.chunk_id, "chunk_id"),
    claimToken,
    dispatchId: requireUuid(row.dispatch_id, "dispatch_id"),
    runId: requireUuid(row.run_id, "run_id"),
    targetValidCount: toPositiveInteger(
      row.target_valid_count,
      "target_valid_count",
    ),
    userId: requireText(row.user_id, "user_id"),
  })) satisfies TrendingHookGenerationDispatchRecoveryClaim[];
}

export async function completeTrendingHookGenerationChunkDispatch(params: {
  claimToken: string;
  dispatchId: string;
}) {
  const row = await callRpc<boolean>(
    "complete_trending_hook_generation_chunk_dispatch_v1",
    {
      p_claim_token: params.claimToken,
      p_dispatch_id: params.dispatchId,
    },
  );

  return row === true;
}

export async function rescheduleTrendingHookGenerationChunkDispatch(params: {
  claimToken: string;
  dispatchId: string;
  errorMessage: string;
}) {
  const row = await callRpc<boolean>(
    "reschedule_trending_hook_generation_chunk_dispatch_v1",
    {
      p_claim_token: params.claimToken,
      p_dispatch_id: params.dispatchId,
      p_error_message: params.errorMessage,
    },
  );

  return row === true;
}

function toRun(row: RunRow): TrendingHookGenerationRun {
  if (!row || typeof row.run_id !== "string" || !row.run_id.trim()) {
    throw new Error("Trending Hook generation run returned no id.");
  }

  if (!isRunStatus(row.run_status)) {
    throw new Error("Trending Hook generation run returned an invalid status.");
  }

  const targetValidCount = toPositiveInteger(
    row.target_valid_count,
    "target_valid_count",
  );
  const completedValidCount = toNonNegativeInteger(
    row.completed_valid_count,
    "completed_valid_count",
  );

  if (completedValidCount > targetValidCount) {
    throw new Error("Trending Hook generation run returned invalid progress.");
  }

  return {
    completedValidCount,
    id: row.run_id,
    status: row.run_status,
    targetValidCount,
  };
}

function toChunk(row: ChunkRow) {
  return {
    ...toRun(row),
    candidates: toCandidateArray(row.candidate_payloads),
    chunkId: row.chunk_id,
    chunkNumber: row.chunk_number,
    remainingValidCount: toNonNegativeInteger(
      row.remaining_valid_count,
      "remaining_valid_count",
    ),
  } satisfies TrendingHookGenerationChunk;
}

function toCandidateArray(value: Json) {
  if (!Array.isArray(value)) {
    throw new Error("Trending Hook generation chunk returned invalid candidates.");
  }

  const candidates = value.filter(
    (candidate): candidate is Record<string, Json> =>
      Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate),
  );

  if (candidates.length !== value.length) {
    throw new Error("Trending Hook generation chunk returned invalid candidates.");
  }

  return candidates;
}

async function callRpc<T>(name: string, args: Record<string, unknown>) {
  // Keep the method attached to its Supabase client. Calling a detached
  // `client.rpc` function loses `this`, which Supabase needs for `this.rest`.
  const supabase = getClient() as unknown as TrendingHookGenerationRpcClient;
  const { data, error } = await supabase.rpc<T>(name, args);

  if (error) {
    throw new Error(`Could not update Trending Hook generation run: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (row === null || row === undefined) {
    throw new Error("Trending Hook generation run returned no result.");
  }

  return row as T;
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Trending Hook generation storage is not configured.");
  }

  if (!client) {
    client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function isRunStatus(value: unknown): value is RunStatus {
  return (
    typeof value === "string" &&
    [
      "queued",
      "processing",
      "continuation_pending",
      "completed",
      "source_exhausted",
      "superseded",
      "failed",
    ].includes(value)
  );
}

function toPositiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`Trending Hook generation run returned invalid ${field}.`);
  }

  return value;
}

function toNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Trending Hook generation run returned invalid ${field}.`);
  }

  return value;
}

function requireUuid(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error(`Trending Hook generation dispatch returned invalid ${field}.`);
  }

  return value;
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Trending Hook generation dispatch returned invalid ${field}.`);
  }

  return value.trim();
}
