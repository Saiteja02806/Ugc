import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  clampCreateContentTextPosition,
  CREATE_CONTENT_CARD_VERSION,
  isCreateContentTextFormat,
  normalizeCreateContentText,
  type CreateContentCard,
  type CreateContentTextFormat,
  type CreateContentTextPosition,
} from "@/lib/create-content/card-contract";
import {
  CreateContentTextValidationError,
  normalizeAndValidateCreateContentText,
} from "@/lib/create-content/generation-validation";

const CREATE_CONTENT_CARDS_TABLE = "create_content_cards";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type CreateContentCardRow = {
  active_format: string;
  active_text: string;
  created_at: string;
  id: string;
  revision: number;
  source_media_asset_id: string;
  text_position: Json;
  updated_at: string;
  user_id: string;
};

type CreateContentCardDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      create_content_cards: {
        Insert: Omit<CreateContentCardRow, "created_at" | "id" | "updated_at"> & {
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
        Row: CreateContentCardRow;
        Update: Partial<CreateContentCardRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export class CreateContentCardStorageError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CreateContentCardStorageError";
    this.status = status;
  }
}

let client: SupabaseClient<CreateContentCardDatabase> | null = null;

export function getMissingCreateContentCardEnvVars(): string[] {
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

export async function listCreateContentCards(params: {
  sourceMediaAssetIds?: readonly string[];
  userId: string;
}): Promise<CreateContentCard[]> {
  if (params.sourceMediaAssetIds && params.sourceMediaAssetIds.length === 0) {
    return [];
  }

  let query = getClient()
    .from(CREATE_CONTENT_CARDS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (params.sourceMediaAssetIds) {
    query = query.in("source_media_asset_id", params.sourceMediaAssetIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load Create Content cards: ${error.message}`);
  }

  return (data ?? []).map(serializeCreateContentCard);
}

export async function saveCreateContentCard(params: {
  expectedRevision: number;
  format: CreateContentTextFormat;
  position: CreateContentTextPosition;
  sourceMediaAssetId: string;
  text: string;
  userId: string;
}): Promise<CreateContentCard> {
  const position = clampCreateContentTextPosition(params.position);
  let activeText: string;

  try {
    activeText = await normalizeAndValidateCreateContentText({
      format: params.format,
      position,
      text: params.text,
    });
  } catch (error) {
    if (error instanceof CreateContentTextValidationError) {
      throw new CreateContentCardStorageError(error.message, 400);
    }
    throw error;
  }

  const existing = await getCreateContentCardRowForOwner({
    sourceMediaAssetId: params.sourceMediaAssetId,
    userId: params.userId,
  });
  const actualRevision = existing?.revision ?? 0;

  if (actualRevision !== params.expectedRevision) {
    throw new CreateContentCardStorageError(
      "This video changed in another tab. Reload it and try again.",
      409,
    );
  }

  const now = new Date().toISOString();
  const values = {
    active_format: params.format,
    active_text: activeText,
    revision: actualRevision + 1,
    source_media_asset_id: params.sourceMediaAssetId,
    text_position: position,
    updated_at: now,
    user_id: params.userId,
  };

  if (!existing) {
    const { data, error } = await getClient()
      .from(CREATE_CONTENT_CARDS_TABLE)
      .insert(values)
      .select("*")
      .maybeSingle();

    if (error?.code === "23505") {
      throw new CreateContentCardStorageError(
        "This video changed in another tab. Reload it and try again.",
        409,
      );
    }

    if (error) {
      throw new Error(`Could not save Create Content card: ${error.message}`);
    }

    if (!data) {
      throw new Error("Create Content card storage returned no row.");
    }

    return serializeCreateContentCard(data);
  }

  const { data, error } = await getClient()
    .from(CREATE_CONTENT_CARDS_TABLE)
    .update(values)
    .eq("id", existing.id)
    .eq("revision", params.expectedRevision)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not save Create Content card: ${error.message}`);
  }

  if (!data) {
    throw new CreateContentCardStorageError(
      "This video changed in another tab. Reload it and try again.",
      409,
    );
  }

  return serializeCreateContentCard(data);
}

export async function getCreateContentCardForOwner(params: {
  sourceMediaAssetId: string;
  userId: string;
}): Promise<CreateContentCard | null> {
  const row = await getCreateContentCardRowForOwner(params);
  return row ? serializeCreateContentCard(row) : null;
}

async function getCreateContentCardRowForOwner(params: {
  sourceMediaAssetId: string;
  userId: string;
}): Promise<CreateContentCardRow | null> {
  const { data, error } = await getClient()
    .from(CREATE_CONTENT_CARDS_TABLE)
    .select("*")
    .eq("source_media_asset_id", params.sourceMediaAssetId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Create Content card: ${error.message}`);
  }

  return data;
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Create Content storage is not configured.");
  }

  if (!client) {
    client = createClient<CreateContentCardDatabase>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function serializeCreateContentCard(row: CreateContentCardRow): CreateContentCard {
  if (!isCreateContentTextFormat(row.active_format)) {
    throw new Error("Create Content card has an unsupported text format.");
  }

  return {
    overlay: {
      format: row.active_format,
      position: parsePosition(row.text_position),
      text: normalizeCreateContentText(row.active_text),
    },
    revision: row.revision,
    sourceMediaAssetId: row.source_media_asset_id,
    updatedAt: row.updated_at ?? null,
    version: CREATE_CONTENT_CARD_VERSION,
  };
}

function parsePosition(value: Json): CreateContentTextPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Create Content card has an invalid text position.");
  }

  const position = value as Record<string, unknown>;
  return clampCreateContentTextPosition({
    x: typeof position.x === "number" ? position.x : Number.NaN,
    y: typeof position.y === "number" ? position.y : Number.NaN,
  });
}
