import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "@/lib/jobs/background-jobs";

const HOOK_GENERATION_CHUNK_SIZE = 6;

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

export async function reserveTrendingHookGenerationChunk(params: {
  runId: string;
}) {
  const row = await callRpc<ChunkRow>(
    "reserve_trending_hook_generation_chunk_v1",
    {
      p_chunk_size: HOOK_GENERATION_CHUNK_SIZE,
      p_run_id: params.runId,
    },
  );

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

  return row;
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
