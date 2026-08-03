import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { DemoContentType } from "@/lib/demo/demo-upload";

const DEMO_VIDEOS_TABLE = "demo_videos";

export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type DemoVideoRatio = "9:16" | "1:1" | "4:5" | "16:9" | "other";

export type DemoVideoStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "draft"
  | "rendering"
  | "rendered"
  | "failed";

type DemoVideoInsert = {
  draft_json?: Json;
  error_message?: string | null;
  file_name: string;
  file_size_bytes: number;
  file_type: DemoContentType;
  height?: number | null;
  id: string;
  latest_render_id?: string | null;
  project_id: string;
  ratio?: DemoVideoRatio;
  rendered_video_url?: string | null;
  source_s3_key: string;
  source_video_url: string;
  status?: DemoVideoStatus;
  thumbnail_url?: string | null;
  title: string;
  updated_at?: string;
  user_id: string;
  width?: number | null;
};

type DemoVideoUpdate = Partial<
  Omit<DemoVideoInsert, "id" | "project_id" | "source_s3_key" | "user_id">
> & {
  deleted_at?: string | null;
  duration_seconds?: number | null;
};

export type DemoVideoRow = DemoVideoInsert & {
  created_at: string;
  deleted_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  height: number | null;
  latest_render_id: string | null;
  ratio: DemoVideoRatio;
  rendered_video_url: string | null;
  status: DemoVideoStatus;
  thumbnail_url: string | null;
  updated_at: string;
  width: number | null;
};

export class DemoVideoNotFoundError extends Error {
  readonly code = "PGRST116";

  constructor() {
    super("Demo video was not found.");
    this.name = "DemoVideoNotFoundError";
  }
}

type DemoVideosDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      demo_videos: {
        Insert: DemoVideoInsert;
        Relationships: [];
        Row: DemoVideoRow;
        Update: DemoVideoUpdate;
      };
    };
    Views: Record<string, never>;
  };
};

export type CreateUploadingDemoVideoInput = {
  demoId: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: DemoContentType;
  projectId: string;
  sourceS3Key: string;
  sourceVideoUrl: string;
  title?: string;
  userId: string;
};

export type MarkDemoVideoReadyInput = {
  demoId: string;
  durationSeconds: number;
  height: number;
  projectId: string;
  ratio?: DemoVideoRatio;
  userId: string;
  width: number;
};

export type UpdateDemoVideoDraftInput = {
  demoId: string;
  draft: Record<string, Json | undefined>;
  projectId: string;
  title?: string;
  userId: string;
};

export type UpdateDemoVideoDetailsInput = {
  demoId: string;
  draft?: Record<string, Json | undefined>;
  projectId: string;
  status?: Extract<DemoVideoStatus, "ready" | "draft">;
  title?: string;
  userId: string;
};

