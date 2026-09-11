import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildLockedHookAudioSelection,
  type LockedHookAudioSelection,
} from "@/lib/trending/hook-video-audio-lock-logic";
import {
  createHookAudioContentFingerprint,
  getDefaultHookAudioIntent,
  HOOK_AUDIO_MATCHING_VERSION,
  parseHookAudioIntent,
  selectHookAudio,
  type HookAudioAsset,
  type HookAudioEnergy,
  type HookAudioMood,
  type HookAudioSelection,
  type HookAudioType,
} from "@/lib/trending/hook-audio-matcher";

export type {
  HookAudioAsset,
  HookAudioEnergy,
  HookAudioIntent,
  HookAudioMood,
  HookAudioType,
} from "@/lib/trending/hook-audio-matcher";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type HookAudioAssetRow = {
  audio_url: string;
  duration_seconds: number;
  energy: string | null;
  hook_types: string[];
  id: string;
  impact_at_seconds: number | null;
  loopable: boolean;
  moods: string[];
  review_status: "approved" | "pending" | "rejected";
  status: "active" | "inactive";
};

type HookCatalogVideoRow = {
  avatar_type: string;
  deleted_at: string | null;
  duration_seconds: number | null;
  has_audio: boolean | null;
  hook_format_id: string | null;
  id: string;
  source_video_url: string;
  status: string;
};

type HookVideoAudioLockRow = {
  audio_asset_id: string;
  created_at: string;
  hook_video_id: string;
  notes: string | null;
  updated_at: string;
};

type HookAudioSelectionRow = {
  audio_asset_id: string;
  audio_intent: Json;
  content_fingerprint: string;
  hook_format_id: string;
  hook_video_draft_id: string | null;
  hook_video_id: string;
  hook_video_source: "catalog" | "user";
  hook_video_suggestion_id: string;
  id: string;
  match_score: number | null;
  matching_version: string;
  metadata: Json;
  selection_source: "video_locked" | "format_preferred" | "dynamic";
  updated_at: string;
  user_id: string;
};

type HookFormatRow = {
  audio_mode: "dynamic" | "preferred";
  id: string;
  status: "active" | "inactive";
};

type HookFormatAudioPreferenceRow = {
  audio_asset_id: string;
  hook_format_id: string;
  priority: number;
  status: "active" | "inactive";
};

type HookVideoSuggestionAudioRow = {
  audio_intent: Json | null;
  created_at: string;
  hook_text_format_id: string | null;
  id: string;
  influencer_video_id: string;
  suggestion_context: "composition" | "trending";
  user_id: string;
};

type HookAudioDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      avatar_assets: {
        Insert: Partial<HookCatalogVideoRow>;
        Relationships: [];
        Row: HookCatalogVideoRow;
        Update: Partial<HookCatalogVideoRow>;
      };
      hook_audio_assets: {
        Insert: Partial<HookAudioAssetRow>;
        Relationships: [];
        Row: HookAudioAssetRow;
        Update: Partial<HookAudioAssetRow>;
      };
      hook_video_audio_locks: {
        Insert: Pick<
          HookVideoAudioLockRow,
          "audio_asset_id" | "hook_video_id"
        > &
          Partial<HookVideoAudioLockRow>;
        Relationships: [];
        Row: HookVideoAudioLockRow;
        Update: Partial<HookVideoAudioLockRow>;
      };
      hook_audio_selections: {
        Insert: Partial<HookAudioSelectionRow>;
        Relationships: [];
        Row: HookAudioSelectionRow;
        Update: Partial<HookAudioSelectionRow>;
      };
      hook_formats: {
        Insert: Partial<HookFormatRow>;
        Relationships: [];
        Row: HookFormatRow;
        Update: Partial<HookFormatRow>;
      };
      hook_format_audio_preferences: {
        Insert: Partial<HookFormatAudioPreferenceRow>;
        Relationships: [];
        Row: HookFormatAudioPreferenceRow;
        Update: Partial<HookFormatAudioPreferenceRow>;
      };
      hook_video_suggestions: {
        Insert: Partial<HookVideoSuggestionAudioRow>;
        Relationships: [];
        Row: HookVideoSuggestionAudioRow;
        Update: Partial<HookVideoSuggestionAudioRow>;
      };
    };
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<HookAudioDatabase> | null = null;

