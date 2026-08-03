import { NextResponse } from "next/server";

import {
  enqueueCarouselGenerationJob,
  getMissingCarouselGenerationEnvVars,
} from "@/lib/carousel/generation-jobs";
import { getCarouselCandidateAngles } from "@/lib/carousel/candidate-angles";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  countReadyCategoryImageAssetsForCarousel,
  createCarouselGeneration,
  getCarouselGenerationsByBatchId,
  getMissingCarouselDbEnvVars,
  getWebsiteAnalysisForCarousel,
  updateCarouselGeneration,
  updateCarouselGenerationBatchCandidateCount,
} from "@/lib/carousel/db";
import {
  getCarouselProfileBucketReadiness,
  summarizeMissingProfileBuckets,
} from "@/lib/carousel/profile-bucket-readiness";
import {
  buildCarouselReadinessDiagnostics,
  getNoSafeCarouselAssetsMessage,
} from "@/lib/carousel/readiness-diagnostics";
import { getCarouselRenderStyle } from "@/lib/carousel/render-style";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

type GenerateMoreBody = {
  candidateCount?: unknown;
  generationBatchId?: unknown;
  textStyle?: unknown;
};

const DEFAULT_CANDIDATE_COUNT = 10;
const MAX_CHUNK_CANDIDATE_COUNT = 10;
const MAX_TOTAL_CANDIDATE_COUNT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCandidateCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CANDIDATE_COUNT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_CHUNK_CANDIDATE_COUNT);
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as GenerateMoreBody;
  } catch {
    return null;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingCarouselDbEnvVars(),
      ...getMissingCarouselGenerationEnvVars(),
    ]),
  );
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return jsonResponse(
        {
          ok: false,
          message:
            error.status === 401
              ? "Sign in before generating more carousel versions."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify carousel generation requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Carousel generation is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  const body = await readBody(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        message: "Send generation batch details as JSON.",
      },
      400,
    );
  }

  const generationBatchId = getString(body.generationBatchId);

  if (!generationBatchId || !UUID_PATTERN.test(generationBatchId)) {
    return jsonResponse(
      {
        ok: false,
        message: "generationBatchId must be a valid UUID.",
      },
      400,
    );
  }

  try {
    const existingGenerations =
      await getCarouselGenerationsByBatchId(generationBatchId);

    if (existingGenerations.length === 0) {
      return jsonResponse(
        {
          ok: false,
          message: "Carousel generation batch was not found.",
        },
        404,
      );
    }

    const baseGeneration = existingGenerations[0];

    if (baseGeneration.userId !== userId) {
      return jsonResponse(
        {
          ok: false,
          message: "Carousel generation batch was not found.",
        },
        404,
      );
    }

    if (!baseGeneration.websiteAnalysisId) {
      return jsonResponse(
        {
          ok: false,
          message: "Carousel generation batch is missing website analysis.",
        },
        409,
      );
    }

    if (!baseGeneration.categorySlug) {
      return jsonResponse(
        {
          ok: false,
          message: "Carousel generation batch is missing a category.",
        },
        409,
      );
    }

    const existingCandidateIndexes = existingGenerations.map(
      (generation) => generation.candidateIndex,
    );
    const nextCandidateIndex = Math.max(...existingCandidateIndexes) + 1;
    const remainingCandidateSlots = Math.max(
      MAX_TOTAL_CANDIDATE_COUNT - existingGenerations.length,
      0,
    );
    const requestedCandidateCount = getCandidateCount(body.candidateCount);
    const candidateCount = Math.min(
      requestedCandidateCount,
      remainingCandidateSlots,
    );

    if (candidateCount <= 0) {
      return jsonResponse({
        ok: true,
        message: "Generation batch already has the maximum candidate count.",
        candidateCount: 0,
        candidateIds: [],
        generationBatchId,
        totalCandidates: existingGenerations.length,
      });
    }

    const websiteAnalysis = await getWebsiteAnalysisForCarousel(
      baseGeneration.websiteAnalysisId,
    );

    if (!websiteAnalysis) {
      return jsonResponse(
        {
          ok: false,
          message: "Website analysis was not found.",
        },
        404,
      );
    }

    const resolvedCategory = resolveCarouselCategoryProfile({
      category: websiteAnalysis.analysis.category ?? websiteAnalysis.category,
      pexelsImageQueries:
        websiteAnalysis.analysis.pexelsImageQueries ??
        websiteAnalysis.pexelsImageQueries,
      productSummary:
        websiteAnalysis.analysis.productSummary ?? websiteAnalysis.productSummary,
      valueProps: websiteAnalysis.analysis.valueProps,
      visualKeywords:
        websiteAnalysis.analysis.visualKeywords ?? websiteAnalysis.visualKeywords,
    });
    const totalCandidateCount = existingGenerations.length + candidateCount;
    const requiredReadyImageCount = totalCandidateCount * baseGeneration.slideCount;
    const readyImageCount = await countReadyCategoryImageAssetsForCarousel(
      baseGeneration.categorySlug,
      resolvedCategory.businessVisualProfile.id,
    );
    const bucketReadiness = await getCarouselProfileBucketReadiness({
      categorySlug: baseGeneration.categorySlug,
      profile: resolvedCategory.businessVisualProfile,
    });
    const missingBucketSummary = summarizeMissingProfileBuckets(bucketReadiness);
    const categoryReadiness = [
      {
        categorySlug: baseGeneration.categorySlug,
        isLegacy:
          baseGeneration.categorySlug === resolvedCategory.legacyCategorySlug,
        isPreferred:
          baseGeneration.categorySlug === resolvedCategory.categorySlug,
        isSelected: true,
        readyImageCount,
      },
    ];
    const readinessDiagnostics = buildCarouselReadinessDiagnostics({
      bucketReadiness,
      categorySlug: baseGeneration.categorySlug,
      missingBucketSummary,
      readyImageCount,
      requiredReadyImageCount,
    });

    if (readinessDiagnostics.readinessStatus === "blocked") {
      return jsonResponse(
        {
          ok: false,
          message: getNoSafeCarouselAssetsMessage(baseGeneration.categorySlug),
          bucketReadiness,
          businessVisualProfile: {
            id: resolvedCategory.businessVisualProfile.id,
            label: resolvedCategory.businessVisualProfile.label,
            categorySlug: resolvedCategory.businessVisualProfile.categorySlug,
          },
          categoryReadiness,
          categorySlug: baseGeneration.categorySlug,
          legacyCategorySlug: resolvedCategory.legacyCategorySlug,
          preferredCategorySlug: resolvedCategory.categorySlug,
          readyImageCount,
          readinessStatus: readinessDiagnostics.readinessStatus,
          readinessWarnings: readinessDiagnostics.readinessWarnings,
          requiredReadyImageCount,
        },
        409,
      );
    }

    const candidateAngles = getCarouselCandidateAngles({
      candidateCount: totalCandidateCount,
      requestedAngle: null,
      websiteAnalysis,
    });
    const textStyle = getCarouselRenderStyle(body.textStyle);
    const candidates: Array<{
      angle: string;
      carouselId: string;
      candidateIndex: number;
      jobId: string | null;
      status: "failed" | "processing";
    }> = [];

    for (
      let candidateIndex = nextCandidateIndex;
      candidateIndex < nextCandidateIndex + candidateCount;
      candidateIndex += 1
    ) {
      const angle =
        candidateAngles[candidateIndex] ??
        `Carousel angle ${candidateIndex + 1}`;
      const carouselId = await createCarouselGeneration({
        candidateCount: totalCandidateCount,
        candidateIndex,
        categorySlug: baseGeneration.categorySlug,
        format: baseGeneration.format,
        generationBatchId,
        goal: baseGeneration.goal,
        projectId: baseGeneration.projectId,
        selectedAngle: angle,
        slideCount: baseGeneration.slideCount,
        userId: baseGeneration.userId,
        websiteAnalysisId: baseGeneration.websiteAnalysisId,
      });

      try {
        const jobId = await enqueueCarouselGenerationJob({
          candidateCount: totalCandidateCount,
          candidateIndex,
          carouselId,
          projectId: baseGeneration.projectId,
          textStyle,
          userId: baseGeneration.userId,
        });
        candidates.push({
          angle,
          carouselId,
          candidateIndex,
          jobId,
          status: "processing",
        });
      } catch (error) {
        console.error("Failed to start carousel candidate worker job:", error);

        await updateCarouselGeneration(carouselId, {
          error_message:
            "Could not start the carousel generation worker.",
          status: "failed",
        }).catch((updateError) => {
          console.error("Failed to mark carousel candidate start failure:", updateError);
        });
        candidates.push({
          angle,
          carouselId,
          candidateIndex,
          jobId: null,
          status: "failed",
        });
      }
    }

    await updateCarouselGenerationBatchCandidateCount({
      candidateCount: totalCandidateCount,
      generationBatchId,
    });

    const startedCandidates = candidates.filter(
      (candidate) => candidate.status === "processing" && candidate.jobId,
    );

    if (startedCandidates.length === 0) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Could not start more carousel generation workers.",
          candidates,
          generationBatchId,
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      message:
        startedCandidates.length === candidateCount
          ? `${candidateCount} more carousel candidates started.`
          : `${startedCandidates.length} of ${candidateCount} more carousel candidates started.`,
      candidateCount: startedCandidates.length,
      candidateIds: startedCandidates.map((candidate) => candidate.carouselId),
      candidates,
      bucketReadiness,
      businessVisualProfile: {
        id: resolvedCategory.businessVisualProfile.id,
        label: resolvedCategory.businessVisualProfile.label,
        categorySlug: resolvedCategory.businessVisualProfile.categorySlug,
      },
      categoryReadiness,
      categorySlug: baseGeneration.categorySlug,
      generationBatchId,
      isUsingLegacyCategoryFallback:
        baseGeneration.categorySlug !== resolvedCategory.categorySlug,
      legacyCategorySlug: resolvedCategory.legacyCategorySlug,
      preferredCategorySlug: resolvedCategory.categorySlug,
      readyImageCount,
      readinessStatus: readinessDiagnostics.readinessStatus,
      readinessWarnings: readinessDiagnostics.readinessWarnings,
      requiredReadyImageCount,
      slideCount: baseGeneration.slideCount,
      textStyle,
      totalCandidates: totalCandidateCount,
    });
  } catch (error) {
    console.error("Failed to append carousel candidates:", error);

    return jsonResponse(
      {
        ok: false,
        message: "Could not append carousel candidates right now.",
      },
      500,
    );
  }
}
