import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const RETIRED_GENERATION_CODE = "carousel_manual_generation_retired";

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    await requireFirebaseUser(request);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return jsonResponse(
        {
          ok: false,
          message:
            error.status === 401
              ? "Sign in before preparing Carousel ideas."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify retired Carousel generation route requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  return jsonResponse(
    {
      code: RETIRED_GENERATION_CODE,
      ok: false,
      message:
        "Manual Carousel generation has been retired. Complete your Business Profile and use Trending, where Carousel V1 is prepared automatically.",
    },
    410,
  );
}
