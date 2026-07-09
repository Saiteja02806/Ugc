import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  enqueueCarouselGenerationJob,
  getMissingCarouselAwsEnvVars,
} from "@/lib/carousel/aws-generation";
import { getCarouselCandidateAngles } from "@/lib/carousel/candidate-angles";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  countReadyCategoryImageAssetsForCarousel,
  createCarouselGeneration,
  getMissingCarouselDbEnvVars,
  getWebsiteAnalysisForCarousel,
  updateCarouselGeneration,
  type CarouselFormat,
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
import type { CarouselBusinessVisualProfileId } from "@/lib/carousel/business-visual-profile";

export const runtime = "nodejs";

type GenerateCarouselBody = {
  analysisId?: unknown;
  candidateCount?: unknown;
  format?: unknown;
  goal?: unknown;
  projectId?: unknown;
  selectedAngle?: unknown;
  slideCount?: unknown;
  textStyle?: unknown;
};

const DEFAULT_FORMAT: CarouselFormat = "4:5";
const DEFAULT_CANDIDATE_COUNT = 10;
const DEFAULT_SLIDE_COUNT = 5;
const MAX_CANDIDATE_COUNT = 10;
const MAX_SLIDE_COUNT = 10;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFormat(value: unknown): CarouselFormat {
  return value === "1:1" || value === "4:5" ? value : DEFAULT_FORMAT;
}

function getSlideCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SLIDE_COUNT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_SLIDE_COUNT);
}

function getCandidateCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CANDIDATE_COUNT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_CANDIDATE_COUNT);
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as GenerateCarouselBody;
  } catch {
    return null;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingCarouselDbEnvVars(),
      ...getMissingCarouselAwsEnvVars(),
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

async function getCategoryReadinessOptions(params: {
  categorySlugs: string[];
  profileId: CarouselBusinessVisualProfileId;
  preferredCategorySlug: string;
  legacyCategorySlug: string;
}) {
  return Promise.all(
    params.categorySlugs.map(async (categorySlug) => ({
      categorySlug,
      isLegacy: categorySlug === params.legacyCategorySlug,
      isPreferred: categorySlug === params.preferredCategorySlug,
      readyImageCount: await countReadyCategoryImageAssetsForCarousel(
        categorySlug,
        params.profileId,
      ),
    })),
  );
}

export async function POST(request: Request) {
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
        message: "Send carousel generation details as JSON.",
      },
      400,
    );
  }

  const analysisId = getString(body.analysisId);

  if (!analysisId) {
    return jsonResponse(
      {
        ok: false,
        message: "Missing analysisId.",
      },
      400,
    );
  }

  try {
    const websiteAnalysis = await getWebsiteAnalysisForCarousel(analysisId);

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
    const candidateCount = getCandidateCount(body.candidateCount);
    const slideCount = getSlideCount(body.slideCount);
    const requiredReadyImageCount = candidateCount * slideCount;
    const categoryReadinessOptions = await getCategoryReadinessOptions({
      categorySlugs: resolvedCategory.candidateCategorySlugs,
      legacyCategorySlug: resolvedCategory.legacyCategorySlug,
      profileId: resolvedCategory.businessVisualProfile.id,
      preferredCategorySlug: resolvedCategory.categorySlug,
    });
    const selectedCategorySlug = resolvedCategory.categorySlug;
    const readyImageCount =
      categoryReadinessOptions.find(
        (item) => item.categorySlug === selectedCategorySlug,
      )?.readyImageCount ?? 0;
    const bucketReadiness = await getCarouselProfileBucketReadiness({
      categorySlug: selectedCategorySlug,
      profile: resolvedCategory.businessVisualProfile,
    });
    const categoryReadiness = categoryReadinessOptions.map((option) => ({
      ...option,
      isSelected: option.categorySlug === selectedCategorySlug,
    }));
    const missingBucketSummary = summarizeMissingProfileBuckets(bucketReadiness);
    const readinessDiagnostics = buildCarouselReadinessDiagnostics({
      bucketReadiness,
      categorySlug: selectedCategorySlug,
      missingBucketSummary,
      readyImageCount,
      requiredReadyImageCount,
    });

    if (readinessDiagnostics.readinessStatus === "blocked") {
      return jsonResponse(
        {
          ok: false,
          message: getNoSafeCarouselAssetsMessage(selectedCategorySlug),
          bucketReadiness,
          businessVisualProfile: {
            id: resolvedCategory.businessVisualProfile.id,
            label: resolvedCategory.businessVisualProfile.label,
            categorySlug: resolvedCategory.businessVisualProfile.categorySlug,
          },
          categoryReadiness,
          categorySlug: selectedCategorySlug,
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
      candidateCount,
      requestedAngle: getString(body.selectedAngle),
      websiteAnalysis,
    });
    const generationBatchId = randomUUID();
    const textStyle = getCarouselRenderStyle(body.textStyle);
    const candidates: Array<{
      angle: string;
      carouselId: string;
      jobId: string | null;
      status: "failed" | "processing";
    }> = [];

    for (const [candidateIndex, angle] of candidateAngles.entries()) {
      const projectId = getString(body.projectId) || websiteAnalysis.projectId;
      const carouselId = await createCarouselGeneration({
        candidateCount,
        candidateIndex,
        categorySlug: selectedCategorySlug,
        format: getFormat(body.format),
        generationBatchId,
        goal: getString(body.goal) || null,
        projectId,
        selectedAngle: angle,
        slideCount,
        userId: websiteAnalysis.userId,
        websiteAnalysisId: websiteAnalysis.id,
      });

      try {
        const jobId = await enqueueCarouselGenerationJob({
          candidateCount,
          candidateIndex,
          carouselId,
          projectId,
          textStyle,
          userId: websiteAnalysis.userId,
        });
        candidates.push({
          angle,
          carouselId,
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
          jobId: null,
          status: "failed",
        });
      }
    }

    const startedCandidates = candidates.filter(
      (candidate) => candidate.status === "processing" && candidate.jobId,
    );

    if (startedCandidates.length === 0) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Could not start carousel generation workers.",
          candidates,
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      message:
        startedCandidates.length === candidateCount
          ? `${candidateCount} carousel candidates started.`
          : `${startedCandidates.length} of ${candidateCount} carousel candidates started.`,
      candidateCount: startedCandidates.length,
      candidateIds: startedCandidates.map((candidate) => candidate.carouselId),
      candidates,
      carouselId: startedCandidates[0].carouselId,
      bucketReadiness,
      businessVisualProfile: {
        id: resolvedCategory.businessVisualProfile.id,
        label: resolvedCategory.businessVisualProfile.label,
        categorySlug: resolvedCategory.businessVisualProfile.categorySlug,
      },
      categoryReadiness,
      categorySlug: selectedCategorySlug,
      generationBatchId,
      isUsingLegacyCategoryFallback:
        selectedCategorySlug !== resolvedCategory.categorySlug,
      legacyCategorySlug: resolvedCategory.legacyCategorySlug,
      preferredCategorySlug: resolvedCategory.categorySlug,
      readyImageCount,
      readinessStatus: readinessDiagnostics.readinessStatus,
      readinessWarnings: readinessDiagnostics.readinessWarnings,
      requiredReadyImageCount,
      slideCount,
      textStyle,
    });
  } catch (error) {
    console.error("Failed to create carousel generation:", error);

    return jsonResponse(
      {
        ok: false,
        message: "Could not create carousel generation right now.",
      },
      500,
    );
  }
}
