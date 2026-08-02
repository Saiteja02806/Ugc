import { NextResponse } from "next/server";

import {
  getCarouselGenerationStatus,
  getMissingCarouselDbEnvVars,
  type CarouselGenerationRecord,
  type CarouselSlideRecord,
} from "@/lib/carousel/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingLibraryDbEnvVars,
  saveGeneratedCarouselToLibrary,
} from "@/lib/library/db";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { loadSavedTrendingCreativeEditForDownstream } from "@/lib/trending/creative-edit-service";

export const runtime = "nodejs";

type SaveCarouselRequestBody = {
  carouselId?: unknown;
};

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
              ? "Sign in before saving to Library."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify Library save requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = [
    ...new Set([
      ...getMissingCarouselDbEnvVars(),
      ...getMissingLibraryDbEnvVars(),
    ]),
  ];

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Library save is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  let body: SaveCarouselRequestBody;

  try {
    body = (await request.json()) as SaveCarouselRequestBody;
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Send a carousel ID to save.",
      },
      400,
    );
  }

  const carouselId =
    typeof body.carouselId === "string" ? body.carouselId.trim() : "";

  if (!carouselId) {
    return jsonResponse(
      {
        ok: false,
        message: "Send a carousel ID to save.",
      },
      400,
    );
  }

  try {
    const status = await getCarouselGenerationStatus(carouselId);

    if (!status) {
      return jsonResponse(
        {
          ok: false,
          message: "This carousel could not be found.",
        },
        404,
      );
    }

    if (status.generation.userId !== userId) {
      return jsonResponse(
        {
          ok: false,
          message: "This carousel is not available for your account.",
        },
        404,
      );
    }

    if (status.generation.status !== "completed") {
      return jsonResponse(
        {
          ok: false,
          message: "This carousel is still being prepared.",
        },
        409,
      );
    }

    const readySlides = status.slides
      .filter((slide) => slide.status === "ready" && Boolean(slide.renderedUrl))
      .sort((first, second) => first.slideNumber - second.slideNumber);

    if (readySlides.length !== status.generation.slideCount) {
      return jsonResponse(
        {
          ok: false,
          message: "This carousel is missing one or more ready slides.",
        },
        409,
      );
    }

    const savedEdit = await loadSavedTrendingCreativeEditForDownstream({
      creativeId: carouselId,
      format: "carousel",
      userId,
    });

    if (savedEdit && savedEdit.renderState !== "ready") {
      return jsonResponse(
        {
          ok: false,
          message:
            savedEdit.renderState === "failed"
              ? "The latest Carousel edit could not be rendered. Save the edit again before adding it to Library."
              : "The latest Carousel edit is still rendering. Wait for it to finish before adding it to Library.",
        },
        409,
      );
    }

    const editedSlides = savedEdit
      ? getReadyEditedSlides({ edit: savedEdit, originalSlides: readySlides })
      : null;

    if (savedEdit && !editedSlides) {
      return jsonResponse(
        {
          ok: false,
          message: "The latest Carousel edit is missing one or more rendered slides.",
        },
        409,
      );
    }

    const result = await saveGeneratedCarouselToLibrary({
      edit:
        savedEdit && savedEdit.content.format === "carousel"
          ? {
              id: savedEdit.id!,
              revision: savedEdit.revision,
              slides: savedEdit.content.slides.map((slide) => ({
                slideNumber: slide.slideNumber,
                textPosition: slide.textPosition,
              })),
            }
          : null,
      generation: status.generation,
      slides: editedSlides ?? readySlides,
      title: getCarouselTitle(status.generation),
      userId,
    });

    return jsonResponse({
      created: result.created,
      item: result.item,
      ok: true,
    });
  } catch (error) {
    console.error("Failed to save carousel to Library:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not save this carousel to Library right now.",
      },
      500,
    );
  }
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
