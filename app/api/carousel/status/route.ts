import { type NextRequest, NextResponse } from "next/server";

import {
  getCarouselGenerationStatus,
  getCarouselGenerationStatusPageByBatchId,
  getMissingCarouselDbEnvVars,
} from "@/lib/carousel/db";

export const runtime = "nodejs";

const MAX_STATUS_CANDIDATE_IDS = 50;
const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CarouselStatusItem = Awaited<
  ReturnType<typeof getCarouselGenerationStatus>
>;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getIntegerSearchParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
) {
  const value = Number(searchParams.get(key));

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value);
}

function mapCandidate(status: NonNullable<CarouselStatusItem>) {
  return {
    angle: status.generation.selectedAngle,
    candidateCount: status.generation.candidateCount,
    candidateIndex: status.generation.candidateIndex,
    carouselId: status.generation.id,
    categorySlug: status.generation.categorySlug,
    errorMessage: status.generation.errorMessage,
    format: status.generation.format,
    generationBatchId: status.generation.generationBatchId,
    slideCount: status.generation.slideCount,
    slides: status.slides,
    status: status.generation.status,
    websiteAnalysisId: status.generation.websiteAnalysisId,
  };
}

export async function GET(request: NextRequest) {
  const missingRuntimeEnv = getMissingCarouselDbEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Carousel status is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  const generationBatchId = request.nextUrl.searchParams
    .get("generationBatchId")
    ?.trim();
  const carouselIdsParam = request.nextUrl.searchParams.get("carouselIds");
  const legacyCarouselId = request.nextUrl.searchParams.get("carouselId")?.trim();
  const carouselIds = Array.from(
    new Set(
      (carouselIdsParam ? carouselIdsParam.split(",") : [legacyCarouselId ?? ""])
        .map((carouselId) => carouselId.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_STATUS_CANDIDATE_IDS);

  if (!generationBatchId && carouselIds.length === 0) {
    return jsonResponse(
      {
        ok: false,
        message: "Missing generationBatchId, carouselId, or carouselIds.",
      },
      400,
    );
  }

  if (generationBatchId && !UUID_PATTERN.test(generationBatchId)) {
    return jsonResponse(
      {
        ok: false,
        message: "generationBatchId must be a valid UUID.",
      },
      400,
    );
  }

  if (!generationBatchId && carouselIds.some((carouselId) => !UUID_PATTERN.test(carouselId))) {
    return jsonResponse(
      {
        ok: false,
        message: "carouselId and carouselIds must contain only valid UUIDs.",
      },
      400,
    );
  }

  try {
    const limit = Math.min(
      Math.max(
        getIntegerSearchParam(
          request.nextUrl.searchParams,
          "limit",
          generationBatchId ? DEFAULT_BATCH_LIMIT : MAX_STATUS_CANDIDATE_IDS,
        ),
        1,
      ),
      generationBatchId ? MAX_BATCH_LIMIT : MAX_STATUS_CANDIDATE_IDS,
    );
    const offset = Math.max(
      getIntegerSearchParam(request.nextUrl.searchParams, "offset", 0),
      0,
    );

    if (generationBatchId) {
      const page = await getCarouselGenerationStatusPageByBatchId({
        generationBatchId,
        limit,
        offset,
      });

      if (page.totalCandidates === 0) {
        return jsonResponse(
          {
            ok: false,
            message: "Carousel generation batch was not found.",
          },
          404,
        );
      }

      return jsonResponse({
        ok: true,
        candidates: page.statuses.map(mapCandidate),
        generationBatchId,
        hasMore: page.hasMore,
        limit: page.limit,
        offset: page.offset,
        totalCandidates: page.totalCandidates,
      });
    }

    const statuses = await Promise.all(
      carouselIds.map((carouselId) => getCarouselGenerationStatus(carouselId)),
    );

    if (statuses.some((status) => !status)) {
      return jsonResponse(
        {
          ok: false,
          message: "One or more carousel candidates were not found.",
        },
        404,
      );
    }

    const completeStatuses = statuses.filter(
      (status): status is NonNullable<typeof status> => Boolean(status),
    );
    const candidates = completeStatuses.map(mapCandidate);
    const firstStatus = completeStatuses[0];

    return jsonResponse({
      ok: true,
      candidates,
      hasMore: false,
      limit,
      offset,
      totalCandidates: candidates.length,
      ...(completeStatuses.length === 1
        ? {
            carousel: firstStatus.generation,
            slides: firstStatus.slides,
          }
        : {}),
    });
  } catch (error) {
    console.error("Failed to read carousel status:", error);

    return jsonResponse(
      {
        ok: false,
        message: "Could not read carousel status right now.",
      },
      500,
    );
  }
}
