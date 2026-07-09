import type { WebsiteAnalysisForCarousel } from "@/lib/carousel/db";

export function getCarouselCandidateAngles(params: {
  candidateCount: number;
  requestedAngle?: string | null;
  websiteAnalysis: WebsiteAnalysisForCarousel | null;
}) {
  if (!params.websiteAnalysis) {
    return [];
  }

  const analysis = params.websiteAnalysis.analysis;
  const businessName = analysis.businessName?.trim() || "your product";
  const sourceAngles = [
    params.requestedAngle ?? "",
    ...analysis.carouselAngles,
    analysis.mainPromise ?? "",
    analysis.mainProblem ?? "",
    ...analysis.valueProps,
    ...analysis.differentiators,
  ];
  const angles = sourceAngles
    .map((angle) => angle.trim())
    .filter(Boolean)
    .filter(
      (angle, index, values) =>
        values.findIndex(
          (candidate) => candidate.toLowerCase() === angle.toLowerCase(),
        ) === index,
    );
  const fallbacks = [
    `A simpler way to work with ${businessName}`,
    `What changes when ${businessName} handles the busywork`,
    `The modern workflow teams expect from ${businessName}`,
    `Before and after switching to ${businessName}`,
    `Why teams outgrow the old way before ${businessName}`,
    `The hidden cost ${businessName} removes from the workflow`,
    `A week of work with ${businessName} in charge`,
    `The faster path from idea to shipped work with ${businessName}`,
    `How ${businessName} makes the next step obvious`,
    `What buyers notice first about ${businessName}`,
    `Where ${businessName} saves the most time`,
    `The repeatable workflow behind ${businessName}`,
    `How teams explain ${businessName} to a busy buyer`,
    `The practical reason ${businessName} feels faster`,
    `What the old workflow misses before ${businessName}`,
    `How ${businessName} turns scattered work into next steps`,
    `Why ${businessName} becomes part of the daily routine`,
    `The moment ${businessName} removes from the process`,
    `How ${businessName} helps teams move without extra coordination`,
    `What a cleaner workflow looks like with ${businessName}`,
  ];

  for (const fallback of fallbacks) {
    if (angles.length >= params.candidateCount) {
      break;
    }

    if (!angles.some((angle) => angle.toLowerCase() === fallback.toLowerCase())) {
      angles.push(fallback);
    }
  }

  for (let index = angles.length; index < params.candidateCount; index += 1) {
    angles.push(`Carousel angle ${index + 1} for ${businessName}`);
  }

  return angles.slice(0, params.candidateCount);
}
