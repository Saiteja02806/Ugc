import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BACKGROUND_JOBS_TABLE = "background_jobs";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type BackgroundJobStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "processing"
  | "queued";

export type BackgroundJobType =
  | "extract_video_metadata"
  | "generate_avatar"
  | "generate_carousel"
  | "generate_hook_video"
  | "generate_image"
  | "generate_thumbnail"
  | "publish_social_post"
  | "render_demo_video"
  | "render_edit_video"
  | "render_schedule_combination"
  | "test_worker_job";

type BackgroundJobInsert = {
  aws_message_id?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  idempotency_key?: string | null;
  input_json?: Json;
  job_type: BackgroundJobType;
  last_delivery_at?: string | null;
  last_heartbeat_at?: string | null;
  locked_at?: string | null;
  output_json?: Json | null;
  project_id?: string | null;
  queue_name: string;
  started_at?: string | null;
  status?: BackgroundJobStatus;
  updated_at?: string;
  user_id?: string | null;
  worker_id?: string | null;
};

type BackgroundJobUpdate = Partial<BackgroundJobInsert> & {
  attempt_count?: number;
};

type BackgroundJobRow = Required<
  Pick<
    BackgroundJobInsert,
    "input_json" | "job_type" | "queue_name" | "status"
  >
> & {
  attempt_count: number;
  aws_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  id: string;
  idempotency_key: string | null;
  last_delivery_at: string | null;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  output_json: Json | null;
  project_id: string | null;
  started_at: string | null;
  updated_at: string;
  user_id: string | null;
  worker_id: string | null;
};

type BackgroundJobsDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      background_jobs: {
        Insert: BackgroundJobInsert;
        Relationships: [];
        Row: BackgroundJobRow;
        Update: BackgroundJobUpdate;
      };
    };
    Views: Record<string, never>;
  };
};

export type BackgroundJobRecord = {
  attemptCount: number;
  awsMessageId: string | null;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  idempotencyKey: string | null;
  input: Json;
  jobType: BackgroundJobType;
  lastDeliveryAt: string | null;
  lastHeartbeatAt: string | null;
  lockedAt: string | null;
  output: Json | null;
  projectId: string | null;
  queueName: string;
  startedAt: string | null;
  status: BackgroundJobStatus;
  updatedAt: string;
  userId: string | null;
  workerId: string | null;
};

export type CreateBackgroundJobInput = {
  idempotencyKey?: string | null;
  input?: Record<string, Json | undefined>;
  jobType: BackgroundJobType;
  projectId?: string | null;
  queueName: string;
  userId?: string | null;
};

let supabaseServerClient: SupabaseClient<BackgroundJobsDatabase> | null = null;

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ""
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function getSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Background job storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<BackgroundJobsDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseServerClient;
}

export function getMissingBackgroundJobStorageEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function isBackgroundJobStorageConfigured() {
  return getMissingBackgroundJobStorageEnvVars().length === 0;
}

export async function createBackgroundJob(input: CreateBackgroundJobInput) {
  return (await createBackgroundJobWithCreationResult(input)).job;
}

export async function createBackgroundJobWithCreationResult(
  input: CreateBackgroundJobInput,
) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .insert({
      input_json: toJsonObject(input.input ?? {}),
      idempotency_key: input.idempotencyKey ?? null,
      job_type: input.jobType,
      project_id: input.projectId ?? null,
      queue_name: input.queueName,
      status: "queued",
      updated_at: now,
      user_id: input.userId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && input.idempotencyKey) {
      const existing = await getBackgroundJobByIdempotencyKey(
        input.idempotencyKey,
      );

      if (existing) {
        return { created: false as const, job: existing };
      }
    }

    throw new Error(`Could not create background job: ${error.message}`);
  }

  return { created: true as const, job: mapBackgroundJob(data) };
}