export type ResolvedHookAudioSelection =
  | LockedHookAudioSelection
  | (HookAudioSelection & {
      hookVideoId: string;
    });

/**
 * Returns only human-approved, explicitly activated Hook audio. Pending imports
 * are deliberately invisible to the matching and rendering layers.
 */
export async function listActiveHookAudioAssets(): Promise<HookAudioAsset[]> {
  const { data, error } = await getClient()
    .from("hook_audio_assets")
    .select("*")
    .eq("status", "active")
    .eq("review_status", "approved")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Could not load Hook audio assets: ${error.message}`);
  }

  return data.flatMap((row) => {
    const asset = parseActiveAsset(row);
    return asset ? [asset] : [];
  });
}

/**
 * Resolves the human-approved per-video override before dynamic matching runs.
 * A stale or unsafe lock fails closed instead of silently using bad audio.
 */
export async function getLockedHookAudioForVideo(params: {
  hookVideoId: string;
}): Promise<LockedHookAudioSelection | null> {
  const hookVideoId = requireIdentifier(params.hookVideoId, "Hook video ID");
  const { data: lock, error } = await getClient()
    .from("hook_video_audio_locks")
    .select("*")
    .eq("hook_video_id", hookVideoId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Locked Hook audio: ${error.message}`);
  }

  if (!lock) return null;
  return loadValidatedLockCandidate({
    audioAssetId: lock.audio_asset_id,
    hookVideoId: lock.hook_video_id,
  });
}

/**
 * Resolves a catalog Hook's sound in the same order as the product contract:
 * a human video lock wins, then a reviewed format preference, then the
 * deterministic semantic matcher. A silent catalog clip never falls through
 * to a synthetic silence track.
 */
