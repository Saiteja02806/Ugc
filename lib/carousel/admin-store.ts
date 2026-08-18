import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CarouselAdminAnalyticsRow,
  CarouselAdminAnalyticsScope,
  CarouselAdminDashboard,
  CarouselAdminSettings,
} from "@/lib/carousel/admin-types";
import { isCarouselContentFormatId } from "@/lib/carousel/content-grammar";
import { isCarouselStructure2FormatId } from "@/lib/carousel/structure-2-formats";
import {
  isCarouselStructureId,
  isCarouselStructureMode,
  type CarouselStructureMode,
} from "@/lib/carousel/structure";

type CarouselAdminSettingsRow = {
  created_at: string;
  singleton: boolean;
  structure_config_version: number;
  structure_mode: string;
  updated_at: string;
  updated_by_user_id: string | null;
};

type CarouselAdminAnalyticsDatabaseRow = {
  average_view_count: number | string | null;
  content_format_id: string | null;
  evaluated_post_count: number | string;
  generated_count: number | string;
  median_view_count: number | string | null;
  published_count: number | string;
  saved_count: number | string;
  scheduled_count: number | string;
  scope: string;
  structure_id: string;
  total_view_count: number | string;
};

type CarouselAdminDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      get_carousel_admin_analytics: {
        Args: { p_window_days: number };
        Returns: CarouselAdminAnalyticsDatabaseRow[];
      };
      set_carousel_structure_mode: {
        Args: {
          p_structure_mode: string;
          p_updated_by_user_id: string;
        };
        Returns: CarouselAdminSettingsRow[];
      };
    };
    Tables: {
      carousel_global_settings: {
        Insert: never;
        Relationships: [];
        Row: CarouselAdminSettingsRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

export class CarouselAdminStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CarouselAdminStoreError";
    this.status = status;
  }
}

let carouselAdminClient: SupabaseClient<CarouselAdminDatabase> | null = null;

export function getMissingCarouselAdminEnvVars() {
  return [
    !getSupabaseUrl() ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
}

export async function getCarouselAdminDashboard(
  windowDays = 30,
): Promise<CarouselAdminDashboard> {
  const normalizedWindowDays = normalizeWindowDays(windowDays);
  const client = getClient();
  const [settingsResult, analyticsResult] = await Promise.all([
    client
      .from("carousel_global_settings")
      .select(
        "singleton,structure_mode,structure_config_version,updated_by_user_id,created_at,updated_at",
      )
      .eq("singleton", true)
      .single(),
    client.rpc("get_carousel_admin_analytics", {
      p_window_days: normalizedWindowDays,
    }),
  ]);

  if (settingsResult.error || !settingsResult.data) {
    throw new CarouselAdminStoreError(
      "Could not load the global Carousel routing setting.",
    );
  }
  if (analyticsResult.error) {
    throw new CarouselAdminStoreError(
      "Could not load Carousel administration analytics.",
    );
  }

  return {
    analytics: (analyticsResult.data ?? []).map(mapAnalyticsRow),
    settings: mapSettingsRow(settingsResult.data),
    windowDays: normalizedWindowDays,
  };
}

export async function setCarouselAdminStructureMode(params: {
  structureMode: CarouselStructureMode;
  updatedByUserId: string;
}): Promise<CarouselAdminSettings> {
  const { data, error } = await getClient().rpc("set_carousel_structure_mode", {
    p_structure_mode: params.structureMode,
    p_updated_by_user_id: params.updatedByUserId,
  });
  const row = data?.[0];

  if (error || !row) {
    throw new CarouselAdminStoreError(
      "Could not update the global Carousel routing setting.",
    );
  }

  return mapSettingsRow(row);
}

function mapSettingsRow(row: CarouselAdminSettingsRow): CarouselAdminSettings {
  if (!isCarouselStructureMode(row.structure_mode)) {
    throw new CarouselAdminStoreError(
      "The saved global Carousel routing setting is invalid.",
    );
  }

  return {
    structureConfigVersion: row.structure_config_version,
    structureMode: row.structure_mode,
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
  };
}

function mapAnalyticsRow(
  row: CarouselAdminAnalyticsDatabaseRow,
): CarouselAdminAnalyticsRow {
  if (!isAnalyticsScope(row.scope) || !isCarouselStructureId(row.structure_id)) {
    throw new CarouselAdminStoreError(
      "Carousel administration analytics returned an invalid identity.",
    );
  }
  if (row.scope === "structure" && row.content_format_id !== null) {
    throw new CarouselAdminStoreError(
      "Carousel structure analytics unexpectedly included a format ID.",
    );
  }
  if (row.scope === "format" && !row.content_format_id) {
    throw new CarouselAdminStoreError(
      "Carousel format analytics is missing its format ID.",
    );
  }
  if (
    row.scope === "format" &&
    ((row.structure_id === "structure_1" &&
      !isCarouselContentFormatId(row.content_format_id)) ||
      (row.structure_id === "structure_2" &&
        !isCarouselStructure2FormatId(row.content_format_id)))
  ) {
    throw new CarouselAdminStoreError(
      "Carousel format analytics crossed a structure format namespace.",
    );
  }

  return {
    averageViewCount: toNullableNumber(row.average_view_count),
    contentFormatId: row.content_format_id,
    evaluatedPostCount: toCount(row.evaluated_post_count),
    generatedCount: toCount(row.generated_count),
    medianViewCount: toNullableNumber(row.median_view_count),
    publishedCount: toCount(row.published_count),
    savedCount: toCount(row.saved_count),
    scheduledCount: toCount(row.scheduled_count),
    scope: row.scope,
    structureId: row.structure_id,
    totalViewCount: toCount(row.total_view_count),
  };
}

function isAnalyticsScope(value: string): value is CarouselAdminAnalyticsScope {
  return value === "format" || value === "structure";
}

function normalizeWindowDays(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new CarouselAdminStoreError(
      "Carousel analytics window must be from 1 to 365 days.",
      400,
    );
  }

  return value;
}

function toCount(value: number | string) {
  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new CarouselAdminStoreError(
      "Carousel administration analytics returned an invalid count.",
    );
  }

  return numberValue;
}

function toNullableNumber(value: number | string | null) {
  if (value === null) return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new CarouselAdminStoreError(
      "Carousel administration analytics returned an invalid view value.",
    );
  }

  return numberValue;
}

function getClient() {
  if (carouselAdminClient) {
    return carouselAdminClient;
  }

  const missing = getMissingCarouselAdminEnvVars();
  if (missing.length > 0) {
    throw new CarouselAdminStoreError(
      `Missing Carousel administration environment variables: ${missing.join(", ")}`,
      503,
    );
  }

  carouselAdminClient = createClient<CarouselAdminDatabase>(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return carouselAdminClient;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}
