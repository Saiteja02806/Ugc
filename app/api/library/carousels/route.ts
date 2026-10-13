import { NextResponse } from "next/server";

import {
  getMissingCarouselDbEnvVars,
} from "@/lib/carousel/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingLibraryDbEnvVars,
  saveGeneratedCarouselToLibrary,
} from "@/lib/library/db";
import { LibraryContentError, prepareGeneratedCarouselLibrarySaveForOwner } from "@/lib/library/save-source";

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
    const input = await prepareGeneratedCarouselLibrarySaveForOwner(userId, carouselId);
    const result = await saveGeneratedCarouselToLibrary(input);

    return jsonResponse({
      created: result.created,
      item: result.item,
      ok: true,
    });
  } catch (error) {
    if (error instanceof LibraryContentError) return jsonResponse({ ok: false, message: error.message }, error.status);
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
