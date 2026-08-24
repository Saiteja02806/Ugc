import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BACKGROUND_JOBS_TABLE = "background_jobs";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type BackgroundJobStatus =
  | "cancelled"
  | "cancel_requested"
  | "completed"
  | "created"
  | "failed"
  | "processing"
  | "queued"
  | "rendering"
  | "stalled"
  | "uploading_output"
  | "waiting_external_service";

export type BackgroundJobType =
  | "analytics_sync"
  | "carousel_content_plan_generation"
  | "carousel_generation"
  | "final_render"
  | "generate_avatar"
  | "generate_carousel"
  | "generate_hook_video"
  | "generate_image"
  | "generate_thumbnail"
  | "generate_trending_hook_copy"
  | "extract_video_metadata"
  | "hook_text_generation"
  | "image_generation"
  | "media_analysis"
  | "preview_render"
  | "publish_social_post"
  | "render_demo_video"
  | "render_edit_video"
  | "render_schedule_combination"
  | "render_trending_carousel_edit"
  | "render_wall_text_video"
  | "social_publish"
  | "test_worker_job"
  | "video_generation"
  | "wall_text_generation";

type BackgroundJobInsert = {
  attempt_count?: number;
  cancel_requested_at?: string | null;
  claim_token?: string | null;
  queue_message_id?: string | null;
  completed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  failed_at?: string | null;
  idempotency_key?: string | null;
  input_json?: Json;
  input_reference?: string | null;
  job_type: BackgroundJobType;
  last_delivery_at?: string | null;
  last_heartbeat_at?: string | null;
  locked_at?: string | null;
  max_attempts?: number;
  next_attempt_at?: string | null;
  output_json?: Json | null;
  output_reference?: string | null;
  progress?: number | null;
  project_id?: string | null;
  queue_name: string;
  queue_provider?: "gcp";
  queued_at?: string | null;
  stage?: string | null;
  started_at?: string | null;
  status?: BackgroundJobStatus;
  updated_at?: string;
  user_id?: string | null;
  worker_execution_id?: string | null;
  worker_id?: string | null;
};

type BackgroundJobUpdate = Partial<BackgroundJobInsert>;

type BackgroundJobRow = Required<
  Pick<
    BackgroundJobInsert,
    "input_json" | "job_type" | "queue_name" | "status"
  >
> & {
  attempt_count: number;
  cancel_requested_at: string | null;
  claim_token: string | null;
  queue_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  failed_at: string | null;
  id: string;
  idempotency_key: string | null;
  input_reference: string | null;
  last_delivery_at: string | null;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  max_attempts: number;
  next_attempt_at: string | null;
  output_json: Json | null;
  output_reference: string | null;
  progress: number | null;
  project_id: string | null;
  queue_provider: "gcp";
  queued_at: string | null;
  stage: string | null;
  started_at: string | null;
  updated_at: string;
  user_id: string | null;
  worker_execution_id: string | null;
  worker_id: string | null;
};

