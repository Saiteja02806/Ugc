import type { SlideshowGenerationSlot } from "@/worker/src/lib/slideshow-generation-batch";
import type { SlideshowSourceIdentity } from "@/lib/explore/slideshow-image-names";

export type SlideshowFaceSwapJob = { jobId: string; slideshowGeneration?: SlideshowGenerationSlot | null };

/** One paid swap per marked slide, independent of the number of generated versions. */
export function getSlideshowFaceSwapCredits(slideIds: readonly string[], influencerAssetId: string | null, creditCost: number) {
  return influencerAssetId ? new Set(slideIds).size * creditCost : 0;
}

/** Jobs whose generated slide was marked for the chosen face. Only version 1 receives the single paid swap. */
export function planSlideshowFaceSwaps({ jobs, sources, slideIds, influencerAssetId, influencerReferenceAssetIds }: {
  jobs: readonly SlideshowFaceSwapJob[];
  sources: readonly Pick<SlideshowSourceIdentity, "slideId">[];
  slideIds: readonly string[];
  influencerAssetId: string | null;
  influencerReferenceAssetIds?: string[];
}) {
  if (!influencerAssetId || slideIds.length === 0) return [];
  const wanted = new Set(slideIds);
  const planned = new Set<string>();
  return jobs.flatMap(job => {
    if (job.slideshowGeneration?.versionIndex !== 1) return [];
    const source = job.slideshowGeneration ? sources[job.slideshowGeneration.slideIndex - 1] : undefined;
    if (!source || !wanted.has(source.slideId) || planned.has(source.slideId)) return [];
    planned.add(source.slideId);
    return [{ jobId: job.jobId, influencerAssetId, ...(influencerReferenceAssetIds?.length ? { influencerReferenceAssetIds } : {}) }];
  });
}
