import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CreateContentRenderOverlay } from "./render-contract";

const CREATE_CONTENT_RENDERS_TABLE = "create_content_renders";

export type CreateContentRenderStatus =
  | "queued"
  | "rendering"
  | "ready"
  | "failed";

export type CreateContentRender = {
  attempt: number;
  cardRevision: number;
  errorMessage: string | null;
  id: string;
  jobId: string | null;
  mediaAssetId: string | null;
  sourceMediaAssetId: string;
  status: CreateContentRenderStatus;
  updatedAt: string;
};

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type CreateContentRenderRow = {
  attempt: number;
  card_revision: number;
  created_at: string;
  error_message: string | null;
  id: string;
  overlay_json: Json;
  render_job_id: string | null;
  rendered_media_asset_id: string | null;
  source_media_asset_id: string;
  status: CreateContentRenderStatus;
  updated_at: string;
  user_id: string;
};

type CreateContentRenderDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      create_content_renders: {
        Insert: Omit<CreateContentRenderRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Row: CreateContentRenderRow;
        Update: Partial<CreateContentRenderRow>;
      };
    };
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<CreateContentRenderDatabase> | null = null;

export function getMissingCreateContentRenderEnvVars(): string[] {
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

export async function getCreateContentRenderForCard(params: {
  cardRevision: number;
  sourceMediaAssetId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(CREATE_CONTENT_RENDERS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("source_media_asset_id", params.sourceMediaAssetId)
    .eq("card_revision", params.cardRevision)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Create Content preparation: ${error.message}`);
  }

  return data ? serializeCreateContentRender(data) : null;
}

export async function createOrGetQueuedCreateContentRender(params: {
  cardRevision: number;
  id: string;
  overlay: CreateContentRenderOverlay;
  sourceMediaAssetId: string;
  userId: string;
}) {
  const existing = await getCreateContentRenderForCard(params);

  if (existing) {
    if (existing.status !== "failed") {
      return { created: false, render: existing };
    }

    // A terminal job is immutable, so its idempotency key cannot be reused.
    // Requeue the same durable render row with a strictly newer attempt. Two
    // simultaneous retry clicks race on this conditional update; only the
    // winner creates/dispatches the next physical background job.
    const { data, error } = await getClient()
      .from(CREATE_CONTENT_RENDERS_TABLE)
      .update({
        attempt: existing.attempt + 1,
        error_message: null,
        overlay_json: toJson(params.overlay),
        render_job_id: null,
        rendered_media_asset_id: null,
        status: "queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", params.userId)
      .eq("status", "failed")
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not retry Create Content export: ${error.message}`);
    }

    if (data) {
      return { created: true, render: serializeCreateContentRender(data) };
    }

    const raced = await getCreateContentRenderForCard(params);

    if (raced) {
      return { created: false, render: raced };
    }

    throw new Error("Create Content preparation changed while it was retried.");
  }

  const now = new Date().toISOString();
  const { data, error } = await getClient()
    .from(CREATE_CONTENT_RENDERS_TABLE)
    .insert({
      card_revision: params.cardRevision,
      attempt: 1,
      error_message: null,
      id: params.id,
      overlay_json: toJson(params.overlay),
      render_job_id: null,
      rendered_media_asset_id: null,
      source_media_asset_id: params.sourceMediaAssetId,
      status: "queued",
      updated_at: now,
      user_id: params.userId,
    })
    .select("*")
    .maybeSingle();

  if (error?.code === "23505") {
    const raced = await getCreateContentRenderForCard(params);

    if (raced) return { created: false, render: raced };
  }

  if (error) {
    throw new Error(`Could not prepare Create Content export: ${error.message}`);
  }

  if (!data) {
    throw new Error("Create Content preparation returned no record.");
  }

  return { created: true, render: serializeCreateContentRender(data) };
}

export async function attachCreateContentRenderJob(params: {
  attempt: number;
  jobId: string;
  renderId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(CREATE_CONTENT_RENDERS_TABLE)
    .update({
      render_job_id: params.jobId,
      updated_at: new Date().toISOString(),
    })
      .eq("id", params.renderId)
      .eq("user_id", params.userId)
      .eq("status", "queued")
      .eq("attempt", params.attempt)
      .is("render_job_id", null)
      .select("*")
      .maybeSingle();

  if (error) {
    throw new Error(`Could not attach Create Content export job: ${error.message}`);
  }

  if (data) {
    return serializeCreateContentRender(data);
  }

  const current = await getCreateContentRenderForOwner({
    renderId: params.renderId,
    userId: params.userId,
  });

  if (current?.attempt === params.attempt && current.jobId === params.jobId) {
    return current;
  }

  throw new Error("Create Content preparation changed before its job was attached.");
}

export async function failCreateContentRender(params: {
  allowUnattachedJob?: boolean;
  attempt?: number | null;
  errorMessage: string;
  jobId?: string | null;
  renderId: string;
  userId: string;
}) {
  let query = getClient()
    .from(CREATE_CONTENT_RENDERS_TABLE)
    .update({
      error_message: params.errorMessage.slice(0, 1000),
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.renderId)
    .eq("user_id", params.userId)
    .in("status", ["queued", "rendering"]);

  if (params.attempt !== null && params.attempt !== undefined) {
    query = query.eq("attempt", params.attempt);
  }

  query = params.jobId
    ? params.allowUnattachedJob
      ? query.or(`render_job_id.eq.${params.jobId},render_job_id.is.null`)
      : query.eq("render_job_id", params.jobId)
    : query.is("render_job_id", null);

  const { error } = await query;

  if (error) {
    throw new Error(`Could not fail Create Content preparation: ${error.message}`);
  }
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Create Content preparation storage is not configured.");
  }

  if (!client) {
    client = createClient<CreateContentRenderDatabase>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function serializeCreateContentRender(row: CreateContentRenderRow): CreateContentRender {
  return {
    attempt: row.attempt,
    cardRevision: row.card_revision,
    errorMessage: row.error_message,
    id: row.id,
    jobId: row.render_job_id,
    mediaAssetId: row.rendered_media_asset_id,
    sourceMediaAssetId: row.source_media_asset_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function getCreateContentRenderForOwner(params: {
  renderId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(CREATE_CONTENT_RENDERS_TABLE)
    .select("*")
    .eq("id", params.renderId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Create Content preparation: ${error.message}`);
  }

  return data ? serializeCreateContentRender(data) : null;
}

function toJson(value: CreateContentRenderOverlay): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
