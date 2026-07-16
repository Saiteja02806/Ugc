import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeEditableVideoDraftInput,
  type EditableVideo,
  type EditableVideoDraftInput,
} from "@/lib/edit/video-library";

const EDITABLE_VIDEOS_TABLE = "editable_videos";
const VIDEO_RENDER_JOBS_TABLE = "video_render_jobs";
export const DEFAULT_EDIT_PROJECT_ID = "test-project-001";

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
  deleted_at?: string | null;
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
          deleted_at: string | null;
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

type EditableVideoRow =
  RenderDatabase["public"]["Tables"]["editable_videos"]["Row"];

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

export type EnsureEditableVideoInput = {
  draft?: unknown;
  durationSeconds?: number | null;
  projectId: string;
  ratio: PersistedVideoRatio;
  source: PersistedEditableVideoSource;
  sourceVideoId: string;
  sourceVideoUrl: string;
  thumbnailUrl?: string | null;
  title: string;
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

export async function listEditableVideosForOwner(userId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(EDITABLE_VIDEOS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load editable videos: ${error.message}`);
  }

  return data.map(serializeEditableVideo);
}

export async function getEditableVideoForOwner(params: {
  sourceVideoId: string;
  userId: string;
}) {
  const row = await getEditableVideoRowForOwner(params);

  return row ? serializeEditableVideo(row) : null;
}

export async function getLatestEditableVideoRenderForOwner(params: {
  sourceVideoId: string;
  userId: string;
}) {
  const editableVideo = await getEditableVideoRowForOwner(params);

  if (!editableVideo?.latest_render_id) {
    return null;
  }

  const { data, error } = await getSupabaseServerClient()
    .from(VIDEO_RENDER_JOBS_TABLE)
    .select("*")
    .eq("render_id", editableVideo.latest_render_id)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load latest Edit render: ${error.message}`);
  }

  return data;
}

