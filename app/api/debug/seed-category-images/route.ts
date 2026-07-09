import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

import {
  normalizeCategorySlug,
  resolveCarouselCategory,
} from "@/lib/carousel/category-resolver";
import { getMissingPexelsEnvVars } from "@/lib/carousel/pexels";
import { getMissingCarouselSupabaseEnvVars } from "@/lib/carousel/supabase";
import { getVisualBucket } from "@/lib/carousel/visual-bucket-taxonomy";
import { getMissingStorageEnvVars } from "@/lib/storage/s3";
import type { seedCategoryImageLibraryTask } from "@/trigger/seed-category-image-library";

export const runtime = "nodejs";

type SeedCategoryImagesBody = {
  batchSize?: unknown;
  candidateFetchLimit?: unknown;
  categorySlug?: unknown;
  maxSeededCount?: unknown;
  maxSourceAttempts?: unknown;
  minimumApprovedTarget?: unknown;
  pexelsImageQueries?: unknown;
  queries?: unknown;
  targetCount?: unknown;
  visualBucketId?: unknown;
  visualKeywords?: unknown;
};

const DEFAULT_CATEGORY_SLUG = "productivity-saas";
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_TARGET_COUNT = 100;
const DEFAULT_CANDIDATE_FETCH_LIMIT = 80;
const MAX_CANDIDATE_FETCH_LIMIT = 120;
const MAX_SOURCE_ATTEMPTS = 12;
const MAX_TARGET_COUNT = 250;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(getString)
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function getTargetCount(value: unknown, fallback = DEFAULT_TARGET_COUNT) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_TARGET_COUNT);
}

function getPositiveInt(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function getBatchSize(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 20);
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingPexelsEnvVars(),
      ...getMissingStorageEnvVars(),
      ...getMissingCarouselSupabaseEnvVars(),
      ...(!process.env.TRIGGER_SECRET_KEY?.trim() ? ["TRIGGER_SECRET_KEY"] : []),
    ]),
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status },
  );
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as SeedCategoryImagesBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return errorResponse(
      `Category image seeding is not configured. Add ${missingRuntimeEnv.join(
        ", ",
      )} in server environment variables.`,
      501,
    );
  }

  const body = await readBody(request);

  if (!body) {
    return errorResponse("Send seed category image details as JSON.", 400);
  }

  const resolvedCategory = resolveCarouselCategory({
    category: body.categorySlug,
    pexelsImageQueries: body.pexelsImageQueries ?? body.queries,
    visualKeywords: body.visualKeywords,
  });
  const categorySlug = normalizeCategorySlug(
    getString(body.categorySlug) || resolvedCategory.categorySlug || DEFAULT_CATEGORY_SLUG,
  );
  const visualBucketId = getString(body.visualBucketId);
  const visualBucket = visualBucketId ? getVisualBucket(visualBucketId) : null;

  if (visualBucketId && !visualBucket) {
    return errorResponse(`Unknown visual bucket "${visualBucketId}".`, 400);
  }

  const queries =
    getStringArray(body.queries).length > 0
      ? getStringArray(body.queries)
      : visualBucket
        ? [...visualBucket.seedQueries]
      : resolvedCategory.queries;
  const targetCount = getTargetCount(
    body.minimumApprovedTarget ?? body.targetCount,
    visualBucket?.targetCount ?? DEFAULT_TARGET_COUNT,
  );
  const candidateFetchLimit = getPositiveInt(
    body.candidateFetchLimit ?? body.maxSeededCount,
    DEFAULT_CANDIDATE_FETCH_LIMIT,
    MAX_CANDIDATE_FETCH_LIMIT,
  );
  const maxSourceAttempts =
    body.maxSourceAttempts === undefined
      ? undefined
      : getPositiveInt(body.maxSourceAttempts, MAX_SOURCE_ATTEMPTS, MAX_SOURCE_ATTEMPTS);
  const batchSize = getBatchSize(body.batchSize);
  const visualKeywords =
    getStringArray(body.visualKeywords).length > 0
      ? getStringArray(body.visualKeywords)
      : resolvedCategory.visualKeywords;

  if (queries.length === 0 && !visualBucket) {
    return errorResponse(
      "Add at least one Pexels query or a valid visual bucket before seeding.",
      400,
    );
  }

  try {
    const handle = await tasks.trigger<typeof seedCategoryImageLibraryTask>(
      "seed-category-image-library",
      {
        batchSize,
        candidateFetchLimit,
        categorySlug,
        maxSourceAttempts,
        minimumApprovedTarget: targetCount,
        queries,
        visualBucketId: visualBucket?.id,
        visualKeywords,
      },
    );

    return NextResponse.json({
      ok: true,
      message: "Category image library seeding started.",
      batchSize,
      candidateFetchLimit,
      categorySlug,
      maxSourceAttempts: maxSourceAttempts ?? null,
      minimumApprovedTarget: targetCount,
      queries,
      runId: handle.id,
      targetCount,
      visualBucketId: visualBucket?.id ?? null,
      visualKeywords,
    });
  } catch (error) {
    console.error("Failed to start category image library seed:", error);

    return errorResponse(
      "Could not start category image seeding. Make sure Trigger.dev is running.",
      502,
    );
  }
}
