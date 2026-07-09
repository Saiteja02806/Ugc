import type { CarouselProfileBucketReadiness } from "@/lib/carousel/profile-bucket-readiness";

export type CarouselReadinessWarning = {
  code: "low_safe_asset_coverage" | "missing_required_visual_buckets";
  message: string;
  severity: "warning";
};

export type CarouselReadinessStatus = "blocked" | "ready" | "warning";

export function getNoSafeCarouselAssetsMessage(categorySlug: string) {
  return `Category "${categorySlug}" has no approved object-only images available. Add safe approved images before carousel generation.`;
}

export function buildCarouselReadinessDiagnostics(params: {
  bucketReadiness: CarouselProfileBucketReadiness;
  categorySlug: string;
  missingBucketSummary: string;
  readyImageCount: number;
  requiredReadyImageCount: number;
}) {
  const warnings: CarouselReadinessWarning[] = [];

  if (params.readyImageCount < params.requiredReadyImageCount) {
    warnings.push({
      code: "low_safe_asset_coverage",
      message: `Category "${params.categorySlug}" has low image coverage (${params.readyImageCount}/${params.requiredReadyImageCount} approved safe images). Generation will continue, but safe fallback images may be reused.`,
      severity: "warning",
    });
  }

  if (!params.bucketReadiness.isReady) {
    warnings.push({
      code: "missing_required_visual_buckets",
      message: `Category "${params.categorySlug}" is missing target coverage in required visual buckets.${
        params.missingBucketSummary
          ? ` Missing priority buckets include ${params.missingBucketSummary}.`
          : ""
      } Generation will continue with available approved object-only images.`,
      severity: "warning",
    });
  }

  return {
    readinessStatus:
      params.readyImageCount <= 0
        ? "blocked"
        : warnings.length > 0
          ? "warning"
          : "ready",
    readinessWarnings: warnings,
  } satisfies {
    readinessStatus: CarouselReadinessStatus;
    readinessWarnings: CarouselReadinessWarning[];
  };
}
