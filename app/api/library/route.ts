import { NextResponse } from "next/server";

import {
  getMissingLibraryDbEnvVars,
  listLibraryCarouselItems,
} from "@/lib/library/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
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
              ? "Sign in before viewing your Library."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify Library requester:", error);
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

  const url = new URL(request.url);
  const type = url.searchParams.get("type")?.trim() || "carousel";

  if (type !== "carousel") {
    return jsonResponse(
      {
        ok: false,
        message: "Only carousel Library content is available right now.",
      },
      400,
    );
  }

  try {
    const items = await listLibraryCarouselItems({
      projectId: url.searchParams.get("projectId"),
      userId,
    });

    return jsonResponse({
      items,
      ok: true,
    });
  } catch (error) {
    console.error("Failed to list Library content:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not load Library content right now.",
      },
      500,
    );
  }
}
