import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  HOOK_TEXT_FIXED_FONT_SIZE,
  HOOK_TEXT_LAYOUT_VERSION,
  LEGACY_HOOK_TEXT_LAYOUT_VERSION,
  type HookTextLayoutVersion,
} from "@/lib/trending/hook-text-layout";

import type {
  HookVideoDraftStatus,
  HookVideoSourceKind,
} from "@/lib/trending/hook-video-types";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type HookVideoRenderStatus =
  | "not_requested"
  | "queued"
  | "rendering"
  | "ready"
  | "failed";

type HookVideoSuggestionRow = {
  audio_intent: Json | null;
  business_profile_id: string;
  business_profile_version: number | null;
  campaign_purpose:
    | "app_install"
    | "conversion"
    | "education"
    | "product_discovery"
    | "retargeting"
    | null;
  candidate_index: number | null;
  created_at: string;
  demo_asset_id: string | null;
  duration_seconds: number | null;
  generation_job_id: string | null;
  generation_id: string;
  generator_model: string | null;
  id: string;
  influencer_id: string;
  influencer_key: string | null;
  influencer_name: string | null;
  influencer_source: HookVideoSourceKind;
  influencer_video_id: string;
  influencer_video_title: string | null;
  input_context_hash: string | null;
  industry_pack_id: string | null;
  hook_text_format_id: string | null;
  hook_text_format_library_version: string | null;
  hook_text_variant_id: string | null;
  opening_lines: Json | null;
  pattern_id: string | null;
  pattern_library_version: string | null;
  prompt_version: string | null;
  quality_score: number | null;
  reaction_type: string | null;
  readability_review: Json | null;
  selection_version: string | null;
  source_duration_seconds: number | null;
  suggestion_context: "composition" | "trending";
  text: string;
  thumbnail_url: string | null;
  trim_end: number | null;
  trim_start: number | null;
  user_id: string;
  validation_metadata: Json | null;
  validator_version: string | null;
  visual_fit: Json | null;
  visual_group: string | null;
};

type UserHookVideoAssignmentRow = {
  business_profile_id: string;
  business_profile_version: number;
  completed_at: string | null;
  created_at: string;
  hook_suggestion_id: string;
  id: string;
  last_opened_at: string | null;
  position: number;
  state:
    | "active"
    | "completed_skipped"
    | "selected"
    | "superseded";
  updated_at: string;
  user_id: string;
};

type HookVideoDraftRow = {
  created_at: string;
  demo_asset_id: string;
  demo_title: string;
  hook_text: string;
  id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_source: HookVideoSourceKind;
  influencer_video_id: string;
  influencer_video_title: string;
  library_saved_at: string | null;
  metadata: Json;
  preview_thumbnail_url: string | null;
  render_error: string | null;
  render_fingerprint: string | null;
  render_id: string | null;
  render_job_id: string | null;
  render_requested_at: string | null;
  render_status: HookVideoRenderStatus;
  rendered_at: string | null;
  rendered_media_asset_id: string | null;
  rendered_video_url: string | null;
  scheduled_post_id: string | null;
  selected_hook_id: string;
  status: HookVideoDraftStatus;
  trim_end: number | null;
  trim_start: number;
  updated_at: string;
  user_id: string;
};

