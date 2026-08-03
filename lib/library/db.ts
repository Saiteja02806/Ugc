import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CarouselGenerationRecord,
  CarouselSlideRecord,
} from "@/lib/carousel/db";

const LIBRARY_ITEMS_TABLE = "library_items";
const LIBRARY_CAROUSEL_SLIDES_TABLE = "library_carousel_slides";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type LibraryItemRow = {
  cover_url: string | null;
  created_at: string;
  deleted_at: string | null;
  id: string;
  media_type: "carousel";
  metadata: Json;
  project_id: string;
  source_id: string;
  source_type: "generated_carousel";
  status: "archived" | "ready";
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  user_id: string;
};

type LibraryCarouselSlideRow = {
  carousel_generation_id: string;
  carousel_slide_id: string | null;
  created_at: string;
  headline: string | null;
  id: string;
  library_item_id: string;
  metadata: Json;
  rendered_s3_key: string | null;
  rendered_url: string;
  slide_number: number;
  slide_type: string | null;
  subtext: string | null;
  updated_at: string;
};

type SaveGeneratedCarouselLibraryItemArgs = {
  p_cover_url: string | null;
  p_metadata: Json;
  p_project_id: string;
  p_slides: Json;
  p_source_id: string;
  p_thumbnail_url: string | null;
  p_title: string;
  p_user_id: string;
};

type LibraryDatabase = {
  public: {
    Functions: {
      save_generated_carousel_library_item: {
        Args: SaveGeneratedCarouselLibraryItemArgs;
        Returns: Array<{
          created: boolean;
          item_id: string;
        }>;
      };
    };
    Tables: {
      library_carousel_slides: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: LibraryCarouselSlideRow;
        Update: Partial<LibraryCarouselSlideRow>;
      };
      library_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: LibraryItemRow;
        Update: Partial<LibraryItemRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type LibraryCarouselSlideRecord = {
  carouselGenerationId: string;
  carouselSlideId: string | null;
  headline: string | null;
  id: string;
  libraryItemId: string;
  renderedS3Key: string | null;
  renderedUrl: string;
  slideNumber: number;
  slideType: string | null;
  subtext: string | null;
};

export type LibraryCarouselItemRecord = {
  coverUrl: string | null;
  createdAt: string;
  id: string;
  projectId: string;
  savedAt: string;
  slideCount: number;
  slides: LibraryCarouselSlideRecord[];
  sourceId: string;
  sourceType: "generated_carousel";
  thumbnailUrl: string | null;
  title: string;
  updatedAt: string;
};

let librarySupabaseClient: SupabaseClient<LibraryDatabase> | null = null;

export function getMissingLibraryDbEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function saveGeneratedCarouselToLibrary(input: {
  edit?: {
    id: string;
    revision: number;
    slides: Array<{
      slideNumber: number;
      textPosition: { x: number; y: number };
    }>;
  } | null;
  generation: CarouselGenerationRecord;
  slides: CarouselSlideRecord[];
  title: string;
  userId: string;
}) {
  const orderedSlides = [...input.slides].sort(
    (first, second) => first.slideNumber - second.slideNumber,
  );
  const coverUrl =
    orderedSlides[0]?.renderedUrl ??
    orderedSlides.find((slide) => Boolean(slide.renderedUrl))?.renderedUrl ??
    null;
  const editPositionBySlideNumber = new Map(
    (input.edit?.slides ?? []).map((slide) => [
      slide.slideNumber,
      slide.textPosition,
    ]),
  );
  const slidesPayload = orderedSlides.map((slide) => ({
    carouselGenerationId: slide.carouselGenerationId,
    carouselSlideId: slide.id,
    headline: slide.headline,
    metadata: {
      ctaText: slide.ctaText,
      imageDirection: slide.imageDirection,
      layoutPreset: slide.layoutPreset,
      normalizedTextPosition:
        editPositionBySlideNumber.get(slide.slideNumber) ?? null,
      textPosition: slide.textPosition,
    },
    renderedS3Key: slide.renderedS3Key,
    renderedUrl: slide.renderedUrl,
    slideNumber: slide.slideNumber,
    slideType: slide.slideType,
    subtext: slide.subtext,
  }));
  const { data, error } = await getLibrarySupabaseClient()
    .rpc("save_generated_carousel_library_item", {
      p_cover_url: coverUrl,
      p_metadata: {
        businessProfileId: input.generation.businessProfileId,
        businessProfileVersion: input.generation.businessProfileVersion,
        candidateIndex: input.generation.candidateIndex,
        categorySlug: input.generation.categorySlug,
        generationBatchId: input.generation.generationBatchId,
        generationSource: input.generation.generationSource,
        selectedAngle: input.generation.selectedAngle,
        trendingCreativeEdit: input.edit
          ? { id: input.edit.id, revision: input.edit.revision }
          : null,
      },
      p_project_id: input.generation.projectId,
      p_slides: slidesPayload,
      p_source_id: input.generation.id,
      p_thumbnail_url: coverUrl,
      p_title: input.title,
      p_user_id: input.userId,
    })
    .single();

  if (error) {
    throw new Error(`Could not save carousel to Library: ${error.message}`);
  }

  if (!data?.item_id) {
    throw new Error("Library save returned no item.");
  }

  const item = await getLibraryCarouselItemForUser({
    itemId: data.item_id,
    userId: input.userId,
  });

  if (!item) {
    throw new Error("Saved Library item could not be loaded.");
  }

  return {
    created: Boolean(data.created),
    item,
  };
}

export async function listLibraryCarouselItems(params: {
  limit?: number;
  projectId?: string | null;
  userId: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 60), 1), 100);
  let query = getLibrarySupabaseClient()
    .from(LIBRARY_ITEMS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("source_type", "generated_carousel")
    .eq("media_type", "carousel")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load Library carousels: ${error.message}`);
  }

  return getLibraryCarouselItemsForRows(data ?? []);
}

export async function removeLibraryCarouselItem(params: {
  itemId: string;
  userId: string;
}) {
  const { data, error } = await getLibrarySupabaseClient()
    .from(LIBRARY_ITEMS_TABLE)
    .update({
      deleted_at: getNowIso(),
      status: "archived",
      updated_at: getNowIso(),
    })
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .eq("source_type", "generated_carousel")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not remove Library item: ${error.message}`);
  }

  return Boolean(data?.id);
}

