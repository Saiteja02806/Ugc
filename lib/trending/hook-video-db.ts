import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  HookSuggestion,
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

type HookVideoSuggestionRow = {
  business_profile_id: string;
  created_at: string;
  generation_id: string;
  id: string;
  text: string;
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
    Functions: Record<string, never>;
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
            "business_profile_id" | "generation_id" | "text" | "user_id"
          >;
        Relationships: [];
        Row: HookVideoSuggestionRow;
        Update: Partial<HookVideoSuggestionRow>;
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
  previewThumbnailUrl: string | null;
  scheduledPostId: string | null;
  selectedHookId: string;
  sourceKind: HookVideoSourceKind;
  status: HookVideoDraftStatus;
  trimEnd: number | null;
  trimStart: number;
  updatedAt: string;
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

export async function createHookVideoSuggestions(params: {
  businessProfileId: string;
  texts: string[];
  userId: string;
}): Promise<HookSuggestion[]> {
  const generationId = crypto.randomUUID();
  const rows = params.texts.map((text) => ({
    business_profile_id: params.businessProfileId,
    generation_id: generationId,
    id: crypto.randomUUID(),
    text: text.trim().slice(0, 220),
    user_id: params.userId,
  }));
  const { data, error } = await getClient()
    .from("hook_video_suggestions")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(`Could not save hook suggestions: ${error.message}`);
  }

  return data.map((row) => ({ id: row.id, text: row.text }));
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
    ...(params.librarySaved ? { library_saved_at: now } : {}),
    preview_thumbnail_url: params.previewThumbnailUrl,
    selected_hook_id: params.selectedHookId,
    status: params.librarySaved ? ("saved" as const) : ("draft" as const),
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

    if (data) {
      return mapDraft(data);
    }
  }

  const { data, error } = await getClient()
    .from("hook_video_drafts")
    .insert({
      ...values,
      id: crypto.randomUUID(),
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
    previewThumbnailUrl: row.preview_thumbnail_url,
    scheduledPostId: row.scheduled_post_id,
    selectedHookId: row.selected_hook_id,
    sourceKind: row.influencer_source,
    status: row.status,
    trimEnd: row.trim_end,
    trimStart: row.trim_start,
    updatedAt: row.updated_at,
  };
}
