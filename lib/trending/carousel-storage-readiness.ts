import type {
  CarouselGenerationRecord,
  CarouselSlideRecord,
} from "../carousel/db.ts";
import { isTrustedStorageUrl } from "../storage/storage.ts";

export function isCompleteReadyCarouselForCurrentStorage(status: {
  generation: CarouselGenerationRecord;
  slides: CarouselSlideRecord[];
}) {
  return (
    status.generation.status === "completed" &&
    getReadySlidesForCurrentStorage(status.slides).length ===
      status.generation.slideCount
  );
}

export function getReadySlidesForCurrentStorage(slides: CarouselSlideRecord[]) {
  return slides
    .filter(
      (slide) =>
        slide.status === "ready" &&
        Boolean(slide.renderedUrl) &&
        isTrustedStorageUrl(slide.renderedUrl as string),
    )
    .sort((first, second) => first.slideNumber - second.slideNumber);
}
