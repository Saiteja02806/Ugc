import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createReactionTrendingFeedProvider,
  createUnavailableTrendingFeedProvider,
  type TrendingReactionFeedItem,
  type TrendingReactionSourceRecord,
} from "@/lib/trending/feed-items";

type ReactionCreativeRow = {
  background_asset_id: string;
  business_profile_id: string;
  business_profile_version: number;
  caption: string;
  clip_asset_id: string;
  duration_seconds: number;
  id: string;
  preview_url: string;
  primary_reaction: string;
  rendered_media_asset_id: string;
  render_status: "failed" | "preview_ready" | "queued" | "rendering";
  thumbnail_url: string | null;
  title: string;
  user_id: string;
};

type ReactionAssignmentRow = {
  business_profile_id: string;
  business_profile_version: number;
  id: string;
  position: number;
  reaction_creative_id: string;
  state: "active" | "completed_skipped" | "selected";
  user_id: string;
};

type ReactionPresentationRow = {
  clip_asset_id: string;
  presented_at: string;
};

type ReactionDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      reaction_creatives: {
        Insert: never;
        Relationships: [];
        Row: ReactionCreativeRow;
        Update: never;
      };
      reaction_clip_presentations: {
        Insert: {
          assignment_id: string;
          clip_asset_id: string;
          user_id: string;
        };
        Relationships: [];
        Row: ReactionPresentationRow;
        Update: never;
      };
      user_reaction_assignments: {
        Insert: never;
        Relationships: [];
        Row: ReactionAssignmentRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

export type SelectedReactionCreative = {
  assignmentId: string;
  creativeId: string;
  mediaAssetId: string;
  title: string;
};

let client: SupabaseClient<ReactionDatabase> | null = null;

export async function getTrendingReactionFeedProvider(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  pinnedAssignmentIds?: readonly string[];
  userId: string;
}) {
  try {
    const items = await listActiveTrendingReactionIdeas(params);
    return createReactionTrendingFeedProvider(items);
  } catch (error) {
    console.error("Could not load Reaction Trending ideas:", error);
    return createUnavailableTrendingFeedProvider<TrendingReactionFeedItem>(
      "reaction",
      "Reaction Reels are temporarily unavailable.",
    );
  }
}

export async function listActiveTrendingReactionIdeas(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  pinnedAssignmentIds?: readonly string[];
  userId: string;
}): Promise<TrendingReactionSourceRecord[]> {
  const pinned = new Set(params.pinnedAssignmentIds ?? []);
  const { data: assignments, error: assignmentError } = await getClient()
    .from("user_reaction_assignments")
    .select("id,position,reaction_creative_id,state")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .in("state", ["active", "selected"])
    .order("position", { ascending: true });

  if (assignmentError) {
    throw new Error(
      `Could not load Reaction assignments: ${assignmentError.message}`,
    );
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  const { data: creatives, error: creativeError } = await getClient()
    .from("reaction_creatives")
    .select(
      "id,background_asset_id,caption,clip_asset_id,duration_seconds,preview_url,primary_reaction,rendered_media_asset_id,thumbnail_url,title",
    )
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("render_status", "preview_ready")
    .in(
      "id",
      assignments.map((assignment) => assignment.reaction_creative_id),
    );

  if (creativeError) {
    throw new Error(
      `Could not load Reaction creatives: ${creativeError.message}`,
    );
  }

  const creativeById = new Map(
    (creatives ?? []).map((creative) => [creative.id, creative]),
  );

  return assignments.flatMap((assignment) => {
    const creative = creativeById.get(assignment.reaction_creative_id);

    // A pinned daily position remains readable after an unrelated catalog
    // change, but never after its completed render was removed.
    if (!creative || (!pinned.has(assignment.id) && assignment.state !== "active")) {
      return [];
    }

    return [
      {
        assignmentId: assignment.id,
        aspectRatio: "9:16" as const,
        caption: creative.caption,
        clipAssetId: creative.clip_asset_id,
        creativeId: creative.id,
        durationSeconds: Number(creative.duration_seconds),
        feedItemId: assignment.id,
        feedPosition: assignment.position,
        feedSource: "new" as const,
        mediaAssetId: creative.rendered_media_asset_id,
        previewUrl: creative.preview_url,
        primaryReaction: creative.primary_reaction,
        thumbnailUrl: creative.thumbnail_url,
        title: creative.title,
      },
    ];
  });
}

export async function getSelectedReadyReactionCreative(params: {
  assignmentId: string;
  userId: string;
}): Promise<SelectedReactionCreative | null> {
  const { data: assignment, error: assignmentError } = await getClient()
    .from("user_reaction_assignments")
    .select("id,reaction_creative_id,state")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .in("state", ["active", "selected"])
    .maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Could not load the selected Reaction creative: ${assignmentError.message}`,
    );
  }

  if (!assignment) {
    return null;
  }

  const { data: creative, error: creativeError } = await getClient()
    .from("reaction_creatives")
    .select("id,rendered_media_asset_id,title")
    .eq("id", assignment.reaction_creative_id)
    .eq("user_id", params.userId)
    .eq("render_status", "preview_ready")
    .maybeSingle();

  if (creativeError) {
    throw new Error(
      `Could not load the rendered Reaction Reel: ${creativeError.message}`,
    );
  }

  return creative
    ? {
        assignmentId: assignment.id,
        creativeId: creative.id,
        mediaAssetId: creative.rendered_media_asset_id,
        title: creative.title,
      }
    : null;
}

/**
 * "Shown" is a presentation event, not a generation reservation. The unique
 * assignment key makes retries, reloads, and duplicate browser effects safe.
 */
export async function recordReactionPresentation(params: {
  assignmentId: string;
  clipAssetId: string;
  userId: string;
}) {
  const { data: assignment, error: assignmentError } = await getClient()
    .from("user_reaction_assignments")
    .select("id,reaction_creative_id,state,user_id")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .in("state", ["active", "selected"])
    .maybeSingle();

  if (assignmentError || !assignment) {
    throw new Error(
      `Could not verify the presented Reaction assignment: ${assignmentError?.message ?? "Assignment was not found."}`,
    );
  }

  const { data: creative, error: creativeError } = await getClient()
    .from("reaction_creatives")
    .select("clip_asset_id,id,render_status,user_id")
    .eq("id", assignment.reaction_creative_id)
    .eq("user_id", params.userId)
    .eq("clip_asset_id", params.clipAssetId)
    .eq("render_status", "preview_ready")
    .maybeSingle();

  if (creativeError || !creative) {
    throw new Error(
      `Could not verify the presented Reaction clip: ${creativeError?.message ?? "Clip did not match the assignment."}`,
    );
  }

  const { error } = await getClient()
    .from("reaction_clip_presentations")
    .upsert(
      {
        assignment_id: params.assignmentId,
        clip_asset_id: params.clipAssetId,
        user_id: params.userId,
      },
      { ignoreDuplicates: true, onConflict: "user_id,assignment_id" },
    );

  if (error) {
    throw new Error(`Could not record Reaction presentation: ${error.message}`);
  }
}

function getClient() {
  if (client) return client;

  const url =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!url || !key) {
    throw new Error("Reaction Trending storage is not configured.");
  }

  client = createClient<ReactionDatabase>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
