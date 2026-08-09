import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildWallAudioIntent,
  createWallTextContentFingerprint,
  selectWallAudio,
  type WallAudioAsset,
  type WallAudioEnergy,
  type WallAudioFitMode,
  type WallAudioMessageType,
  type WallAudioMood,
  type WallAudioSelection,
} from "./wall-audio-matcher.ts";
import type { TrendingWallTextContent } from "./wall-text-types.ts";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type WallAudioAssetRow = {
  audio_url: string;
  cue_start_seconds: number;
  duration_seconds: number;
  energy: string | null;
  id: string;
  loopable: boolean | null;
  message_types: string[];
  moods: string[];
  review_status: "approved" | "pending" | "rejected";
  status: "active" | "inactive" | "pending_review";
};

type WallTextAudioSelectionRow = {
  audio_asset_id: string;
  audio_intent: Json;
  content_fingerprint: string;
  created_at: string;
  creative_edit_id: string | null;
  creative_edit_revision: number | null;
  cue_start_seconds: number;
  fade_out_seconds: number;
  fit_mode: WallAudioFitMode;
  id: string;
  match_score: number;
  matching_version: string;
  output_duration_seconds: number;
  updated_at: string;
  user_id: string;
  video_duration_seconds: number;
  wall_text_creative_id: string;
};