let supabaseServerClient: SupabaseClient<DemoVideosDatabase> | null = null;

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
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
    throw new Error("Demo video storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<DemoVideosDatabase>(
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

export function getMissingDemoVideoStorageEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function isDemoVideoStorageConfigured() {
  return getMissingDemoVideoStorageEnvVars().length === 0;
}

export async function createUploadingDemoVideo(
  input: CreateUploadingDemoVideoInput,
) {
  const now = new Date().toISOString();
  const demoVideo: DemoVideoInsert = {
    file_name: input.fileName,
    file_size_bytes: input.fileSizeBytes,
    file_type: input.fileType,
    id: input.demoId,
    project_id: input.projectId,
    source_s3_key: input.sourceS3Key,
    source_video_url: input.sourceVideoUrl,
    status: "uploading",
    title: input.title?.trim() || getDemoTitleFromFileName(input.fileName),
    updated_at: now,
    user_id: input.userId,
  };

  const { data, error } = await getSupabaseServerClient()
    .from(DEMO_VIDEOS_TABLE)
    .insert(demoVideo)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create demo video: ${error.message}`);
  }

  return data;
}

export async function markDemoVideoReady(input: MarkDemoVideoReadyInput) {
  return updateDemoVideoForOwner(
    {
      duration_seconds: input.durationSeconds,
      error_message: null,
      height: input.height,
      ratio: input.ratio ?? getDemoRatioFromDimensions(input.width, input.height),
      status: "ready",
      width: input.width,
    },
    {
      demoId: input.demoId,
      projectId: input.projectId,
      userId: input.userId,
    },
    "Could not mark demo video as ready",
  );
}

export async function updateDemoVideoDraft(input: UpdateDemoVideoDraftInput) {
  return updateDemoVideoForOwner(
    {
      draft_json: input.draft,
      error_message: null,
      latest_render_id: null,
      rendered_video_url: null,
      status: "draft",
      title: input.title?.trim() || undefined,
    },
    {
      demoId: input.demoId,
      projectId: input.projectId,
      userId: input.userId,
    },
    "Could not save demo video draft",
  );
}

export async function updateDemoVideoDetails(input: UpdateDemoVideoDetailsInput) {
  const update: DemoVideoUpdate = {};
  const title = input.title?.trim();

  if (title) {
    update.title = title;
  }

  if (input.draft) {
    update.draft_json = input.draft;
  }

  if (input.status) {
    update.status = input.status;
  } else if (input.draft) {
    update.status = "draft";
  }

  if (input.draft && update.status === "draft") {
    update.error_message = null;
    update.latest_render_id = null;
    update.rendered_video_url = null;
  }

  if (Object.keys(update).length === 0) {
    return getDemoVideo(input);
  }

  return updateDemoVideoForOwner(
    update,
    {
      demoId: input.demoId,
      projectId: input.projectId,
      userId: input.userId,
    },
    "Could not update demo video",
  );
}

export async function markDemoVideoRendering(params: {
  demoId: string;
  projectId: string;
  renderId: string;
  userId: string;
}) {
  return updateDemoVideoForOwner(
    {
      error_message: null,
      latest_render_id: params.renderId,
      status: "rendering",
    },
    params,
    "Could not mark demo video as rendering",
  );
}

export async function markDemoVideoFailed(params: {
  demoId: string;
  errorMessage: string;
  projectId: string;
  userId: string;
}) {
  return updateDemoVideoForOwner(
    {
      error_message: params.errorMessage.slice(0, 1000),
      status: "failed",
    },
    params,
    "Could not mark demo video as failed",
  );
}

export async function softDeleteDemoVideo(params: {
  demoId: string;
  projectId: string;
  userId: string;
}) {
  return updateDemoVideoForOwner(
    {
      deleted_at: new Date().toISOString(),
    },
    params,
    "Could not delete demo video",
  );
}

export async function getDemoVideo(params: {
  demoId: string;
  projectId: string;
  userId: string;
}) {
  const demo = await findDemoVideo(params);

  if (!demo) {
    throw new DemoVideoNotFoundError();
  }

  return demo;
}

export async function findDemoVideo(params: {
  demoId: string;
  projectId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(DEMO_VIDEOS_TABLE)
    .select("*")
    .eq("id", params.demoId)
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load demo video: ${error.message}`);
  }

  return data;
}

export async function listDemoVideos(params: {
  projectId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(DEMO_VIDEOS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list demo videos: ${error.message}`);
  }

  return data;
}

function getDemoTitleFromFileName(fileName: string) {
  const cleanName = fileName.trim();
  const lastDotIndex = cleanName.lastIndexOf(".");

  if (lastDotIndex <= 0) {
    return cleanName || "Uploaded demo";
  }

  return cleanName.slice(0, lastDotIndex) || "Uploaded demo";
}

function getDemoRatioFromDimensions(
  width: number,
  height: number,
): DemoVideoRatio {
  const aspectRatio = width / height;
  const knownRatios: Array<[DemoVideoRatio, number]> = [
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["16:9", 16 / 9],
  ];

  for (const [ratio, targetAspectRatio] of knownRatios) {
    if (Math.abs(aspectRatio - targetAspectRatio) <= 0.03) {
      return ratio;
    }
  }

  return "other";
}

async function updateDemoVideoForOwner(
  update: DemoVideoUpdate,
  owner: {
    demoId: string;
    projectId: string;
    userId: string;
  },
  errorPrefix: string,
) {
  const { data, error } = await getSupabaseServerClient()
    .from(DEMO_VIDEOS_TABLE)
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.demoId)
    .eq("user_id", owner.userId)
    .eq("project_id", owner.projectId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`${errorPrefix}: ${error.message}`);
  }

  return data;
}
