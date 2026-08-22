import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sanitizeInstagramEmbedHtml } from "@/lib/viral/instagram-reel-import";
import type {
  ViralReviewItem,
  ViralReviewPage,
  ViralReviewTiming,
} from "@/lib/viral/hook-review";

type ViralReferenceRow = {
  created_at: string;
  embed_html: string;
  embed_status: "active" | "suspected_unavailable" | "unavailable";
  id: string;
  platform: "instagram";
  publish_status: "pending_review" | "published" | "hidden";
  section: "hook_video" | "wall_of_text" | "slideshow";
  source_url: string;
  view_count?: number | null;
};

type ViralHookConfigRow = {
  created_at: string;
  hook_end_ms: number;
  hook_start_ms: number;
  reference_id: string;
  reviewed_at: string;
  reviewed_by: string;
  updated_at: string;
};

type ViralReviewDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      viral_hook_config: {
        Insert: Pick<
          ViralHookConfigRow,
          "hook_end_ms" | "reference_id" | "reviewed_at" | "reviewed_by" | "updated_at"
        > &
          Partial<Pick<ViralHookConfigRow, "created_at">>;
        Relationships: [];
        Row: ViralHookConfigRow;
        Update: Partial<
          Pick<
            ViralHookConfigRow,
            "hook_end_ms" | "reviewed_at" | "reviewed_by" | "updated_at"
          >
        >;
      };
      viral_references: {
        Insert: never;
        Relationships: [];
        Row: ViralReferenceRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

export class ViralReviewStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ViralReviewStoreError";
    this.status = status;
  }
}

let viralReviewClient: SupabaseClient<ViralReviewDatabase> | null = null;

export function getMissingViralReviewEnvVars() {
  return [
    !getSupabaseUrl() ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
}

export async function getViralHookReviewPage(params: {
  cursor: string | null;
  limit: number;
  section?: "hook_video" | "wall_of_text" | "slideshow";
}): Promise<ViralReviewPage> {
  const section = params.section ?? "hook_video";
  const limit = Math.min(Math.max(Math.trunc(params.limit), 1), 24);
  let query = getClient()
    .from("viral_references")
    .select(
      "id,section,platform,source_url,embed_html,embed_status,publish_status,created_at,view_count",
    )
    .eq("section", section)
    .eq("embed_status", "active")
    .eq("publish_status", "pending_review")
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (params.cursor) {
    query = query.gt("id", params.cursor);
  }

  const { data, error } = await query;
  if (error) {
    throw new ViralReviewStoreError("Could not load the Explore review queue.");
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const visibleRows = rows.slice(0, limit);
  const referenceIds = visibleRows.map((row) => row.id);
  const timingByReferenceId = await getTimingsByReferenceId(referenceIds);

  return {
    items: visibleRows.map((row) => toReviewItem(row, timingByReferenceId)),
    nextCursor: hasMore ? visibleRows.at(-1)?.id ?? null : null,
  };
}

export async function saveViralHookTiming(params: {
  hookEndMs: number;
  referenceId: string;
  reviewedBy: string;
}): Promise<ViralReviewTiming> {
  const client = getClient();
  const { data: reference, error: referenceError } = await client
    .from("viral_references")
    .select("id,section,embed_status,publish_status")
    .eq("id", params.referenceId)
    .maybeSingle();

  if (referenceError) {
    throw new ViralReviewStoreError("Could not verify this Explore reference.");
  }
  if (!reference) {
    throw new ViralReviewStoreError("This Explore reference no longer exists.", 404);
  }
  if (
    reference.section !== "hook_video" ||
    reference.embed_status !== "active" ||
    reference.publish_status !== "pending_review"
  ) {
    throw new ViralReviewStoreError(
      "This reference is not available for Hook timing review.",
      409,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viral_hook_config")
    .upsert(
      {
        hook_end_ms: params.hookEndMs,
        reference_id: params.referenceId,
        reviewed_at: now,
        reviewed_by: params.reviewedBy,
        updated_at: now,
      },
      { onConflict: "reference_id" },
    )
    .select("hook_start_ms,hook_end_ms,reviewed_at")
    .single();

  if (error || !data) {
    throw new ViralReviewStoreError("Could not save this Hook ending time.");
  }

  return {
    hookEndMs: data.hook_end_ms,
    hookStartMs: 0,
    reviewedAt: data.reviewed_at,
  };
}

async function getTimingsByReferenceId(referenceIds: Array<string>) {
  const timingByReferenceId = new Map<string, ViralHookConfigRow>();
  if (referenceIds.length === 0) {
    return timingByReferenceId;
  }

  const { data, error } = await getClient()
    .from("viral_hook_config")
    .select("reference_id,hook_start_ms,hook_end_ms,reviewed_at")
    .in("reference_id", referenceIds);

  if (error) {
    throw new ViralReviewStoreError("Could not load saved Hook timings.");
  }

  for (const timing of data ?? []) {
    timingByReferenceId.set(timing.reference_id, timing as ViralHookConfigRow);
  }

  return timingByReferenceId;
}

function toReviewItem(
  row: ViralReferenceRow,
  timingByReferenceId: ReadonlyMap<string, ViralHookConfigRow>,
): ViralReviewItem {
  const timing = timingByReferenceId.get(row.id);

  return {
    embedHtml: sanitizeInstagramEmbedHtml(row.embed_html),
    embedStatus: "active",
    id: row.id,
    importedAt: row.created_at,
    publishStatus: "pending_review",
    section: row.section,
    sourceUrl: row.source_url,
    timing: timing
      ? {
          hookEndMs: timing.hook_end_ms,
          hookStartMs: 0,
          reviewedAt: timing.reviewed_at,
        }
      : null,
    views:
      typeof row.view_count === "number" && Number.isFinite(row.view_count)
        ? row.view_count
        : null,
  };
}

function getClient() {
  if (viralReviewClient) {
    return viralReviewClient;
  }

  const missing = getMissingViralReviewEnvVars();
  if (missing.length > 0) {
    throw new ViralReviewStoreError(
      `Missing Viral review environment variables: ${missing.join(", ")}`,
    );
  }

  viralReviewClient = createClient<ViralReviewDatabase>(
    getSupabaseUrl()!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return viralReviewClient;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}
