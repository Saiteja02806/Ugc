import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildLockedHookAudioSelection,
  type LockedHookAudioSelection,
} from "@/lib/trending/hook-video-audio-lock-logic";

export type HookAudioMood =
  | "calm"
  | "curious"
  | "playful"
  | "serious"
  | "uplifting"
  | "urgent";

export type HookAudioType =
  | "authority"
  | "benefit"
  | "curiosity"
  | "problem"
  | "story"
  | "transformation"
  | "warning";

export type HookAudioEnergy = "high" | "low" | "medium";

export type HookAudioAsset = {
  audioUrl: string;
  durationSeconds: number;
  energy: HookAudioEnergy;
  hookTypes: HookAudioType[];
  id: string;
  impactAtSeconds: number | null;
  loopable: false;
  moods: HookAudioMood[];
};

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
    };
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<HookAudioDatabase> | null = null;

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
