import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BACKGROUND_JOBS_TABLE = "background_jobs";

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
  | "test_worker_job";

type BackgroundJobInsert = {
  aws_message_id?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  input_json?: Json;
  job_type: BackgroundJobType;
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
  input: Json;
  jobType: BackgroundJobType;
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
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from(BACKGROUND_JOBS_TABLE)
    .insert({
      input_json: toJsonObject(input.input ?? {}),
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
    throw new Error(`Could not create background job: ${error.message}`);
  }

  return mapBackgroundJob(data);
}

export async function getBackgroundJobById(jobId: string) {
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

export async function attachAwsMessageToBackgroundJob(params: {
  awsMessageId: string;
  jobId: string;
}) {
  const job = await updateBackgroundJob(params.jobId, {
    aws_message_id: params.awsMessageId,
  });

  if (!job) {
    throw new Error("Could not attach AWS message id to missing job.");
  }

  return job;
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
    input: row.input_json,
    jobType: row.job_type,
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
