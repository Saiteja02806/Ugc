import { NextResponse } from "next/server";

import {
  getMissingCarouselDbEnvVars,
  listCarouselGenerationStatusesForUser,
} from "@/lib/carousel/db";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

export async function GET(request: Request) {
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
              ? "Sign in before viewing generated carousels."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify carousel history requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = getMissingCarouselDbEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Carousel history is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(userId);

    if (!profile) {
      return jsonResponse({
        ok: true,
        carousels: [],
        profile: { state: "missing" },
      });
    }

    const statuses = await listCarouselGenerationStatusesForUser({
      businessProfileId: profile.id,
      limit: getLimit(new URL(request.url).searchParams.get("limit")),
      projectId: profile.projectId,
      userId,
    });
    const readyCount = statuses.filter(({ generation, slides }) =>
      generation.status === "completed" &&
      slides.some((slide) => slide.status === "ready" && Boolean(slide.renderedUrl)),
    ).length;
    const failedGeneration = statuses.find(
      ({ generation }) => generation.status === "failed",
    )?.generation;
    const profileState =
      readyCount > 0
        ? "ready"
        : failedGeneration || profile.preparationStatus === "failed"
          ? "failed"
          : "preparing";

    return jsonResponse({
      ok: true,
      carousels: statuses.map(({ generation, slides }) => {
        const readySlides = slides.filter(
          (slide) => slide.status === "ready" && Boolean(slide.renderedUrl),
        );

        return {
          carouselId: generation.id,
          categorySlug: generation.categorySlug,
          generationBatchId: generation.generationBatchId,
          projectId: generation.projectId,
          readySlideCount: readySlides.length,
          selectedAngle: generation.selectedAngle,
          slideCount: generation.slideCount,
          status: generation.status,
          thumbnailUrl: readySlides[0]?.renderedUrl ?? null,
          updatedAt: generation.updatedAt,
        };
      }),
      profile: {
        error: failedGeneration?.errorMessage ?? profile.preparationError,
        id: profile.id,
        state: profileState,
      },
    });
  } catch (error) {
    console.error("Failed to list carousel history:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not load generated carousels right now.",
      },
      500,
    );
  }
}