export async function ensureEditableVideo(
  input: EnsureEditableVideoInput,
) {
  const existing = await getEditableVideoRowForOwner(input);

  if (existing) {
    return serializeEditableVideo(existing);
  }

  const now = new Date().toISOString();
  const draft = normalizeEditableVideoDraftInput(input.draft);
  const editableVideo: EditableVideoInsert = {
    draft_json: draft ? toJson(draft) : null,
    duration_seconds: input.durationSeconds ?? null,
    latest_render_id: null,
    project_id: input.projectId,
    ratio: input.ratio,
    rendered_video_url: null,
    source: input.source,
    source_video_id: input.sourceVideoId,
    source_video_url: input.sourceVideoUrl,
    status: draft ? "draft" : "ready",
    thumbnail_url: input.thumbnailUrl ?? null,
    title: input.title,
    updated_at: now,
    user_id: input.userId,
  };
  const { data, error } = await getSupabaseServerClient()
    .from(EDITABLE_VIDEOS_TABLE)
    .upsert(editableVideo, {
      ignoreDuplicates: true,
      onConflict: "user_id,project_id,source_video_id",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not create editable video: ${error.message}`);
  }

  const row = data ?? (await getEditableVideoRowForOwner(input));

  if (!row) {
    throw new Error("Editable video was not available after creation.");
  }

  return serializeEditableVideo(row);
}

export async function saveEditableVideoDraftForOwner(params: {
  draft: EditableVideoDraftInput;
  sourceVideoId: string;
  userId: string;
}) {
  const current = await getEditableVideoRowForOwner(params);

  if (!current) {
    return null;
  }

  const draft = normalizeEditableVideoDraftInput(params.draft);

  if (!draft) {
    throw new Error("The edit draft is invalid.");
  }

  const { data, error } = await getSupabaseServerClient()
    .from(EDITABLE_VIDEOS_TABLE)
    .update({
      draft_json: toJson(draft),
      status: current.status === "rendering" ? "rendering" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save editable video draft: ${error.message}`);
  }

  return serializeEditableVideo(data);
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

  const { data: editableVideoRow, error: editableVideoError } =
    await getSupabaseServerClient()
      .from(EDITABLE_VIDEOS_TABLE)
      .upsert(editableVideo, {
        onConflict: "user_id,project_id,source_video_id",
      })
      .select("deleted_at")
      .maybeSingle();

  if (editableVideoError) {
    throw new Error(
      `Could not persist editable video: ${editableVideoError.message}`,
    );
  }

  if (!editableVideoRow || editableVideoRow.deleted_at) {
    throw new Error("The source video is no longer available for editing.");
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
  const { data: completedRenderJob, error: renderJobError } = await client
    .from(VIDEO_RENDER_JOBS_TABLE)
    .update({
      completed_at: now,
      error_message: null,
      output_s3_key: input.key,
      output_url: input.url,
      status: "completed",
      updated_at: now,
    })
    .eq("render_id", input.renderId)
    .select("draft_json")
    .maybeSingle();

  if (renderJobError) {
    throw new Error(`Could not mark render as completed: ${renderJobError.message}`);
  }

  const current = await getEditableVideoRowForOwner({
    sourceVideoId: input.sourceVideoId,
    userId: input.userId,
  });
  const draftIsCurrent =
    current?.latest_render_id === input.renderId &&
    areJsonValuesEqual(current.draft_json, completedRenderJob?.draft_json);
  const { error: editableVideoError } = await client
    .from(EDITABLE_VIDEOS_TABLE)
    .update({
      rendered_video_url: input.url,
      status: draftIsCurrent ? "rendered" : "draft",
      ...(draftIsCurrent ? { updated_at: now } : {}),
    })
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("source_video_id", input.sourceVideoId)
    .eq("latest_render_id", input.renderId)
    .is("deleted_at", null);

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
  const { data: failedRenderJob, error: renderJobError } = await client
    .from(VIDEO_RENDER_JOBS_TABLE)
    .update({
      completed_at: now,
      error_message: params.errorMessage.slice(0, 1000),
      status: "failed",
      updated_at: now,
    })
    .eq("render_id", params.renderId)
    .select("draft_json")
    .maybeSingle();

  if (renderJobError) {
    throw new Error(`Could not mark render as failed: ${renderJobError.message}`);
  }

  const current = await getEditableVideoRowForOwner(params);
  const draftIsCurrent =
    current?.latest_render_id === params.renderId &&
    areJsonValuesEqual(current.draft_json, failedRenderJob?.draft_json);
  const { error: editableVideoError } = await client
    .from(EDITABLE_VIDEOS_TABLE)
    .update({
      status: draftIsCurrent ? "failed" : "draft",
      ...(draftIsCurrent ? { updated_at: now } : {}),
    })
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .eq("source_video_id", params.sourceVideoId)
    .eq("latest_render_id", params.renderId)
    .is("deleted_at", null);

  if (editableVideoError) {
    throw new Error(
      `Could not mark editable video render as failed: ${editableVideoError.message}`,
    );
  }
}

async function getEditableVideoRowForOwner(params: {
  sourceVideoId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(EDITABLE_VIDEOS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("source_video_id", params.sourceVideoId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load editable video: ${error.message}`);
  }

  return data;
}

function serializeEditableVideo(row: EditableVideoRow): EditableVideo {
  const draft = normalizeEditableVideoDraftInput(row.draft_json);

  return {
    createdAt: row.created_at,
    draft: draft
      ? {
          ...draft,
          updatedAt: row.updated_at,
        }
      : null,
    durationSeconds: row.duration_seconds ?? null,
    id: row.source_video_id,
    projectId: row.project_id,
    ratio: row.ratio,
    renderedVideoUrl: row.rendered_video_url ?? null,
    source: row.source,
    status: row.status,
    thumbnailUrl: row.thumbnail_url ?? null,
    title: row.title,
    videoUrl: row.source_video_url ?? null,
  };
}

function areJsonValuesEqual(first: Json | undefined, second: Json | undefined) {
  return stableJsonString(first) === stableJsonString(second);
}

function stableJsonString(value: Json | undefined) {
  return JSON.stringify(normalizeJsonValue(value));
}

function normalizeJsonValue(value: Json | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, Json] => entry[1] !== undefined)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)]),
    );
  }

  return value ?? null;
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