type HookVideoDatabase = {
  public: {
    Functions: {
      claim_hook_video_library_render: {
        Args: {
          p_draft_id: string;
          p_render_fingerprint: string;
          p_user_id: string;
        };
        Returns: HookVideoDraftRow[];
      };
    };
    Tables: {
      hook_video_drafts: {
        Insert: Partial<HookVideoDraftRow> &
          Pick<
            HookVideoDraftRow,
            | "demo_asset_id"
            | "demo_title"
            | "hook_text"
            | "influencer_id"
            | "influencer_name"
            | "influencer_source"
            | "influencer_video_id"
            | "influencer_video_title"
            | "selected_hook_id"
            | "user_id"
          >;
        Relationships: [];
        Row: HookVideoDraftRow;
        Update: Partial<HookVideoDraftRow>;
      };
      hook_video_suggestions: {
        Insert: Partial<HookVideoSuggestionRow> &
          Pick<
            HookVideoSuggestionRow,
            | "business_profile_id"
            | "generation_id"
            | "influencer_id"
            | "influencer_source"
            | "influencer_video_id"
            | "text"
            | "user_id"
          >;
        Relationships: [];
        Row: HookVideoSuggestionRow;
        Update: Partial<HookVideoSuggestionRow>;
      };
      user_hook_video_assignments: {
        Insert: Partial<UserHookVideoAssignmentRow> &
          Pick<
            UserHookVideoAssignmentRow,
            | "business_profile_id"
            | "business_profile_version"
            | "hook_suggestion_id"
            | "position"
            | "user_id"
          >;
        Relationships: [];
        Row: UserHookVideoAssignmentRow;
        Update: Partial<UserHookVideoAssignmentRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type HookVideoDraftRecord = {
  createdAt: string;
  demoAssetId: string;
  demoTitle: string;
  hookText: string;
  id: string;
  influencerId: string;
  influencerName: string;
  influencerVideoId: string;
  influencerVideoTitle: string;
  librarySavedAt: string | null;
  renderError: string | null;
  renderFingerprint: string | null;
  renderId: string | null;
  renderJobId: string | null;
  renderRequestedAt: string | null;
  renderStatus: HookVideoRenderStatus;
  renderedAt: string | null;
  renderedMediaAssetId: string | null;
  renderedVideoUrl: string | null;
  scheduledPostId: string | null;
  selectedHookId: string;
  sourceKind: HookVideoSourceKind;
  status: HookVideoDraftStatus;
  trimEnd: number | null;
  trimStart: number;
  updatedAt: string;
};

export type TrendingHookIdeaRecord = {
  assignmentId: string;
  candidateIndex: number;
  createdAt: string;
  durationSeconds: number;
  hookText: string;
  id: string;
  influencerId: string;
  influencerName: string;
  influencerVideoId: string;
  influencerVideoTitle: string;
  openingLines: string[];
  overlayFontSize: number;
  overlayLayoutVersion: HookTextLayoutVersion;
  hookTextFormatId: string | null;
  patternId: string | null;
  writingFormatId: string;
  position: number;
  sourceKind: HookVideoSourceKind;
  sourceDurationSeconds: number;
  thumbnailUrl: string | null;
  trimEnd: number | null;
  trimStart: number;
};

let client: SupabaseClient<HookVideoDatabase> | null = null;

export function getMissingHookVideoDbEnvVars() {
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

export async function listTrendingHookVideoSuggestions(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  promptVersion?: string;
  userId: string;
}) {
  let query = getClient()
    .from("hook_video_suggestions")
    .select("*")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("suggestion_context", "trending");

  if (params.promptVersion) {
    query = query.eq("prompt_version", params.promptVersion);
  }

  const { data, error } = await query.order("candidate_index", {
    ascending: true,
  });

  if (error) {
    throw new Error(`Could not load Trending Hook ideas: ${error.message}`);
  }

  return data;
}

export async function listActiveTrendingHookIdeas(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  promptVersion?: string;
  userId: string;
}): Promise<TrendingHookIdeaRecord[]> {
  const { data: assignments, error: assignmentError } = await getClient()
    .from("user_hook_video_assignments")
    .select("*")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("state", "active")
    .order("position", { ascending: true });

  if (assignmentError) {
    throw new Error(
      `Could not load Trending Hook assignments: ${assignmentError.message}`,
    );
  }

  if (assignments.length === 0) {
    return [];
  }

  const suggestionIds = assignments.map(
    (assignment) => assignment.hook_suggestion_id,
  );
  let suggestionQuery = getClient()
    .from("hook_video_suggestions")
    .select("*")
    .in("id", suggestionIds)
    .eq("user_id", params.userId)
    .eq("suggestion_context", "trending");

  if (params.promptVersion) {
    suggestionQuery = suggestionQuery.eq(
      "prompt_version",
      params.promptVersion,
    );
  }

  const {
    data: suggestions,
    error: suggestionError,
  } = await suggestionQuery;

  if (suggestionError) {
    throw new Error(
      `Could not load assigned Trending Hook ideas: ${suggestionError.message}`,
    );
  }

  const suggestionById = new Map(
    suggestions.map((suggestion) => [suggestion.id, suggestion]),
  );

  return assignments.flatMap((assignment) => {
    const suggestion = suggestionById.get(assignment.hook_suggestion_id);
    const openingLines = parseOpeningLines(
      suggestion?.opening_lines ?? null,
      suggestion?.text ?? null,
    );
    const renderLayout = suggestion
      ? parseHookSuggestionRenderLayout({
          hookText: suggestion.text,
          openingLines: suggestion.opening_lines,
          visualFit: suggestion.visual_fit,
        })
      : null;

    if (
      !suggestion ||
      suggestion.business_profile_id !== params.businessProfileId ||
      suggestion.business_profile_version !==
        params.businessProfileVersion ||
      !isCompleteTrendingHookSuggestion(suggestion) ||
      !openingLines ||
      !renderLayout ||
      !(suggestion.hook_text_format_id || suggestion.pattern_id)
    ) {
      return [];
    }

    return [
      {
        assignmentId: assignment.id,
        candidateIndex: suggestion.candidate_index,
        createdAt: suggestion.created_at,
        durationSeconds: suggestion.duration_seconds,
        hookText: suggestion.text,
        hookTextFormatId: suggestion.hook_text_format_id,
        id: suggestion.id,
        influencerId: suggestion.influencer_id,
        influencerName: suggestion.influencer_name,
        influencerVideoId: suggestion.influencer_video_id,
        influencerVideoTitle: suggestion.influencer_video_title,
        openingLines,
        overlayFontSize: renderLayout.fontSize,
        overlayLayoutVersion: renderLayout.layoutVersion,
        patternId: suggestion.pattern_id,
        writingFormatId:
          suggestion.hook_text_format_id ?? suggestion.pattern_id!,
        position: assignment.position,
        sourceKind: suggestion.influencer_source,
        sourceDurationSeconds: suggestion.source_duration_seconds,
        thumbnailUrl: suggestion.thumbnail_url,
        trimEnd: suggestion.trim_end,
        trimStart: suggestion.trim_start,
      },
    ];
  });
}

export async function updateTrendingHookVideoAssignment(params: {
  action: "selected" | "skipped";
  assignmentId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const values =
    params.action === "skipped"
      ? {
          completed_at: now,
          state: "completed_skipped" as const,
          updated_at: now,
        }
      : {
          completed_at: now,
          last_opened_at: now,
          state: "selected" as const,
          updated_at: now,
        };
  const { data, error } = await getClient()
    .from("user_hook_video_assignments")
    .update(values)
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("state", "active")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update Trending Hook idea: ${error.message}`);
  }

  if (!data) {
    throw new Error("This Trending Hook idea is no longer active.");
  }

  return data;
}

export async function getHookVideoSuggestionForUser(params: {
  suggestionId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("hook_video_suggestions")
    .select("*")
    .eq("id", params.suggestionId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load hook suggestion: ${error.message}`);
  }

  return data;
}

export async function getEditableTrendingHookIdea(params: {
  assignmentId: string;
  suggestionId: string;
  userId: string;
}): Promise<TrendingHookIdeaRecord | null> {
  const [{ data: assignment, error: assignmentError }, suggestion] =
    await Promise.all([
      getClient()
        .from("user_hook_video_assignments")
        .select("*")
        .eq("id", params.assignmentId)
        .eq("hook_suggestion_id", params.suggestionId)
        .eq("user_id", params.userId)
        .in("state", ["active", "selected"])
        .maybeSingle(),
      getHookVideoSuggestionForUser({
        suggestionId: params.suggestionId,
        userId: params.userId,
      }),
    ]);

  if (assignmentError) {
    throw new Error(
      `Could not load this Trending Hook assignment: ${assignmentError.message}`,
    );
  }

  if (!assignment || !suggestion || !isCompleteTrendingHookSuggestion(suggestion)) {
    return null;
  }

  const openingLines = parseOpeningLines(
    suggestion.opening_lines,
    suggestion.text,
  );
  const renderLayout = parseHookSuggestionRenderLayout({
    hookText: suggestion.text,
    openingLines: suggestion.opening_lines,
    visualFit: suggestion.visual_fit,
  });

  if (
    !openingLines ||
    !renderLayout ||
    !(suggestion.hook_text_format_id || suggestion.pattern_id)
  ) {
    return null;
  }

  return {
    assignmentId: assignment.id,
    candidateIndex: suggestion.candidate_index,
    createdAt: suggestion.created_at,
    durationSeconds: suggestion.duration_seconds,
    hookText: suggestion.text,
    hookTextFormatId: suggestion.hook_text_format_id,
    id: suggestion.id,
    influencerId: suggestion.influencer_id,
    influencerName: suggestion.influencer_name,
    influencerVideoId: suggestion.influencer_video_id,
    influencerVideoTitle: suggestion.influencer_video_title,
    openingLines,
    overlayFontSize: renderLayout.fontSize,
    overlayLayoutVersion: renderLayout.layoutVersion,
    patternId: suggestion.pattern_id,
    writingFormatId:
      suggestion.hook_text_format_id ?? suggestion.pattern_id!,
    position: assignment.position,
    sourceKind: suggestion.influencer_source,
    sourceDurationSeconds: suggestion.source_duration_seconds,
    thumbnailUrl: suggestion.thumbnail_url,
    trimEnd: suggestion.trim_end,
    trimStart: suggestion.trim_start,
  };
}

export async function saveHookVideoDraft(params: {
  demoAssetId: string;
  demoTitle: string;
  draftId?: string | null;
  hookText: string;
  influencerId: string;
  influencerName: string;
  influencerVideoId: string;
  influencerVideoTitle: string;
  librarySaved: boolean;
  metadata?: Json;
  previewThumbnailUrl: string | null;
  selectedHookId: string;
  sourceKind: HookVideoSourceKind;
  trimEnd: number | null;
  trimStart: number;
  userId: string;
}) {
  const now = new Date().toISOString();
  const values = {
    demo_asset_id: params.demoAssetId,
    demo_title: params.demoTitle,
    hook_text: params.hookText.trim().slice(0, 220),
    influencer_id: params.influencerId,
    influencer_name: params.influencerName.trim().slice(0, 140),
    influencer_source: params.sourceKind,
    influencer_video_id: params.influencerVideoId,
    influencer_video_title: params.influencerVideoTitle.trim().slice(0, 180),
    ...(params.librarySaved
      ? { library_saved_at: now, status: "saved" as const }
      : {}),
    ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
    preview_thumbnail_url: params.previewThumbnailUrl,
    selected_hook_id: params.selectedHookId,
    trim_end: params.trimEnd,
    trim_start: params.trimStart,
    updated_at: now,
  };

  if (params.draftId) {
    const { data, error } = await getClient()
      .from("hook_video_drafts")
      .update(values)
      .eq("id", params.draftId)
      .eq("user_id", params.userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update Hook video draft: ${error.message}`);
    }

    if (!data) {
      throw new Error("This Hook video draft was not found.");
    }

    return mapDraft(data);
  }

  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .insert({
      ...values,
      id: crypto.randomUUID(),
      status: params.librarySaved ? "saved" : "draft",
      user_id: params.userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save Hook video draft: ${error.message}`);
  }

  return mapDraft(data);
}

export async function attachScheduleDraftToHookVideo(params: {
  draftId: string;
  scheduledPostId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .update({
      scheduled_post_id: params.scheduledPostId,
      status: "scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not attach schedule draft: ${error.message}`);
  }

  return mapDraft(data);
}

export async function claimHookVideoLibraryRender(params: {
  draftId: string;
  renderFingerprint: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "claim_hook_video_library_render",
    {
      p_draft_id: params.draftId,
      p_render_fingerprint: params.renderFingerprint,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(`Could not reserve Hook video render: ${error.message}`);
  }

  const row = data[0];

  if (!row) {
    throw new Error("This saved Hook video is not available for rendering.");
  }

  return mapDraft(row);
}

export async function attachHookVideoLibraryRenderJob(params: {
  draftId: string;
  jobId: string;
  renderId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .update({
      render_job_id: params.jobId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .eq("render_id", params.renderId)
    .eq("render_status", "queued")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not attach Hook video render job: ${error.message}`);
  }

  if (!data) {
    throw new Error("This Hook video render request is stale.");
  }

  return mapDraft(data);
}

export async function markHookVideoLibraryRenderQueueFailed(params: {
  draftId: string;
  errorMessage: string;
  renderId: string;
  userId: string;
}) {
  const { error } = await getClient()
    .from("hook_video_drafts")
    .update({
      render_error: params.errorMessage.slice(0, 500),
      render_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .eq("render_id", params.renderId)
    .in("render_status", ["queued", "rendering"]);

  if (error) {
    throw new Error(`Could not mark Hook video render failed: ${error.message}`);
  }
}

export async function listSavedHookVideoDrafts(userId: string) {
  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .select("*")
    .eq("user_id", userId)
    .not("library_saved_at", "is", null)
    .order("library_saved_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load saved Hook videos: ${error.message}`);
  }

  return data.map(mapDraft);
}

export async function getHookVideoDraftForUser(params: {
  draftId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .select("*")
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Hook video draft: ${error.message}`);
  }

  return data ? mapDraft(data) : null;
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Hook video storage is not configured.");
  }

  if (!client) {
    client = createClient<HookVideoDatabase>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function mapDraft(row: HookVideoDraftRow): HookVideoDraftRecord {
  return {
    createdAt: row.created_at,
    demoAssetId: row.demo_asset_id,
    demoTitle: row.demo_title,
    hookText: row.hook_text,
    id: row.id,
    influencerId: row.influencer_id,
    influencerName: row.influencer_name,
    influencerVideoId: row.influencer_video_id,
    influencerVideoTitle: row.influencer_video_title,
    librarySavedAt: row.library_saved_at,
    renderError: row.render_error,
    renderFingerprint: row.render_fingerprint,
    renderId: row.render_id,
    renderJobId: row.render_job_id,
    renderRequestedAt: row.render_requested_at,
    renderStatus: row.render_status,
    renderedAt: row.rendered_at,
    renderedMediaAssetId: row.rendered_media_asset_id,
    renderedVideoUrl: row.rendered_video_url,
    scheduledPostId: row.scheduled_post_id,
    selectedHookId: row.selected_hook_id,
    sourceKind: row.influencer_source,
    status: row.status,
    trimEnd: row.trim_end,
    trimStart: row.trim_start,
    updatedAt: row.updated_at,
  };
}

function isCompleteTrendingHookSuggestion(
  row: HookVideoSuggestionRow,
): row is HookVideoSuggestionRow & {
  candidate_index: number;
  duration_seconds: number;
  influencer_name: string;
  influencer_video_title: string;
  source_duration_seconds: number;
  trim_start: number;
} {
  return (
    row.suggestion_context === "trending" &&
    row.candidate_index !== null &&
    row.duration_seconds !== null &&
    row.duration_seconds > 0 &&
    row.influencer_name !== null &&
    row.influencer_video_title !== null &&
    row.source_duration_seconds !== null &&
    row.source_duration_seconds > 0 &&
    row.trim_start !== null
  );
}

function parseOpeningLines(value: Json | null, hookText: string | null) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    value.some(
      (line) => typeof line !== "string" || !line.trim(),
    )
  ) {
    return null;
  }

  const lines = value.map((line) =>
    String(line).trim().replace(/\s+/gu, " "),
  );
  const normalizedText = hookText?.replace(/\s+/gu, " ").trim() ?? "";

  return lines.join(" ") === normalizedText ? lines : null;
}

function parseOverlayFontSize(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const fontSize = value.fontSize;

  return typeof fontSize === "number" &&
    Number.isInteger(fontSize) &&
    fontSize >= 34 &&
    fontSize <= 60 &&
    fontSize % 2 === 0
    ? fontSize
    : null;
}

export function parseHookSuggestionRenderLayout(params: {
  hookText: string;
  openingLines: Json | null;
  visualFit: Json | null;
}) {
  const lines = parseOpeningLines(params.openingLines, params.hookText);
  const fontSize = parseOverlayFontSize(params.visualFit);

  if (!lines || !fontSize) return null;

  const overlayVersion =
    params.visualFit &&
    typeof params.visualFit === "object" &&
    !Array.isArray(params.visualFit) &&
    typeof params.visualFit.overlayVersion === "string"
      ? params.visualFit.overlayVersion
      : null;
  const layoutVersion =
    overlayVersion === "hook-overlay-v4-fixed-type" &&
    fontSize === HOOK_TEXT_FIXED_FONT_SIZE
      ? HOOK_TEXT_LAYOUT_VERSION
      : LEGACY_HOOK_TEXT_LAYOUT_VERSION;

  return { fontSize, layoutVersion, lines };
}
