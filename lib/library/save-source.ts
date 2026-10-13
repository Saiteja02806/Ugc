import "server-only";
import {
  getCarouselGenerationStatus,
  type CarouselSlideRecord,
  type CarouselGenerationRecord,
} from "@/lib/carousel/db";
import { loadSavedTrendingCreativeEditForDownstream } from "@/lib/trending/creative-edit-service";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import type { GeneratedCarouselLibraryInput } from "./db";

export class LibraryContentError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Website and IDE saves resolve the same owned, ready source and latest edit. */
export async function prepareGeneratedCarouselLibrarySaveForOwner(
  userId: string,
  carouselId: string,
): Promise<GeneratedCarouselLibraryInput> {
  const status = await getCarouselGenerationStatus(carouselId);
  if (!status || status.generation.userId !== userId) {
    throw new LibraryContentError("This carousel is unavailable to your account.", 404);
  }
  if (status.generation.status !== "completed") {
    throw new LibraryContentError("This carousel is still being prepared.", 409);
  }
  const readySlides = status.slides
    .filter(slide => slide.status === "ready" && Boolean(slide.renderedUrl))
    .sort((a, b) => a.slideNumber - b.slideNumber);
  if (readySlides.length !== status.generation.slideCount) {
    throw new LibraryContentError("This carousel is missing one or more ready slides.", 409);
  }
  const savedEdit = await loadSavedTrendingCreativeEditForDownstream({
    creativeId: carouselId, format: "carousel", userId,
  });
  if (savedEdit && savedEdit.renderState !== "ready") {
    throw new LibraryContentError(savedEdit.renderState === "failed"
      ? "The latest Carousel edit could not be rendered. Save the edit again before adding it to Library."
      : "The latest Carousel edit is still rendering. Wait for it to finish before adding it to Library.", 409);
  }
  const editedSlides = savedEdit
    ? getReadyEditedSlides({ edit: savedEdit, originalSlides: readySlides })
    : null;
  if (savedEdit && !editedSlides) {
    throw new LibraryContentError("The latest Carousel edit is missing one or more rendered slides.", 409);
  }
  return {
    edit: savedEdit && savedEdit.content.format === "carousel" ? {
      id: savedEdit.id!, revision: savedEdit.revision,
      slides: savedEdit.content.slides.map(slide => ({ slideNumber: slide.slideNumber, textPosition: slide.textPosition })),
    } : null,
    generation: status.generation, slides: editedSlides ?? readySlides,
    title: getCarouselTitle(status.generation), userId,
  };
}

function getReadyEditedSlides(params: {
  edit: Awaited<ReturnType<typeof loadSavedTrendingCreativeEditForDownstream>>;
  originalSlides: CarouselSlideRecord[];
}) {
  const { edit, originalSlides } = params;

  if (
    !edit ||
    !edit.id ||
    edit.content.format !== "carousel" ||
    !edit.renderOutput
  ) {
    return null;
  }

  const contentBySlideNumber = new Map(
    edit.content.slides.map((slide) => [slide.slideNumber, slide]),
  );
  const outputBySlideNumber = new Map(
    edit.renderOutput.slides.map((slide) => [slide.slideNumber, slide]),
  );

  if (
    edit.content.slides.length !== originalSlides.length ||
    edit.renderOutput.slides.length !== originalSlides.length
  ) {
    return null;
  }

  const slides: CarouselSlideRecord[] = [];

  for (const slide of originalSlides) {
    const content = contentBySlideNumber.get(slide.slideNumber);
    const output = outputBySlideNumber.get(slide.slideNumber);

    if (
      !content ||
      content.slideId !== slide.id ||
      !output ||
      !isTrustedStorageUrl(output.renderedUrl)
    ) {
      return null;
    }

    slides.push({
      ...slide,
      ctaText: content.ctaText || null,
      headline: content.headline,
      renderedS3Key: output.renderedS3Key,
      renderedUrl: output.renderedUrl,
      subtext: content.subtext || null,
    });
  }

  return slides;
}

function getCarouselTitle(generation: CarouselGenerationRecord) {
  return (
    generation.selectedAngle?.trim() ||
    titleCaseSlug(generation.categorySlug) ||
    `Carousel idea ${generation.candidateIndex + 1}`
  );
}

function titleCaseSlug(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
