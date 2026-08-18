import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  TrendingCreativeEditContent,
  TrendingCreativeEditFormat,
  TrendingCreativeEditRenderState,
} from "@/lib/trending/creative-edit-contract";
import type { classifyWallTextEdit } from "@/lib/trending/wall-text-edit-attribution";

const TRENDING_CREATIVE_EDITS_TABLE = "trending_creative_edits";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type TrendingCreativeEditRow = {
  assignment_id: string;
  content_json: Json;
  created_at: string;
  creative_id: string;
  format: TrendingCreativeEditFormat;
  id: string;
  position_json: Json;
  render_error: string | null;
  render_job_id: string | null;
  render_output_json: Json | null;
  render_status: TrendingCreativeEditRenderState;
  resolved_media_asset_id: string | null;
  revision: number;
  source_group_id: string | null;
  source_media_asset_id: string | null;
  source_selection_kind: "asset" | "group" | null;
  updated_at: string;
  user_id: string;
  wall_text_content_hash: string | null;
  wall_text_edit_classification: "none" | "minor" | "major" | null;
  wall_text_format_learning_eligible: boolean | null;
};

type TrendingCreativeDecisionRow = {
  assignment_id: string;
  creative_id: string;
  decision: "accepted" | "rejected";
  format: TrendingCreativeEditFormat;
  user_id: string;
};

type EditableAssignmentRow = {
  id: string;
};

type TrendingCreativeEditDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      trending_creative_decisions: {
        Insert: TrendingCreativeDecisionRow;
        Relationships: [];
        Row: TrendingCreativeDecisionRow;
        Update: never;
      };
      user_carousel_assignments: {
        Insert: never;
        Relationships: [];
        Row: EditableAssignmentRow & {
          carousel_id: string;
          state: string;
          user_id: string;
        };
        Update: never;
      };
      user_hook_video_assignments: {
        Insert: never;
        Relationships: [];
        Row: EditableAssignmentRow & {
          hook_suggestion_id: string;
          state: string;
          user_id: string;
        };
        Update: never;
      };
      user_wall_text_assignments: {
        Insert: never;
        Relationships: [];
        Row: EditableAssignmentRow & {
          state: string;
          user_id: string;
          wall_text_creative_id: string;
        };
        Update: never;
      };
      trending_creative_edits: {
        Insert: Partial<TrendingCreativeEditRow> &
          Pick<
            TrendingCreativeEditRow,
            | "assignment_id"
            | "content_json"
            | "creative_id"
            | "format"
            | "position_json"
            | "user_id"
          >;
        Relationships: [];
        Row: TrendingCreativeEditRow;
        Update: Partial<TrendingCreativeEditRow>;
      };
    };
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<TrendingCreativeEditDatabase> | null = null;