export async function getLibraryCarouselItemForUser(params: {
  itemId: string;
  userId: string;
}) {
  const { data, error } = await getLibrarySupabaseClient()
    .from(LIBRARY_ITEMS_TABLE)
    .select("*")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .eq("source_type", "generated_carousel")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Library item: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (await getLibraryCarouselItemsForRows([data]))[0] ?? null;
}

async function getLibraryCarouselItemsForRows(rows: LibraryItemRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const itemIds = rows.map((row) => row.id);
  const { data: slideRows, error } = await getLibrarySupabaseClient()
    .from(LIBRARY_CAROUSEL_SLIDES_TABLE)
    .select("*")
    .in("library_item_id", itemIds)
    .order("slide_number", { ascending: true });

  if (error) {
    throw new Error(`Could not load Library carousel slides: ${error.message}`);
  }

  const slidesByItemId = new Map<string, LibraryCarouselSlideRecord[]>();

  for (const slide of slideRows ?? []) {
    const slides = slidesByItemId.get(slide.library_item_id) ?? [];

    slides.push(mapLibraryCarouselSlide(slide));
    slidesByItemId.set(slide.library_item_id, slides);
  }

  return rows.map((row) => mapLibraryItem(row, slidesByItemId.get(row.id) ?? []));
}

function mapLibraryItem(
  row: LibraryItemRow,
  slides: LibraryCarouselSlideRecord[],
): LibraryCarouselItemRecord {
  return {
    coverUrl: row.cover_url,
    createdAt: row.created_at,
    id: row.id,
    projectId: row.project_id,
    savedAt: row.created_at,
    slideCount: slides.length,
    slides,
    sourceId: row.source_id,
    sourceType: row.source_type,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapLibraryCarouselSlide(
  row: LibraryCarouselSlideRow,
): LibraryCarouselSlideRecord {
  return {
    carouselGenerationId: row.carousel_generation_id,
    carouselSlideId: row.carousel_slide_id,
    headline: row.headline,
    id: row.id,
    libraryItemId: row.library_item_id,
    renderedS3Key: row.rendered_s3_key,
    renderedUrl: row.rendered_url,
    slideNumber: row.slide_number,
    slideType: row.slide_type,
    subtext: row.subtext,
  };
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ""
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function getLibrarySupabaseClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Library Supabase storage is not configured.");
  }

  if (!librarySupabaseClient) {
    librarySupabaseClient = createClient<LibraryDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return librarySupabaseClient;
}

function getNowIso() {
  return new Date().toISOString();
}
