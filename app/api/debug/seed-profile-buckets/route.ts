import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

import {
  getCarouselBusinessVisualProfile,
  type CarouselBusinessVisualProfileId,
} from "@/lib/carousel/business-visual-profile";
import { normalizeCategorySlug } from "@/lib/carousel/category-resolver";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import { getMissingPexelsEnvVars } from "@/lib/carousel/pexels";
import {
  CAROUSEL_PROFILE_BUCKET_SEED_SCOPES,
  DEFAULT_CAROUSEL_PROFILE_BUCKET_SEED_MAX_BUCKETS,
  getCarouselProfileBucketSeedPlan,
  type CarouselProfileBucketSeedScope,
} from "@/lib/carousel/profile-bucket-seeding-runner";
import { getMissingCarouselSupabaseEnvVars } from "@/lib/carousel/supabase";
import { getMissingStorageEnvVars } from "@/lib/storage/s3";
import type { seedProfileBucketLibraryTask } from "@/trigger/seed-profile-bucket-library";

export const runtime = "nodejs";

type SeedProfileBucketsBody = {
  batchSize?: unknown;
  candidateFetchLimit?: unknown;
  category?: unknown;
  categorySlug?: unknown;
  dryRun?: unknown;
  execute?: unknown;
  maxBuckets?: unknown;
  maxSeededPerBucket?: unknown;
  maxSourceAttempts?: unknown;
  pexelsImageQueries?: unknown;
  productSummary?: unknown;
  profileId?: unknown;
  scope?: unknown;
  targetCount?: unknown;
  valueProps?: unknown;
  visualKeywords?: unknown;
};

const DEFAULT_CANDIDATE_FETCH_LIMIT = 80;
const MAX_CANDIDATE_FETCH_LIMIT = 120;
const MAX_SOURCE_ATTEMPTS = 12;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return fallback;
}

function getPositiveInt(value: unknown, fallback?: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function getScope(value: unknown): CarouselProfileBucketSeedScope {
  const scope = getString(value);

  return CAROUSEL_PROFILE_BUCKET_SEED_SCOPES.includes(
    scope as CarouselProfileBucketSeedScope,
  )
    ? (scope as CarouselProfileBucketSeedScope)
    : "priority";
}

function getMissingRuntimeEnv(needsSeedRunner: boolean) {
  return Array.from(
    new Set([
      ...getMissingCarouselSupabaseEnvVars(),
      ...(needsSeedRunner
        ? [
            ...getMissingPexelsEnvVars(),
            ...getMissingStorageEnvVars(),
            ...(!process.env.TRIGGER_SECRET_KEY?.trim()
              ? ["TRIGGER_SECRET_KEY"]
              : []),
          ]
        : []),
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
    return (await request.json()) as SeedProfileBucketsBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);

  if (!body) {
    return errorResponse("Send profile bucket seed details as JSON.", 400);
  }

  const execute = getBoolean(body.execute, false);
  const dryRun = execute ? false : getBoolean(body.dryRun, true);
  const missingRuntimeEnv = getMissingRuntimeEnv(!dryRun);

  if (missingRuntimeEnv.length > 0) {
    return errorResponse(
      `Profile bucket seeding is not configured. Add ${missingRuntimeEnv.join(
        ", ",
      )} in server environment variables.`,
      501,
    );
  }

  const resolvedCategoryProfile = resolveCarouselCategoryProfile({
    category: body.category ?? body.categorySlug,
    pexelsImageQueries: body.pexelsImageQueries,
    productSummary: body.productSummary,
    valueProps: body.valueProps,
    visualKeywords: body.visualKeywords,
  });
  const requestedProfileId = getString(body.profileId);
  const businessVisualProfile = requestedProfileId
    ? getCarouselBusinessVisualProfile(
        requestedProfileId as CarouselBusinessVisualProfileId,
      )
    : resolvedCategoryProfile.businessVisualProfile;

  if (!businessVisualProfile) {
    return errorResponse(
      `Unknown business visual profile "${requestedProfileId}".`,
      400,
    );
  }

  const categorySlug = normalizeCategorySlug(
    getString(body.categorySlug) ||
      (requestedProfileId
        ? businessVisualProfile.categorySlug
        : resolvedCategoryProfile.categorySlug),
    businessVisualProfile.categorySlug,
  );
  const scope = getScope(body.scope);
  const maxBuckets = getPositiveInt(
    body.maxBuckets,
    DEFAULT_CAROUSEL_PROFILE_BUCKET_SEED_MAX_BUCKETS,
    20,
  );
  const targetCount = getPositiveInt(body.targetCount, undefined, 250);
  const batchSize = getPositiveInt(body.batchSize, undefined, 20);
  const candidateFetchLimit = getPositiveInt(
    body.candidateFetchLimit ?? body.maxSeededPerBucket,
    DEFAULT_CANDIDATE_FETCH_LIMIT,
    MAX_CANDIDATE_FETCH_LIMIT,
  );
  const maxSourceAttempts = getPositiveInt(
    body.maxSourceAttempts,
    undefined,
    MAX_SOURCE_ATTEMPTS,
  );

  try {
    const plan = await getCarouselProfileBucketSeedPlan({
      categorySlug,
      maxBuckets,
      profileId: businessVisualProfile.id,
      scope,
      targetCount,
    });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        message: "Profile bucket seed plan built. No background job was started.",
        plan,
      });
    }

    const handle = await tasks.trigger<typeof seedProfileBucketLibraryTask>(
      "seed-profile-bucket-library",
      {
        batchSize,
        candidateFetchLimit,
        categorySlug: plan.categorySlug,
        dryRun: false,
        maxBuckets,
        maxSourceAttempts,
        profileId: businessVisualProfile.id,
        scope,
        targetCount,
      },
    );

    return NextResponse.json({
      ok: true,
      dryRun: false,
      message: "Profile bucket library seeding started.",
      plan,
      runId: handle.id,
    });
  } catch (error) {
    console.error("Failed to prepare profile bucket seed:", error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not prepare profile bucket seeding.",
      502,
    );
  }
}