type WallAudioDatabase = {
  public: {
    Functions: {
      save_wall_text_audio_selection: {
        Args: {
          p_audio_asset_id: string;
          p_audio_intent: Json;
          p_content_fingerprint: string;
          p_creative_edit_id: string | null;
          p_creative_edit_revision: number | null;
          p_cue_start_seconds: number;
          p_fade_out_seconds: number;
          p_fit_mode: WallAudioFitMode;
          p_match_score: number;
          p_matching_version: string;
          p_output_duration_seconds: number;
          p_user_id: string;
          p_video_duration_seconds: number;
          p_wall_text_creative_id: string;
        };
        Returns: WallTextAudioSelectionRow[];
      };
    };
    Tables: {
      wall_audio_assets: {
        Insert: Partial<WallAudioAssetRow>;
        Relationships: [];
        Row: WallAudioAssetRow;
        Update: Partial<WallAudioAssetRow>;
      };
      wall_text_audio_selections: {
        Insert: Partial<WallTextAudioSelectionRow>;
        Relationships: [];
        Row: WallTextAudioSelectionRow;
        Update: Partial<WallTextAudioSelectionRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type ResolvedWallTextAudioSelection = WallAudioSelection & {
  contentFingerprint: string;
  creativeEditId: string | null;
  creativeEditRevision: number | null;
  selectionId: string;
};

let client: SupabaseClient<WallAudioDatabase> | null = null;

export async function ensureBaseWallTextAudioSelections(params: {
  creatives: Array<{
    content: TrendingWallTextContent;
    creativeId: string;
    durationSeconds: number;
  }>;
  userId: string;
}) {
  const selections: ResolvedWallTextAudioSelection[] = [];

  for (const creative of params.creatives) {
    selections.push(
      await resolveWallTextAudioSelection({
        content: creative.content,
        creativeId: creative.creativeId,
        editId: null,
        editRevision: null,
        userId: params.userId,
        videoDurationSeconds: creative.durationSeconds,
      }),
    );
  }

  return selections;
}

export async function resolveWallTextAudioSelection(params: {
  content: TrendingWallTextContent;
  creativeId: string;
  editId?: string | null;
  editRevision?: number | null;
  excludeAssetIds?: string[];
  userId: string;
  videoDurationSeconds: number;
}): Promise<ResolvedWallTextAudioSelection> {
  const editId = params.editId ?? null;
  const editRevision = params.editRevision ?? null;
  if ((editId === null) !== (editRevision === null)) {
    throw new Error("Wall audio edit ID and revision must be provided together.");
  }

  const contentFingerprint = createWallTextContentFingerprint(params.content);
  const exactSelection = await getSelectionForScope({
    creativeId: params.creativeId,
    editId,
    editRevision,
    userId: params.userId,
  });
  const reusableSelection =
    exactSelection?.content_fingerprint === contentFingerprint
      ? exactSelection
      : await getLatestReusableSelection({
          contentFingerprint,
          creativeId: params.creativeId,
          userId: params.userId,
        });
  const [assets, recentAssetIds] = await Promise.all([
    listActiveWallAudioAssets(),
    listRecentWallAudioAssetIds({ userId: params.userId }),
  ]);
  const intent = buildWallAudioIntent(params.content);
  const selection = selectWallAudio({
    assets,
    excludeAssetIds: params.excludeAssetIds,
    intent,
    preferredAssetId: reusableSelection?.audio_asset_id,
    recentAssetIds,
    videoDurationSeconds: params.videoDurationSeconds,
  });

  if (!selection) {
    throw new Error(
      "No approved Wall audio can cover this video's duration.",
    );
  }

  const { data, error } = await getClient().rpc(
    "save_wall_text_audio_selection",
    {
      p_audio_asset_id: selection.audioAssetId,
      p_audio_intent: toJson(selection.intent),
      p_content_fingerprint: contentFingerprint,
      p_creative_edit_id: editId,
      p_creative_edit_revision: editRevision,
      p_cue_start_seconds: selection.cueStartSeconds,
      p_fade_out_seconds: selection.fadeOutSeconds,
      p_fit_mode: selection.fitMode,
      p_match_score: selection.matchScore,
      p_matching_version: selection.matchingVersion,
      p_output_duration_seconds: selection.outputDurationSeconds,
      p_user_id: params.userId,
      p_video_duration_seconds: params.videoDurationSeconds,
      p_wall_text_creative_id: params.creativeId,
    },
  );

  if (error) {
    throw new Error(`Could not save Wall audio selection: ${error.message}`);
  }

  const saved = data?.[0];
  if (!saved) {
    throw new Error("Wall audio selection was not saved.");
  }

  return {
    ...selection,
    contentFingerprint,
    creativeEditId: saved.creative_edit_id,
    creativeEditRevision: saved.creative_edit_revision,
    selectionId: saved.id,
  };
}

export async function listBaseWallTextAudioSelections(params: {
  creativeIds: string[];
  userId: string;
}) {
  const result = new Map<string, ResolvedWallTextAudioSelection>();
  if (params.creativeIds.length === 0) return result;

  const { data: selections, error } = await getClient()
    .from("wall_text_audio_selections")
    .select("*")
    .eq("user_id", params.userId)
    .in("wall_text_creative_id", params.creativeIds)
    .is("creative_edit_id", null);

  if (error) {
    throw new Error(`Could not load Wall audio selections: ${error.message}`);
  }
  if (selections.length === 0) return result;

  const assetById = await getActiveAssetMap(
    [...new Set(selections.map((selection) => selection.audio_asset_id))],
  );
  for (const selection of selections) {
    const asset = assetById.get(selection.audio_asset_id);
    if (!asset) continue;
    result.set(
      selection.wall_text_creative_id,
      resolveStoredSelection(selection, asset),
    );
  }
  return result;
}

async function listActiveWallAudioAssets(): Promise<WallAudioAsset[]> {
  const { data, error } = await getClient()
    .from("wall_audio_assets")
    .select("*")
    .eq("status", "active")
    .eq("review_status", "approved")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Could not load Wall audio assets: ${error.message}`);
  }

  return data.flatMap((row) => {
    const asset = parseActiveAsset(row);
    return asset ? [asset] : [];
  });
}

async function listRecentWallAudioAssetIds(params: {
  limit?: number;
  userId: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 30), 1), 100);
  const { data, error } = await getClient()
    .from("wall_text_audio_selections")
    .select("audio_asset_id")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load recent Wall audio usage: ${error.message}`);
  }

  return [...new Set(data.map((row) => row.audio_asset_id))];
}

async function getSelectionForScope(params: {
  creativeId: string;
  editId: string | null;
  editRevision: number | null;
  userId: string;
}) {
  let query = getClient()
    .from("wall_text_audio_selections")
    .select("*")
    .eq("user_id", params.userId)
    .eq("wall_text_creative_id", params.creativeId);

  query = params.editId
    ? query
        .eq("creative_edit_id", params.editId)
        .eq("creative_edit_revision", params.editRevision as number)
    : query.is("creative_edit_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Could not load existing Wall audio: ${error.message}`);
  }
  return data;
}

async function getLatestReusableSelection(params: {
  contentFingerprint: string;
  creativeId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("wall_text_audio_selections")
    .select("*")
    .eq("user_id", params.userId)
    .eq("wall_text_creative_id", params.creativeId)
    .eq("content_fingerprint", params.contentFingerprint)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not reuse existing Wall audio: ${error.message}`);
  }
  return data;
}

async function getActiveAssetMap(assetIds: string[]) {
  const result = new Map<string, WallAudioAsset>();
  if (assetIds.length === 0) return result;
  const { data, error } = await getClient()
    .from("wall_audio_assets")
    .select("*")
    .in("id", assetIds)
    .eq("status", "active")
    .eq("review_status", "approved");

  if (error) {
    throw new Error(`Could not hydrate Wall audio assets: ${error.message}`);
  }
  for (const row of data) {
    const asset = parseActiveAsset(row);
    if (asset) result.set(asset.id, asset);
  }
  return result;
}

function parseActiveAsset(row: WallAudioAssetRow): WallAudioAsset | null {
  if (
    row.status !== "active" ||
    row.review_status !== "approved" ||
    typeof row.loopable !== "boolean" ||
    !isEnergy(row.energy) ||
    !row.audio_url.startsWith("https://") ||
    !row.moods.every(isMood) ||
    !row.message_types.every(isMessageType) ||
    row.moods.length === 0 ||
    row.message_types.length === 0
  ) {
    return null;
  }
  return {
    audioUrl: row.audio_url,
    cueStartSeconds: Number(row.cue_start_seconds),
    durationSeconds: Number(row.duration_seconds),
    energy: row.energy,
    id: row.id,
    loopable: row.loopable,
    messageTypes: row.message_types,
    moods: row.moods,
    reviewStatus: "approved",
    status: "active",
  };
}

function resolveStoredSelection(
  selection: WallTextAudioSelectionRow,
  asset: WallAudioAsset,
): ResolvedWallTextAudioSelection {
  return {
    audioAssetDurationSeconds: asset.durationSeconds,
    audioAssetId: asset.id,
    audioUrl: asset.audioUrl,
    contentFingerprint: selection.content_fingerprint,
    creativeEditId: selection.creative_edit_id,
    creativeEditRevision: selection.creative_edit_revision,
    cueStartSeconds: selection.cue_start_seconds,
    fadeOutSeconds: selection.fade_out_seconds,
    fitMode: selection.fit_mode,
    intent: parseIntent(selection.audio_intent),
    matchScore: selection.match_score,
    matchingVersion: "wall-audio-match-v1",
    outputDurationSeconds: selection.output_duration_seconds,
    selectionId: selection.id,
  };
}

function parseIntent(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored Wall audio intent is invalid.");
  }
  const moods = Array.isArray(value.moods) ? value.moods : [];
  const messageTypes = Array.isArray(value.messageTypes)
    ? value.messageTypes
    : [];
  if (
    !moods.every(isMood) ||
    !messageTypes.every(isMessageType) ||
    !isEnergy(value.energy)
  ) {
    throw new Error("Stored Wall audio intent is invalid.");
  }
  return { energy: value.energy, messageTypes, moods };
}

function isMood(value: unknown): value is WallAudioMood {
  return [
    "curious",
    "uplifting",
    "serious",
    "calm",
    "urgent",
    "playful",
  ].includes(String(value));
}

function isMessageType(value: unknown): value is WallAudioMessageType {
  return [
    "curiosity",
    "problem",
    "warning",
    "transformation",
    "benefit",
    "story",
    "authority",
  ].includes(String(value));
}

function isEnergy(value: unknown): value is WallAudioEnergy {
  return ["low", "medium", "high"].includes(String(value));
}

function getClient() {
  if (client) return client;
  const url = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Wall audio database environment is unavailable.");
  }
  client = createClient<WallAudioDatabase>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
