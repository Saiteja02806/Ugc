import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EDITABLE_VIDEOS_TABLE = "editable_videos";
const VIDEO_RENDER_JOBS_TABLE = "video_render_jobs";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type PersistedEditableVideoSource = "hook" | "demo" | "draft" | "final";
export type PersistedVideoRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type RenderJobStatus = "queued" | "rendering" | "completed" | "failed";

type EditableVideoInsert = {
  draft_json?: Json | null;
  duration_seconds?: number | null;
  latest_render_id?: string | null;
  project_id: string;
  ratio: PersistedVideoRatio;
  rendered_video_url?: string | null;
  source: PersistedEditableVideoSource;
  source_video_id: string;
  source_video_url?: string | null;
  status?: "ready" | "draft" | "rendering" | "rendered" | "failed";
  thumbnail_url?: string | null;
  title: string;
  updated_at?: string;
  user_id: string;
};

type RenderJobInsert = {
  draft_json: Json;
  error_message?: string | null;
  output_s3_key?: string | null;
  output_url?: string | null;
  project_id: string;
  ratio: PersistedVideoRatio;
  render_id: string;
  source_video_id: string;
  source_video_url: string;
  status?: RenderJobStatus;
  updated_at?: string;
  user_id: string;
};

type RenderDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      editable_videos: {
        Insert: EditableVideoInsert;
        Relationships: [];
        Row: EditableVideoInsert & {
          created_at: string;
          id: string;
          latest_render_id: string | null;
          rendered_video_url: string | null;
          status: "ready" | "draft" | "rendering" | "rendered" | "failed";
          updated_at: string;
        };
        Update: Partial<EditableVideoInsert>;
      };
      video_render_jobs: {
        Insert: RenderJobInsert;
        Relationships: [];
        Row: RenderJobInsert & {
          completed_at: string | null;
          created_at: string;
          started_at: string | null;
          status: RenderJobStatus;
          updated_at: string;
        };
        Update: Partial<RenderJobInsert> & {
          completed_at?: string | null;
          started_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
  };
};

type RenderTextOverlayInput = {
  id: string;
  position: string;
  style: string;
  text: string;
};

type RenderDraftInput = {
  textOverlays: RenderTextOverlayInput[];
  trimEndSeconds: number | null;
  trimStartSeconds: number;
};

export type CreateQueuedRenderJobInput = {
  draft: RenderDraftInput;
  durationSeconds?: number | null;
  projectId: string;
  ratio: PersistedVideoRatio;
  renderId: string;
  source: PersistedEditableVideoSource;
  sourceVideoId: string;
  sourceVideoUrl: string;
  thumbnailUrl?: string | null;
  title: string;
  userId: string;
};

export type CompleteRenderJobInput = {
  key: string;
  projectId: string;
  renderId: string;
  sourceVideoId: string;
  url: string;
  userId: string;
};

let supabaseServerClient: SupabaseClient<RenderDatabase> | null = null;

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
    throw new Error("Edit render persistence is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<RenderDatabase>(
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

export function getMissingEditRenderPersistenceEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function isEditRenderPersistenceConfigured() {
  return getMissingEditRenderPersistenceEnvVars().length === 0;
}

export async function createQueuedRenderJob(input: CreateQueuedRenderJobInput) {
  const now = new Date().toISOString();
  const draftJson = toJson(input.draft);

  const editableVideo: EditableVideoInsert = {
    draft_json: draftJson,
    duration_seconds: input.durationSeconds ?? null,
    latest_render_id: input.renderId,
    project_id: input.projectId,
    ratio: input.ratio,
    source: input.source,
    source_video_id: input.sourceVideoId,
    source_video_url: input.sourceVideoUrl,
    status: "rendering",
    thumbnail_url: input.thumbnailUrl ?? null,
    title: input.title,
    updated_at: now,
    user_id: input.userId,
  };

  const { error: editableVideoError } = await getSupabaseServerClient()
    .from(EDITABLE_VIDEOS_TABLE)
    .upsert(editableVideo, {
      onConflict: "user_id,project_id,source_video_id",
    });

  if (editableVideoError) {
    throw new Error(
      `Could not persist editable video: ${editableVideoError.message}`,
    );
  }

  const renderJob: RenderJobInsert = {
    draft_json: draftJson,
    project_id: input.projectId,
    ratio: input.ratio,
    render_id: input.renderId,
    source_video_id: input.sourceVideoId,
    source_video_url: input.sourceVideoUrl,
    status: "queued",
    updated_at: now,
    user_id: input.userId,
  };

  const { error: renderJobError } = await getSupabaseServerClient()
    .from(VIDEO_RENDER_JOBS_TABLE)
    .insert(renderJob);

  if (renderJobError) {
    throw new Error(`Could not persist render job: ${renderJobError.message}`);
  }
}

export async function markRenderJobRendering(renderId: string) {
  const now = new Date().toISOString();
  const { error } = await getSupabaseServerClient()
    .from(VIDEO_RENDER_JOBS_TABLE)
    .update({
      started_at: now,
      status: "rendering",
      updated_at: now,
    })
    .eq("render_id", renderId);

  if (error) {
    throw new Error(`Could not mark render as running: ${error.message}`);
  }
}

export async function markRenderJobCompleted(input: CompleteRenderJobInput) {
  const now = new Date().toISOString();
  const client = getSupabaseServerClient();
  const { error: renderJobError } = await client
    .from(VIDEO_RENDER_JOBS_TABLE)
    .update({
      completed_at: now,
      error_message: null,
      output_s3_key: input.key,
      output_url: input.url,
      status: "completed",
      updated_at: now,
    })
    .eq("render_id", input.renderId);

  if (renderJobError) {
    throw new Error(`Could not mark render as completed: ${renderJobError.message}`);
  }

  const { error: editableVideoError } = await client
    .from(EDITABLE_VIDEOS_TABLE)
    .update({
      rendered_video_url: input.url,
      status: "rendered",
      updated_at: now,
    })
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("source_video_id", input.sourceVideoId)
    .eq("latest_render_id", input.renderId);

  if (editableVideoError) {
    throw new Error(
      `Could not mark editable video as rendered: ${editableVideoError.message}`,
    );
  }
}

export async function markRenderJobFailed(params: {
  errorMessage: string;
  projectId: string;
  renderId: string;
  sourceVideoId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const client = getSupabaseServerClient();
  const { error: renderJobError } = await client
    .from(VIDEO_RENDER_JOBS_TABLE)
    .update({
      completed_at: now,
      error_message: params.errorMessage.slice(0, 1000),
      status: "failed",
      updated_at: now,
    })
    .eq("render_id", params.renderId);

  if (renderJobError) {
    throw new Error(`Could not mark render as failed: ${renderJobError.message}`);
  }

  const { error: editableVideoError } = await client
    .from(EDITABLE_VIDEOS_TABLE)
    .update({
      status: "failed",
      updated_at: now,
    })
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .eq("source_video_id", params.sourceVideoId)
    .eq("latest_render_id", params.renderId);

  if (editableVideoError) {
    throw new Error(
      `Could not mark editable video render as failed: ${editableVideoError.message}`,
    );
  }
}

function toJson(value: RenderDraftInput): Json {
  return {
    textOverlays: value.textOverlays.map((overlay) => ({
      id: overlay.id,
      position: overlay.position,
      style: overlay.style,
      text: overlay.text,
    })),
    trimEndSeconds: value.trimEndSeconds,
    trimStartSeconds: value.trimStartSeconds,
  };
}