type BackgroundJobsDatabase = {
  public: {
    Functions: {
      append_background_job_event: {
        Args: {
          p_event_type: string;
          p_job_id: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      list_recoverable_background_jobs: {
        Args: {
          p_limit?: number;
          p_stale_after_seconds?: number;
        };
        Returns: BackgroundJobRow[];
      };
      request_background_job_cancel: {
        Args: { p_job_id: string; p_user_id: string };
        Returns: BackgroundJobRow[];
      };
      recover_background_job: {
        Args: { p_job_id: string };
        Returns: BackgroundJobRow[];
      };
      retry_background_job: {
        Args: { p_job_id: string; p_user_id: string };
        Returns: BackgroundJobRow[];
      };
      transition_background_job: {
        Args: {
          p_claim_token: string | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_event_type?: string;
          p_job_id: string;
          p_metadata?: Json;
          p_output_reference?: string | null;
          p_progress?: number | null;
          p_stage?: string | null;
          p_status: BackgroundJobStatus;
        };
        Returns: BackgroundJobRow[];
      };
    };
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
  cancelRequestedAt: string | null;
  claimToken: string | null;
  queueMessageId: string | null;
  completedAt: string | null;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: string | null;
  id: string;
  idempotencyKey: string | null;
  input: Json;
  inputReference: string | null;
  jobType: BackgroundJobType;
  lastDeliveryAt: string | null;
  lastHeartbeatAt: string | null;
  lockedAt: string | null;
  maxAttempts: number;
  nextAttemptAt: string | null;
  output: Json | null;
  outputReference: string | null;
  progress: number | null;
  projectId: string | null;
  queueName: string;
  queueProvider: "gcp";
  queuedAt: string | null;
  stage: string | null;
  startedAt: string | null;
  status: BackgroundJobStatus;
  updatedAt: string;
  userId: string | null;
  workerExecutionId: string | null;
  workerId: string | null;
};

export type CreateBackgroundJobInput = {
  idempotencyKey?: string | null;
  input?: Record<string, Json | undefined>;
  inputReference?: string | null;
  jobType: BackgroundJobType;
  maxAttempts?: number;
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
      input_reference: input.inputReference ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      job_type: input.jobType,
      max_attempts: input.maxAttempts ?? 3,
      project_id: input.projectId ?? null,
      queue_name: input.queueName,
      queue_provider: "gcp",
      queued_at: now,
      stage: "queued",
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
        {
          jobType: input.jobType,
          userId: input.userId ?? null,
        },
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

export async function getBackgroundJobForUser(params: {
  jobId: string;
  userId: string;
}) {
  if (!UUID_PATTERN.test(params.jobId) || !params.userId.trim()) {
    return null;
  }

  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .eq("id", params.jobId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

export async function listBackgroundJobsForUser(params: {
  activeOnly?: boolean;
  jobType?: BackgroundJobType;
  limit?: number;
  userId: string;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 100));
  let query = getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.activeOnly) {
    query = query.in("status", [
      "created",
      "queued",
      "processing",
      "waiting_external_service",
      "rendering",
      "uploading_output",
      "cancel_requested",
      "stalled",
    ]);
  }

  if (params.jobType) {
    query = query.eq("job_type", params.jobType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list background jobs: ${error.message}`);
  }

  return (data ?? []).map(mapBackgroundJob);
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
  scope?: {
    jobType?: BackgroundJobType;
    userId?: string | null;
  },
) {
  let query = getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .select("*")
    .eq("idempotency_key", idempotencyKey);

  if (scope?.jobType) {
    query = query.eq("job_type", scope.jobType);
  }

  if (scope && "userId" in scope) {
    query = scope.userId
      ? query.eq("user_id", scope.userId)
      : query.is("user_id", null);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
}

export async function appendBackgroundJobEvent(params: {
  eventType: string;
  jobId: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "append_background_job_event",
    {
      p_event_type: params.eventType,
      p_job_id: params.jobId,
      p_metadata: toJsonObject(params.metadata ?? {}),
    },
  );

  if (error) {
    throw new Error(`Could not append background job event: ${error.message}`);
  }

  return data;
}

export async function requestBackgroundJobCancellation(params: {
  jobId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "request_background_job_cancel",
    { p_job_id: params.jobId, p_user_id: params.userId },
  );

  if (error) {
    throw new Error(`Could not cancel background job: ${error.message}`);
  }

  return data?.[0] ? mapBackgroundJob(data[0]) : null;
}

export async function retryBackgroundJob(params: {
  jobId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "retry_background_job",
    { p_job_id: params.jobId, p_user_id: params.userId },
  );

  if (error) {
    throw new Error(`Could not retry background job: ${error.message}`);
  }

  return data?.[0] ? mapBackgroundJob(data[0]) : null;
}

export async function listRecoverableBackgroundJobs(params?: {
  limit?: number;
  staleAfterSeconds?: number;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "list_recoverable_background_jobs",
    {
      p_limit: Math.max(1, Math.min(params?.limit ?? 100, 500)),
      p_stale_after_seconds: Math.max(
        60,
        Math.min(params?.staleAfterSeconds ?? 900, 43_200),
      ),
    },
  );

  if (error) {
    throw new Error(`Could not list recoverable background jobs: ${error.message}`);
  }

  return (data ?? []).map(mapBackgroundJob);
}

export async function recoverBackgroundJob(jobId: string) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "recover_background_job",
    { p_job_id: jobId },
  );

  if (error) {
    throw new Error(`Could not recover background job: ${error.message}`);
  }

  return data?.[0] ? mapBackgroundJob(data[0]) : null;
}

export async function transitionBackgroundJob(params: {
  claimToken?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType?: string;
  jobId: string;
  metadata?: Record<string, Json | undefined>;
  outputReference?: string | null;
  progress?: number | null;
  stage?: string | null;
  status: BackgroundJobStatus;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "transition_background_job",
    {
      p_claim_token: params.claimToken ?? null,
      p_error_code: params.errorCode ?? null,
      p_error_message: params.errorMessage ?? null,
      p_event_type: params.eventType ?? "status_changed",
      p_job_id: params.jobId,
      p_metadata: toJsonObject(params.metadata ?? {}),
      p_output_reference: params.outputReference ?? null,
      p_progress: params.progress ?? null,
      p_stage: params.stage ?? null,
      p_status: params.status,
    },
  );

  if (error) {
    throw new Error(`Could not transition background job: ${error.message}`);
  }

  return data?.[0] ? mapBackgroundJob(data[0]) : null;
}

export async function attachQueueMessageToBackgroundJob(params: {
  queueMessageId: string;
  jobId: string;
}) {
  const job = await updateBackgroundJob(params.jobId, {
    queue_message_id: params.queueMessageId,
  });

  if (!job) {
    throw new Error("Could not attach queue message id to missing job.");
  }

  return job;
}

export async function attachWorkerExecutionToBackgroundJob(params: {
  jobId: string;
  workerExecutionId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .update({
      stage: "render_job_launched",
      worker_execution_id: params.workerExecutionId.slice(0, 255),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)
    .in("status", ["created", "queued", "stalled"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not attach worker execution: ${error.message}`);
  }

  return data ? mapBackgroundJob(data) : null;
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
    stage: "processing",
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
    error_code: null,
    error_message: null,
    output_json: params.output ? toJsonObject(params.output) : null,
    progress: 100,
    stage: "completed",
    status: "completed",
  });

  if (!job) {
    throw new Error("Could not mark missing background job as completed.");
  }

  return job;
}

export async function markBackgroundJobFailed(params: {
  errorCode?: string;
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
    error_code: params.errorCode?.slice(0, 120) ?? "JOB_FAILED",
    error_message: params.errorMessage.slice(0, 1_000),
    failed_at: now,
    stage: "failed",
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
      stage: "cancelled",
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
    cancelRequestedAt: row.cancel_requested_at,
    claimToken: row.claim_token,
    queueMessageId: row.queue_message_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    failedAt: row.failed_at,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    input: row.input_json,
    inputReference: row.input_reference,
    jobType: row.job_type,
    lastDeliveryAt: row.last_delivery_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    lockedAt: row.locked_at,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    output: row.output_json,
    outputReference: row.output_reference,
    progress: row.progress,
    projectId: row.project_id,
    queueName: row.queue_name,
    queueProvider: row.queue_provider,
    queuedAt: row.queued_at,
    stage: row.stage,
    startedAt: row.started_at,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
    workerExecutionId: row.worker_execution_id,
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
