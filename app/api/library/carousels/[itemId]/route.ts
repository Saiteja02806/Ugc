import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingLibraryDbEnvVars,
  getLibraryCarouselItemForUser,
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

/** Exact owner-bound lookup; recovery must not depend on a browsing page limit. */
export async function GET(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const user = await requireFirebaseUser(request);
    const { itemId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
      return jsonResponse({ok:false, message:"Choose a valid saved slideshow."}, 400);
    }
    if (getMissingLibraryDbEnvVars().length) return jsonResponse({ok:false, message:"Library is unavailable right now."}, 503);
    const item = await getLibraryCarouselItemForUser({itemId, userId:user.uid});
    if (!item) return jsonResponse({ok:false, message:"This Library item could not be found."}, 404);
    return jsonResponse({ok:true, item});
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return jsonResponse({ok:false, message:error.status === 401 ? "Sign in before viewing your Library." : error.message}, error.status);
    return jsonResponse({ok:false, message:"Could not load this saved slideshow right now."}, 503);
  }
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