export function getMissingTrendingCreativeEditEnvVars() {
  return [
    !(
      process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    )
      ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
      : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
}

export async function assertEditableTrendingCreative(params: {
  assignmentId: string;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  userId: string;
}) {
  const client = getClient();
  const result =
    params.format === "carousel"
      ? await client
          .from("user_carousel_assignments")
          .select("id")
          .eq("id", params.assignmentId)
          .eq("carousel_id", params.creativeId)
          .eq("user_id", params.userId)
          .in("state", ["pending", "in_progress", "accepted"])
          .maybeSingle()
      : params.format === "hook_video"
        ? await client
            .from("user_hook_video_assignments")
            .select("id")
            .eq("id", params.assignmentId)
            .eq("hook_suggestion_id", params.creativeId)
            .eq("user_id", params.userId)
            .in("state", ["active", "selected"])
            .maybeSingle()
        : await client
            .from("user_wall_text_assignments")
            .select("id")
            .eq("id", params.assignmentId)
            .eq("wall_text_creative_id", params.creativeId)
            .eq("user_id", params.userId)
            .in("state", ["active", "selected"])
            .maybeSingle();
  const { data, error } = result;

  if (error) {
    throw new Error(`Could not verify this Trending edit: ${error.message}`);
  }

  if (!data) {
    throw new TrendingCreativeEditAccessError(
      "This Trending creative is no longer available to edit.",
      404,
    );
  }
}

export async function getTrendingCreativeEdit(params: {
  creativeId: string;
  format: TrendingCreativeEditFormat;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(TRENDING_CREATIVE_EDITS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("format", params.format)
    .eq("creative_id", params.creativeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load this Trending edit: ${error.message}`);
  }

  return data;
}

export async function upsertTrendingCreativeEdit(params: {
  assignmentId: string;
  content: TrendingCreativeEditContent;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  positions: Json;
  resolvedMediaAssetId?: string | null;
  sourceGroupId?: string | null;
  sourceMediaAssetId?: string | null;
  sourceSelectionKind?: "asset" | "group" | null;
  userId: string;
  wallTextAttribution?: ReturnType<typeof classifyWallTextEdit>;
}) {
  const existing = await getTrendingCreativeEdit(params);
  const now = new Date().toISOString();
  if (params.format === "wall_text") {
    if (!params.wallTextAttribution) {
      throw new Error("Wall-of-text edit attribution is required.");
    }
    const { data, error } = await (getClient() as SupabaseClient).rpc(
      "save_wall_text_edit_with_history_v1",
      {
        p_assignment_id: params.assignmentId,
        p_content_hash: params.wallTextAttribution.duplicateSignature.contentHash,
        p_content_json: params.content,
        p_creative_id: params.creativeId,
        p_edit_classification: params.wallTextAttribution.classification,
        p_expected_revision: existing?.revision ?? 0,
        p_normalized_text:
          params.wallTextAttribution.duplicateSignature.normalizedText,
        p_position_json: params.positions,
        p_resolved_media_asset_id: params.resolvedMediaAssetId ?? null,
        p_similarity_signature: params.wallTextAttribution.duplicateSignature,
        p_source_group_id: params.sourceGroupId ?? null,
        p_source_media_asset_id: params.sourceMediaAssetId ?? null,
        p_source_selection_kind: params.sourceSelectionKind ?? null,
        p_user_id: params.userId,
      },
    );
    if (error) {
      if (
        error.code === "23505" ||
        error.message.includes("wall_text_edit_revision_conflict")
      ) {
        throw new TrendingCreativeEditAccessError(
          "This Trending edit changed in another tab. Reload it and try again.",
          409,
        );
      }
      throw new Error(`Could not save this Wall-of-text edit: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Wall-of-text edit storage returned no row.");
    return row as TrendingCreativeEditRow;
  }
  const values = {
    assignment_id: params.assignmentId,
    content_json: params.content as unknown as Json,
    creative_id: params.creativeId,
    format: params.format,
    position_json: params.positions,
    render_error: null,
    render_job_id: null,
    render_output_json: null,
    render_status: "draft" as const,
    resolved_media_asset_id: params.resolvedMediaAssetId ?? null,
    revision: (existing?.revision ?? 0) + 1,
    source_group_id: params.sourceGroupId ?? null,
    source_media_asset_id: params.sourceMediaAssetId ?? null,
    source_selection_kind: params.sourceSelectionKind ?? null,
    updated_at: now,
    user_id: params.userId,
    wall_text_content_hash: null,
    wall_text_edit_classification: null,
    wall_text_format_learning_eligible: null,
  };
  const result = existing
    ? await getClient()
        .from(TRENDING_CREATIVE_EDITS_TABLE)
        .update(values)
        .eq("id", existing.id)
        .eq("user_id", params.userId)
        .eq("revision", existing.revision)
        .select("*")
        .maybeSingle()
    : await getClient()
        .from(TRENDING_CREATIVE_EDITS_TABLE)
        .insert(values)
        .select("*")
        .maybeSingle();
  const { data, error } = result;

  if (error) {
    if (error.code === "23505") {
      throw new TrendingCreativeEditAccessError(
        "This Trending edit changed in another tab. Reload it and try again.",
        409,
      );
    }

    throw new Error(`Could not save this Trending edit: ${error.message}`);
  }

  if (!data) {
    throw new TrendingCreativeEditAccessError(
      "This Trending edit changed in another tab. Reload it and try again.",
      409,
    );
  }

  return data;
}

export async function attachTrendingCreativeEditRenderJob(params: {
  editId: string;
  jobId: string;
  revision: number;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(TRENDING_CREATIVE_EDITS_TABLE)
    .update({
      render_error: null,
      render_job_id: params.jobId,
      render_status: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.editId)
    .eq("user_id", params.userId)
    .eq("revision", params.revision)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not attach the Trending render: ${error.message}`);
  }

  if (!data) {
    throw new Error("This Trending edit changed before rendering started.");
  }

  return data;
}

export async function markTrendingCreativeEditRenderFailed(params: {
  editId: string;
  errorMessage: string;
  revision: number;
  userId: string;
}) {
  const { error } = await getClient()
    .from(TRENDING_CREATIVE_EDITS_TABLE)
    .update({
      render_error: params.errorMessage.slice(0, 1_000),
      render_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.editId)
    .eq("user_id", params.userId)
    .eq("revision", params.revision);

  if (error) {
    throw new Error(`Could not record the Trending render failure: ${error.message}`);
  }
}

export class TrendingCreativeEditAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TrendingCreativeEditAccessError";
  }
}

function getClient() {
  if (client) {
    return client;
  }

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !key) {
    throw new Error("Trending creative edit storage is not configured.");
  }

  client = createClient<TrendingCreativeEditDatabase>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
