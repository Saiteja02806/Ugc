type CarouselSourceRetirementAsset = {
  is_active: boolean;
  runtime_exclusion_reason: string | null;
  source_metadata: unknown;
  status: string;
  subject_review_status: string;
};

/** A reviewed source retired from future selection, with its historical bytes retained. */
export function isPreservedRetiredCarouselSource(
  asset: CarouselSourceRetirementAsset,
) {
  if (
    asset.is_active !== false ||
    asset.status !== "archived" ||
    asset.subject_review_status !== "approved" ||
    asset.runtime_exclusion_reason !== "user_requested_retirement"
  ) {
    return false;
  }

  const metadata = asObject(asset.source_metadata);
  const retirement = asObject(metadata?.retirement);
  return retirement?.preserveHistoricalRenders === true;
}

/** The retirement exception reads an existing completed artifact; it never admits a new slide. */
export function canReadPreservedRetiredCarouselSlide(params: {
  asset: CarouselSourceRetirementAsset;
  generationStatus: string;
  slide: { rendered_url: string | null; status: string };
}) {
  return (
    params.generationStatus === "completed" &&
    params.slide.status === "ready" &&
    Boolean(params.slide.rendered_url?.trim()) &&
    isPreservedRetiredCarouselSource(params.asset)
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