export async function resolveHookAudioForVideo(params: {
  draftId?: string | null;
  hookVideoId: string;
  suggestionId?: string | null;
  userId: string;
  videoDurationSeconds?: number | null;
}): Promise<ResolvedHookAudioSelection | null> {
  const hookVideoId = requireIdentifier(params.hookVideoId, "Hook video ID");
  const locked = await getLockedHookAudioForVideo({ hookVideoId });
  if (locked) return locked;

  const [videoResult, suggestionResult] = await Promise.all([
    getClient()
      .from("avatar_assets")
      .select("*")
      .eq("id", hookVideoId)
      .maybeSingle(),
    loadHookSuggestionForAudio({
      hookVideoId,
      suggestionId: params.suggestionId,
      userId: params.userId,
    }),
  ]);

  if (videoResult.error) {
    throw new Error(`Could not load Hook video: ${videoResult.error.message}`);
  }
  if (!videoResult.data) {
    throw new Error("The selected Hook video was not found.");
  }

  const video = videoResult.data;
  if (video.has_audio !== false) {
    // Catalog videos that already carry source audio keep that source audio.
    return null;
  }
  if (
    video.avatar_type !== "global" ||
    video.status !== "ready" ||
    video.deleted_at !== null ||
    !video.hook_format_id ||
    !Number.isFinite(Number(video.duration_seconds)) ||
    Number(video.duration_seconds) <= 0 ||
    !video.source_video_url.startsWith("https://")
  ) {
    throw new Error("The selected Hook video is not available for audio.");
  }

  const suggestion = suggestionResult;
  const intent =
    parseHookAudioIntent(suggestion?.audio_intent) ??
    getDefaultHookAudioIntent(suggestion?.hook_text_format_id);
  const contentFingerprint = createHookAudioContentFingerprint({
    hookTextFormatId: suggestion?.hook_text_format_id ?? null,
    hookVideoId,
    intent,
  });
  const videoDurationSeconds = getHookAudioDuration({
    fallback: Number(video.duration_seconds),
    requested: params.videoDurationSeconds,
  });

  const [assets, formatResult, preferencesResult] = await Promise.all([
    listActiveHookAudioAssets(),
    getClient()
      .from("hook_formats")
      .select("*")
      .eq("id", video.hook_format_id)
      .maybeSingle(),
    getClient()
      .from("hook_format_audio_preferences")
      .select("*")
      .eq("hook_format_id", video.hook_format_id)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .order("audio_asset_id", { ascending: true }),
  ]);

  if (formatResult.error) {
    throw new Error(`Could not load Hook format: ${formatResult.error.message}`);
  }
  if (preferencesResult.error) {
    throw new Error(
      `Could not load Hook audio preferences: ${preferencesResult.error.message}`,
    );
  }

  const preferredAssetIds =
    formatResult.data?.status === "active" &&
    formatResult.data.audio_mode === "preferred"
      ? preferencesResult.data.map((preference) => preference.audio_asset_id)
      : [];
  const selection = selectHookAudio({
    assets,
    intent,
    preferredAssetIds,
    videoDurationSeconds,
  });

  if (!selection) {
    throw new Error(
      "No approved Hook audio can cover this video's duration.",
    );
  }

  // A preview can be opened on a catalog video before a Hook suggestion has
  // been assigned. The audio is still safe to preview, but there is no valid
  // foreign key with which to persist that preview-only choice.
  if (!suggestion) {
    return { ...selection, hookVideoId };
  }

  const { error: saveError } = await getClient()
    .from("hook_audio_selections")
    .upsert(
      {
        audio_asset_id: selection.audioAssetId,
        audio_intent: selection.intent,
        content_fingerprint: contentFingerprint,
        hook_format_id: video.hook_format_id,
        hook_video_draft_id: params.draftId ?? null,
        hook_video_id: hookVideoId,
        hook_video_source: "catalog",
        hook_video_suggestion_id: suggestion.id,
        match_score: selection.matchScore,
        matching_version: HOOK_AUDIO_MATCHING_VERSION,
        metadata: {
          resolver: "hook-audio-db",
          videoDurationSeconds,
        },
        selection_source: selection.selectionSource,
        user_id: params.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hook_video_suggestion_id" },
    );

  if (saveError) {
    throw new Error(`Could not save Hook audio selection: ${saveError.message}`);
  }

  return { ...selection, hookVideoId };
}

export async function resolveHookAudioForPreview(params: {
  hookVideoId: string;
  userId: string;
  videoDurationSeconds?: number | null;
}) {
  return resolveHookAudioForVideo(params);
}

async function loadHookSuggestionForAudio(params: {
  hookVideoId: string;
  suggestionId?: string | null;
  userId: string;
}) {
  const suggestionId = params.suggestionId?.trim();
  let query = getClient()
    .from("hook_video_suggestions")
    .select("*")
    .eq("user_id", params.userId)
    .eq("suggestion_context", "trending");

  if (suggestionId) {
    query = query.eq("id", suggestionId);
  } else {
    query = query.eq("influencer_video_id", params.hookVideoId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Hook suggestion audio intent: ${error.message}`);
  }
  if (suggestionId && !data) {
    throw new Error("The selected Hook suggestion was not found.");
  }
  if (suggestionId && data?.influencer_video_id !== params.hookVideoId) {
    throw new Error("The selected Hook suggestion belongs to a different video.");
  }
  return data;
}

function getHookAudioDuration(params: {
  fallback: number;
  requested?: number | null;
}) {
  if (
    params.requested !== null &&
    params.requested !== undefined &&
    Number.isFinite(params.requested) &&
    params.requested > 0
  ) {
    return params.requested;
  }
  return params.fallback;
}

/**
 * Server-only configuration path for future reviewed mappings. Upserting on
 * hook_video_id replaces only that video's lock; it never affects peers in the
 * same visual format. The database trigger repeats these safety checks.
 */
export async function configureHookVideoAudioLock(params: {
  audioAssetId: string;
  hookVideoId: string;
  notes?: string | null;
}): Promise<LockedHookAudioSelection> {
  const audioAssetId = requireIdentifier(params.audioAssetId, "Hook audio ID");
  const hookVideoId = requireIdentifier(params.hookVideoId, "Hook video ID");
  const notes = normalizeNotes(params.notes);
  const selection = await loadValidatedLockCandidate({
    audioAssetId,
    hookVideoId,
  });
  const { error } = await getClient()
    .from("hook_video_audio_locks")
    .upsert(
      {
        audio_asset_id: audioAssetId,
        hook_video_id: hookVideoId,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hook_video_id" },
    );

  if (error) {
    throw new Error(`Could not configure Locked Hook audio: ${error.message}`);
  }

  return selection;
}

export async function removeHookVideoAudioLock(params: {
  hookVideoId: string;
}): Promise<boolean> {
  const hookVideoId = requireIdentifier(params.hookVideoId, "Hook video ID");
  const { data, error } = await getClient()
    .from("hook_video_audio_locks")
    .delete()
    .eq("hook_video_id", hookVideoId)
    .select("*");

  if (error) {
    throw new Error(`Could not remove Locked Hook audio: ${error.message}`);
  }

  return data.length > 0;
}

async function loadValidatedLockCandidate(params: {
  audioAssetId: string;
  hookVideoId: string;
}) {
  const [videoResult, audioResult] = await Promise.all([
    getClient()
      .from("avatar_assets")
      .select("*")
      .eq("id", params.hookVideoId)
      .maybeSingle(),
    getClient()
      .from("hook_audio_assets")
      .select("*")
      .eq("id", params.audioAssetId)
      .maybeSingle(),
  ]);

  if (videoResult.error) {
    throw new Error(`Could not load Hook video: ${videoResult.error.message}`);
  }
  if (audioResult.error) {
    throw new Error(`Could not load Hook audio: ${audioResult.error.message}`);
  }
  if (!videoResult.data) {
    throw new Error("The selected Hook video was not found.");
  }
  if (!audioResult.data) {
    throw new Error("The selected Hook audio was not found.");
  }

  return buildLockedHookAudioSelection({
    audio: {
      audioUrl: audioResult.data.audio_url,
      durationSeconds: Number(audioResult.data.duration_seconds),
      id: audioResult.data.id,
      loopable: audioResult.data.loopable,
      reviewStatus: audioResult.data.review_status,
      status: audioResult.data.status,
    },
    video: {
      avatarType: videoResult.data.avatar_type,
      deletedAt: videoResult.data.deleted_at,
      durationSeconds:
        videoResult.data.duration_seconds === null
          ? null
          : Number(videoResult.data.duration_seconds),
      hasAudio: videoResult.data.has_audio,
      hookFormatId: videoResult.data.hook_format_id,
      id: videoResult.data.id,
      sourceVideoUrl: videoResult.data.source_video_url,
      status: videoResult.data.status,
    },
  });
}

function requireIdentifier(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function normalizeNotes(value: string | null | undefined) {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 1000) {
    throw new Error("Lock notes must contain between 1 and 1000 characters.");
  }
  return normalized;
}

function parseActiveAsset(row: HookAudioAssetRow): HookAudioAsset | null {
  if (
    row.status !== "active" ||
    row.review_status !== "approved" ||
    row.loopable !== false ||
    !row.audio_url.startsWith("https://") ||
    !Number.isFinite(Number(row.duration_seconds)) ||
    Number(row.duration_seconds) <= 0 ||
    row.moods.length < 1 ||
    row.moods.length > 2 ||
    row.hook_types.length < 2 ||
    row.hook_types.length > 4 ||
    !row.moods.every(isMood) ||
    !row.hook_types.every(isHookType) ||
    !isEnergy(row.energy)
  ) {
    return null;
  }

  return {
    audioUrl: row.audio_url,
    durationSeconds: Number(row.duration_seconds),
    energy: row.energy,
    hookTypes: row.hook_types,
    id: row.id,
    impactAtSeconds:
      row.impact_at_seconds === null
        ? null
        : Number(row.impact_at_seconds),
    loopable: false,
    moods: row.moods,
  };
}

function isMood(value: unknown): value is HookAudioMood {
  return [
    "calm",
    "curious",
    "playful",
    "serious",
    "uplifting",
    "urgent",
  ].includes(String(value));
}

function isHookType(value: unknown): value is HookAudioType {
  return [
    "authority",
    "benefit",
    "curiosity",
    "problem",
    "story",
    "transformation",
    "warning",
  ].includes(String(value));
}

function isEnergy(value: unknown): value is HookAudioEnergy {
  return ["high", "low", "medium"].includes(String(value));
}

function getClient() {
  if (client) return client;
  const url = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Hook audio database environment is unavailable.");
  }
  client = createClient<HookAudioDatabase>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
