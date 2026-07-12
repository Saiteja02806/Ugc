import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingLibraryDbEnvVars,
  removeLibraryCarouselItem,
} from "@/lib/library/db";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      itemId: string;
    }>;
  },
) {
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
              ? "Sign in before changing your Library."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify Library remove requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = getMissingLibraryDbEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Library is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  const { itemId } = await context.params;

  if (!itemId?.trim()) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose a Library item to remove.",
      },
      400,
    );
  }

  try {
    const removed = await removeLibraryCarouselItem({
      itemId: itemId.trim(),
      userId,
    });

    if (!removed) {
      return jsonResponse(
        {
          ok: false,
          message: "This Library item could not be found.",
        },
        404,
      );
    }

    return jsonResponse({
      ok: true,
    });
  } catch (error) {
    console.error("Failed to remove Library carousel:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not remove this Library item right now.",
      },
      500,
    );
  }
}