export async function getBackgroundJobById(jobId: string) {
  if (!UUID_PATTERN.test(jobId)) {
    return null;
  }

  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

export async function getBackgroundJobsByIds(jobIds: string[]) {
  const uniqueJobIds = Array.from(
    new Set(jobIds.filter((jobId) => UUID_PATTERN.test(jobId))),
  );

  if (uniqueJobIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .in("id", uniqueJobIds);

  if (error) {
    throw new Error(`Could not read background jobs: ${error.message}`);
  }

  return (data ?? []).map(mapBackgroundJob);
}

export async function getBackgroundJobByIdempotencyKey(
  idempotencyKey: string,
) {
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

export async function attachAwsMessageToBackgroundJob(params: {
  awsMessageId: string;
  jobId: string;
}) {
  const job = await updateBackgroundJob(params.jobId, {
    aws_message_id: params.awsMessageId,
  });

  if (!job) {
    throw new Error("Could not attach queue message id to missing job.");
  }

  return job;
}

export async function claimBackgroundJobDelivery(
  job: BackgroundJobRecord,
) {
  const claimedAt = new Date().toISOString();
  let query = getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .update({ last_delivery_at: claimedAt })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("updated_at", job.updatedAt);

  query = job.lastDeliveryAt
    ? query.eq("last_delivery_at", job.lastDeliveryAt)
    : query.is("last_delivery_at", null);

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(`Could not claim background job delivery: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

export async function markBackgroundJobProcessing(params: {
  jobId: string;
  workerId?: string | null;
}) {
  const now = new Date().toISOString();
  const job = await updateBackgroundJob(params.jobId, {
    last_heartbeat_at: now,
    locked_at: now,
    started_at: now,
    status: "processing",
    worker_id: params.workerId ?? null,
  });

  if (!job) {
    throw new Error("Could not mark missing background job as processing.");
  }

  return job;
}

export async function heartbeatBackgroundJob(params: {
  jobId: string;
  workerId?: string | null;
}) {
  const job = await updateBackgroundJob(params.jobId, {
    last_heartbeat_at: new Date().toISOString(),
    ...(params.workerId !== undefined ? { worker_id: params.workerId } : {}),
  });

  if (!job) {
    throw new Error("Could not heartbeat missing background job.");
  }

  return job;
}

export async function markBackgroundJobCompleted(params: {
  jobId: string;
  output?: Record<string, Json | undefined> | null;
}) {
  const now = new Date().toISOString();
  const job = await updateBackgroundJob(params.jobId, {
    completed_at: now,
    error_message: null,
    output_json: params.output ? toJsonObject(params.output) : null,
    status: "completed",
  });

  if (!job) {
    throw new Error("Could not mark missing background job as completed.");
  }

  return job;
}

export async function markBackgroundJobFailed(params: {
  errorMessage: string;
  jobId: string;
}) {
  const currentJob = await getBackgroundJobById(params.jobId);

  if (!currentJob) {
    throw new Error("Could not mark missing background job as failed.");
  }

  const now = new Date().toISOString();
  const job = await updateBackgroundJob(params.jobId, {
    attempt_count: currentJob.attemptCount + 1,
    completed_at: now,
    error_message: params.errorMessage.slice(0, 1_000),
    status: "failed",
  });

  if (!job) {
    throw new Error("Could not mark missing background job as failed.");
  }

  return job;
}

export async function cancelQueuedBackgroundJob(jobId: string) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .update({
      completed_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not cancel background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

async function updateBackgroundJob(
  jobId: string,
  patch: BackgroundJobUpdate,
) {
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

function mapBackgroundJob(row: BackgroundJobRow): BackgroundJobRecord {
  return {
    attemptCount: row.attempt_count,
    awsMessageId: row.aws_message_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    input: row.input_json,
    jobType: row.job_type,
    lastDeliveryAt: row.last_delivery_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    lockedAt: row.locked_at,
    output: row.output_json,
    projectId: row.project_id,
    queueName: row.queue_name,
    startedAt: row.started_at,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
    workerId: row.worker_id,
  };
}

function toJsonObject(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => {
      return entry[1] !== undefined;
    }),
  );
}
